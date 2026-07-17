'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import { PageHeaderActionsSkeleton, SearchBarSkeleton, TableSkeleton } from '@/components/Skeleton';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';
import { canManageGymCatalog } from '@/lib/gymRoles';
import { computeSignupOneTimeFees } from '@/lib/signupFees';
import { printOneTimePaymentReceipt } from '@/lib/signupReceipt';
import { notifyDashboardStatsRefresh } from '@/lib/dashboardEvents';
import { DEFAULT_MAX_MEMBER_DISCOUNT, fetchGymSettings } from '@/lib/attendanceApi';
import { downloadExcelCsv, excelExportFilename } from '@/lib/exportExcel';
import { displayMemberId, normalizeMemberNumberFields } from '@/lib/displayMemberId';

interface Trainer {
  id: string;
  name: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  specialization: string | null;
  charges?: number;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

interface Package {
  id: string;
  name: string;
  price: number;
  discount?: number | null;
  duration: string;
  features: string[];
}

interface Member {
  id: string;
  /** Gym-facing Member ID (same as legacyMemberId). */
  memberNumber: string | null;
  legacyMemberId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  cnic: string | null;
  comments: string | null;
  packageId: string | null;
  discount?: number;
  admissionAmount?: number | null;
  trainers: Trainer[];
  isActive?: boolean;
  inactiveFrom?: string | null;
  billingResumeFrom?: string | null;
}

function safeText(value: unknown): string {
  if (value == null) return '';
  const t = String(value).trim();
  if (!t || t.toLowerCase() === 'null' || t.toLowerCase() === 'undefined') return '';
  return t;
}

function normalizeId(value: unknown): number | string | undefined {
  const raw = safeText(value);
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

function normalizeDateYmd(value: unknown): string | undefined {
  const raw = safeText(value);
  if (!raw) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${raw}T00:00:00.000Z`;
}

type MemberStatusActionKind = 'deactivate' | 'reactivate';
type DateMode = 'today' | 'custom';

function statusBadge(member: Member) {
  if (member.isActive === false) {
    return <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Inactive</span>;
  }
  return <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Active</span>;
}

function memberMonthlyPayment(
  member: Member,
  packages: Package[],
  allTrainers: Trainer[]
): number {
  const memberPackage = packages.find((p) => String(p.id) === String(member.packageId));
  const memberTrainer =
    member.trainers.length > 0
      ? allTrainers.find((t) => String(t.id) === String(member.trainers[0].id))
      : null;
  let monthlyTotal = 0;
  if (memberPackage) {
    const packagePrice =
      memberPackage.discount && memberPackage.discount > 0
        ? Math.max(0, memberPackage.price - memberPackage.discount)
        : memberPackage.price;
    monthlyTotal += memberPackage.duration.includes('12') ? packagePrice / 12 : packagePrice;
  }
  if (memberTrainer?.charges) {
    monthlyTotal += memberTrainer.charges;
  }
  if (member.discount) {
    monthlyTotal = Math.max(0, monthlyTotal - member.discount);
  }
  return monthlyTotal;
}

export default function MembersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { alert, showAlert, closeAlert } = useAlert();
  const canManage = canManageGymCatalog(user?.role);
  const [members, setMembers] = useState<Member[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; memberId: string | null; memberName: string }>({
    isOpen: false,
    memberId: null,
    memberName: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    /** Optional gym Member ID on create → API `legacyMemberId`. */
    legacyMemberId: '',
    phone: '',
    email: '',
    gender: '',
    dateOfBirth: '',
    cnic: '',
    comments: '',
    packageId: '',
    requiresTrainer: false,
    trainerId: '',
    discount: '',
    admissionFeeWaived: false, // Changed from waiveAdmissionFee to match API
  });
  
  const [globalAdmissionAmount, setGlobalAdmissionAmount] = useState<number>(0);
  const [maxMemberDiscount, setMaxMemberDiscount] = useState<number>(DEFAULT_MAX_MEMBER_DISCOUNT);
  const [statusDialog, setStatusDialog] = useState<{
    isOpen: boolean;
    member: Member | null;
    action: MemberStatusActionKind;
  }>({
    isOpen: false,
    member: null,
    action: 'deactivate',
  });
  const [statusDateMode, setStatusDateMode] = useState<DateMode>('today');
  const [statusCustomDate, setStatusCustomDate] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  useEffect(() => {
    if (!editingMember) return;
    const firstTrainer = editingMember.trainers?.[0];
    setFormData({
      name: safeText(editingMember.name),
      legacyMemberId: displayMemberId(editingMember) === '—' ? '' : displayMemberId(editingMember),
      phone: safeText(editingMember.phone),
      email: safeText(editingMember.email),
      gender: safeText(editingMember.gender),
      dateOfBirth: safeText(editingMember.dateOfBirth).split('T')[0] || '',
      cnic: safeText(editingMember.cnic),
      comments: safeText(editingMember.comments),
      packageId: safeText(editingMember.packageId),
      requiresTrainer: Boolean(firstTrainer),
      trainerId: safeText(firstTrainer?.id),
      discount: editingMember.discount != null ? String(editingMember.discount) : '',
      admissionFeeWaived: editingMember.admissionAmount === 0 || editingMember.admissionAmount === null,
    });
  }, [editingMember]);

  // Fetch gym billing settings (admission fee, max member discount)
  useEffect(() => {
    const loadGymSettings = async () => {
      try {
        const data = await fetchGymSettings();
        setGlobalAdmissionAmount(data.admissionFee || 0);
        setMaxMemberDiscount(data.maxMemberDiscount);
      } catch (error) {
        console.warn('Could not fetch gym settings, using defaults:', error);
        setGlobalAdmissionAmount(0);
        setMaxMemberDiscount(DEFAULT_MAX_MEMBER_DISCOUNT);
      }
    };
    void loadGymSettings();
  }, []);

  // Fetch members from API
  const fetchMembers = useCallback(async (search?: string, sort?: { key: string; direction: string }) => {
    try {
      setLoading(true);
      console.log('🔵 Fetching members from API...');
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (sort?.key) {
        const apiSortKey = sort.key === 'id' ? 'memberNumber' : sort.key;
        params.append('sortBy', apiSortKey);
      }
      if (sort?.direction) params.append('sortOrder', sort.direction);
      params.append('limit', '1000');

      const response = await api.get(`/api/members?${params}`);
      console.log('Members API Response:', response.data);

      if (response.data.success) {
        const membersList = response.data.data.members || [];
        // Transform API response to match Member interface
        const transformedMembers: Member[] = membersList.map((m: any) => {
          const nums = normalizeMemberNumberFields(m as Record<string, unknown>);
          return {
            id: m.id,
            memberNumber: nums.memberNumber,
            legacyMemberId: nums.legacyMemberId,
            name: m.name,
            phone: m.phone,
            email: m.email,
            gender: m.gender,
            dateOfBirth: m.dateOfBirth,
            cnic: m.cnic,
            comments: m.comments,
            packageId: m.packageId,
            discount: m.discount,
            admissionAmount: m.admissionAmount,
            trainers: m.trainers || [],
            isActive: m.isActive !== false,
            inactiveFrom: m.inactiveFrom ?? null,
            billingResumeFrom: m.billingResumeFrom ?? null,
          };
        });
        setMembers(transformedMembers);
        console.log('✅ Members loaded:', transformedMembers.length);
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  // Fetch trainers from API (active only for the selection dropdown).
  // When editing, any currently assigned inactive trainer is merged in below.
  const fetchTrainers = useCallback(async () => {
    try {
      console.log('🔵 Fetching trainers from API...');
      const response = await api.get('/api/trainers?isActive=true&limit=1000');
      console.log('Trainers API Response:', response.data);

      if (response.data.success) {
        const trainersList = (response.data.data.trainers || []).map((t: Trainer) => ({
          ...t,
          isActive: t.isActive !== false,
        }));
        setTrainers(trainersList);
        console.log('✅ Trainers loaded:', trainersList.length);
      }
    } catch (error: any) {
      console.error('Error fetching trainers:', error);
      // Don't show alert for trainers, just log
    }
  }, []);

  // Fetch packages from API
  const fetchPackages = useCallback(async () => {
    try {
      console.log('🔵 Fetching packages from API...');
      const response = await api.get('/api/packages?limit=1000');
      console.log('Packages API Response:', response.data);

      if (response.data.success) {
        const packagesList = response.data.data.packages || [];
        setAvailablePackages(packagesList);
        console.log('✅ Packages loaded:', packagesList.length);
      }
    } catch (error: any) {
      console.error('Error fetching packages:', error);
      // Don't show alert for packages, just log
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    fetchMembers();
    fetchTrainers();
    fetchPackages();
  }, []); // Only run on mount

  // Refetch members when search or sort changes
  useEffect(() => {
    fetchMembers(searchQuery || undefined, sortConfig ? { key: sortConfig.key, direction: sortConfig.direction } : undefined);
  }, [searchQuery, sortConfig, fetchMembers]);

  // Handle search on Enter key
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchInput);
    }
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    let filtered = members;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(member => {
        try {
          const memberNumStr = displayMemberId(member).toLowerCase();
          const nameStr = member.name ? member.name.toLowerCase() : '';
          const phoneStr = member.phone ? member.phone.toLowerCase() : '';
          const emailStr = member.email ? member.email.toLowerCase() : '';
          const cnicStr = member.cnic ? member.cnic.toLowerCase() : '';
          
          return (memberNumStr !== '—' && memberNumStr.includes(query)) ||
            nameStr.includes(query) ||
            phoneStr.includes(query) ||
            emailStr.includes(query) ||
            cnicStr.includes(query);
        } catch (error) {
          console.warn('Error filtering member:', member, error);
          return false;
        }
      });
    }

    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'id':
          case 'memberNumber': {
            const aNum = displayMemberId(a);
            const bNum = displayMemberId(b);
            const aN = Number(aNum);
            const bN = Number(bNum);
            if (Number.isFinite(aN) && Number.isFinite(bN) && aNum !== '—' && bNum !== '—') {
              aValue = aN;
              bValue = bN;
            } else {
              aValue = aNum.toLowerCase();
              bValue = bNum.toLowerCase();
            }
            break;
          }
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'phone':
            aValue = a.phone?.toLowerCase() || '';
            bValue = b.phone?.toLowerCase() || '';
            break;
          case 'email':
            aValue = a.email?.toLowerCase() || '';
            bValue = b.email?.toLowerCase() || '';
            break;
          case 'gender':
            aValue = a.gender?.toLowerCase() || '';
            bValue = b.gender?.toLowerCase() || '';
            break;
          case 'dateOfBirth':
            aValue = a.dateOfBirth ? new Date(a.dateOfBirth).getTime() : 0;
            bValue = b.dateOfBirth ? new Date(b.dateOfBirth).getTime() : 0;
            break;
          case 'cnic':
            aValue = a.cnic?.toLowerCase() || '';
            bValue = b.cnic?.toLowerCase() || '';
            break;
          case 'package':
            const aPkg = availablePackages.find(p => String(p.id) === String(a.packageId));
            const bPkg = availablePackages.find(p => String(p.id) === String(b.packageId));
            aValue = aPkg?.name?.toLowerCase() || '';
            bValue = bPkg?.name?.toLowerCase() || '';
            break;
          case 'monthlyPayment':
            const aPkg2 = availablePackages.find(p => String(p.id) === String(a.packageId));
            const aTrainer = a.trainers.length > 0 ? trainers.find(t => String(t.id) === String(a.trainers[0].id)) : null;
            let aTotal = 0;
            if (aPkg2) {
              const aPackagePrice = aPkg2.discount && aPkg2.discount > 0
                ? Math.max(0, aPkg2.price - aPkg2.discount)
                : aPkg2.price;
              aTotal += aPkg2.duration.includes('12') ? aPackagePrice / 12 : aPackagePrice;
            }
            if (aTrainer?.charges) aTotal += aTrainer.charges;
            if (a.discount) aTotal = Math.max(0, aTotal - a.discount);
            
            const bPkg2 = availablePackages.find(p => String(p.id) === String(b.packageId));
            const bTrainer = b.trainers.length > 0 ? trainers.find(t => String(t.id) === String(b.trainers[0].id)) : null;
            let bTotal = 0;
            if (bPkg2) {
              const bPackagePrice = bPkg2.discount && bPkg2.discount > 0
                ? Math.max(0, bPkg2.price - bPkg2.discount)
                : bPkg2.price;
              bTotal += bPkg2.duration.includes('12') ? bPackagePrice / 12 : bPackagePrice;
            }
            if (bTrainer?.charges) bTotal += bTrainer.charges;
            if (b.discount) bTotal = Math.max(0, bTotal - b.discount);
            
            aValue = aTotal;
            bValue = bTotal;
            break;
          case 'trainer':
            const aTrainer2 = a.trainers.length > 0 ? trainers.find(t => String(t.id) === String(a.trainers[0].id)) : null;
            const bTrainer2 = b.trainers.length > 0 ? trainers.find(t => String(t.id) === String(b.trainers[0].id)) : null;
            aValue = aTrainer2?.name?.toLowerCase() || '';
            bValue = bTrainer2?.name?.toLowerCase() || '';
            break;
          case 'status':
            // Active sorts before Inactive on ascending order.
            aValue = a.isActive === false ? 1 : 0;
            bValue = b.isActive === false ? 1 : 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [members, searchQuery, sortConfig, availablePackages, trainers]);

  const handleExportExcel = () => {
    if (filteredMembers.length === 0) {
      showAlert('info', 'Nothing to export', 'No members match the current search.');
      return;
    }
    const headers = [
      'Member ID',
      'Name',
      'Phone',
      'Email',
      'Gender',
      'Date of Birth',
      'CNIC',
      'Package',
      'Monthly Payment',
      'Trainer',
      'Status',
      'Inactive From',
      'Billing Resume From',
    ];
    const excelDate = (value: unknown) => {
      const formatted = formatDate(value);
      return formatted === 'N/A' ? '' : formatted;
    };
    const rows = filteredMembers.map((member) => {
      const memberPackage = availablePackages.find((p) => String(p.id) === String(member.packageId));
      const memberTrainer =
        member.trainers.length > 0
          ? trainers.find((t) => String(t.id) === String(member.trainers[0].id))
          : null;
      const monthlyTotal = memberMonthlyPayment(member, availablePackages, trainers);
      return [
        displayMemberId(member) === '—' ? '' : displayMemberId(member),
        member.name,
        member.phone || '',
        member.email || '',
        member.gender || '',
        excelDate(member.dateOfBirth),
        member.cnic || '',
        memberPackage?.name || '',
        monthlyTotal > 0 ? Math.round(monthlyTotal) : 0,
        memberTrainer?.name || '',
        member.isActive === false ? 'Inactive' : 'Active',
        excelDate(member.inactiveFrom),
        excelDate(member.billingResumeFrom),
      ];
    });
    downloadExcelCsv(excelExportFilename('members'), headers, rows);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const discountAmount = Number(formData.discount);
      if (!Number.isNaN(discountAmount) && discountAmount > 0) {
        if (discountAmount > maxMemberDiscount) {
          showAlert(
            'error',
            'Discount too high',
            `Maximum member discount is Rs. ${maxMemberDiscount.toLocaleString()}. Change the limit in Settings if needed.`
          );
          return;
        }
      }

      setLoading(true);
      
      const memberData: any = {
        name: formData.name,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        gender: formData.gender || undefined,
        dateOfBirth: normalizeDateYmd(formData.dateOfBirth),
        cnic: formData.cnic ? formData.cnic.replace(/\D/g, '') : undefined,
        comments: formData.comments || undefined,
        packageId: normalizeId(formData.packageId),
        ...(!Number.isNaN(discountAmount) && discountAmount > 0
          ? { discount: discountAmount }
          : {}),
      };

      // Handle trainerIds differently for create vs update
      if (editingMember) {
        // When updating: always include trainerIds to explicitly set trainers
        // Empty array means remove all trainers, array with IDs means set those trainers
        memberData.trainerIds = formData.requiresTrainer && formData.trainerId 
          ? [normalizeId(formData.trainerId)].filter(Boolean)
          : []; // Empty array to remove all trainers
      } else {
        memberData.admissionFeeWaived = formData.admissionFeeWaived;
        const optionalMemberId = formData.legacyMemberId.trim();
        if (optionalMemberId) {
          // Backend expects gym-facing number as legacyMemberId; auto-assigns if omitted.
          memberData.legacyMemberId = /^\d+$/.test(optionalMemberId)
            ? Number(optionalMemberId)
            : optionalMemberId;
        }
        // When creating: only include trainerIds if a trainer is selected
        if (formData.requiresTrainer && formData.trainerId) {
          memberData.trainerIds = [normalizeId(formData.trainerId)].filter(Boolean);
        }
      }

      // Remove undefined fields (but keep empty arrays for trainerIds when updating)
      Object.keys(memberData).forEach(key => 
        memberData[key] === undefined && delete memberData[key]
      );

      if (editingMember) {
        // Update existing member
        console.log('🔵 Updating member:', editingMember.id);
        const response = await api.put(`/api/members/${editingMember.id}`, memberData);
        console.log('Update member response:', response.data);
        
        if (response.data.success) {
          showAlert('success', 'Member Updated', 'Member updated successfully!');
          await fetchMembers(); // Refresh list
          setEditingMember(null);
          resetForm();
        }
      } else {
        // Create new member
        // Set membership start date to today so first payment due date is the same day member was added
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day to avoid timezone issues
        memberData.membershipStartDate = today.toISOString();
        
        console.log('🔵 Creating new member');
        console.log('Membership start date (first payment due date):', memberData.membershipStartDate);
        console.log('Member data being sent:', JSON.stringify(memberData, null, 2));
        const response = await api.post('/api/members', memberData);
        console.log('Create member response:', response.data);
        
        if (response.data.success) {
          const created = response.data.data;
          const createdMember =
            created?.member && typeof created.member === 'object' ? created.member : created;
          const assignedNumber = displayMemberId(
            normalizeMemberNumberFields(
              (createdMember ?? {}) as Record<string, unknown>
            )
          );
          showAlert(
            'success',
            'Member Added',
            assignedNumber !== '—'
              ? `Member added successfully. Member ID: ${assignedNumber}`
              : 'Member added successfully!'
          );
          notifyDashboardStatsRefresh();
          setShowAddForm(false);
          
          // Try to refresh members list (don't block on error)
          try {
            await fetchMembers(); // Refresh list
          } catch (refreshError) {
            console.warn('Failed to refresh members list after creation:', refreshError);
            // Don't show error - member was created successfully
          }
          
          // Generate and print receipt (don't block on error)
          try {
            await handlePrintMemberReceipt(created, memberData, created);
          } catch (receiptError) {
            console.warn('Failed to print receipt:', receiptError);
            // Don't show error - member was created successfully, receipt is optional
          }
          
          resetForm();
        }
      }
    } catch (error: any) {
      console.error('Error saving member:', error);
      const backendMsg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        getErrorMessage(error);
      showAlert('error', 'Error', backendMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setShowAddForm(true);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingMember(null);
    setShowAddForm(false);
    resetForm();
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteDialog({
      isOpen: true,
      memberId: id,
      memberName: name,
    });
  };

  const handleDeleteConfirm = async () => {
    if (deleteDialog.memberId) {
      try {
        setLoading(true);
        console.log('🔵 Deleting member:', deleteDialog.memberId);
        const response = await api.delete(`/api/members/${deleteDialog.memberId}`);
        console.log('Delete member response:', response.data);
        
        if (response.data.success) {
          showAlert('success', 'Member Deleted', `Member "${deleteDialog.memberName}" has been deleted successfully.`);
          await fetchMembers(); // Refresh list
          setDeleteDialog({ isOpen: false, memberId: null, memberName: '' });
        }
      } catch (error: any) {
        console.error('Error deleting member:', error);
        showAlert('error', 'Error', getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, memberId: null, memberName: '' });
  };

  const openStatusDialog = (member: Member, action: MemberStatusActionKind) => {
    setStatusDialog({ isOpen: true, member, action });
    setStatusDateMode('today');
    setStatusCustomDate('');
  };

  const closeStatusDialog = () => {
    if (statusSubmitting) return;
    setStatusDialog({ isOpen: false, member: null, action: 'deactivate' });
    setStatusDateMode('today');
    setStatusCustomDate('');
  };

  const submitStatusAction = async () => {
    if (!statusDialog.member || statusSubmitting) return;
    const isCustom = statusDateMode === 'custom';
    if (isCustom) {
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(statusCustomDate) && !Number.isNaN(new Date(`${statusCustomDate}T00:00:00`).getTime());
      if (!valid) {
        showAlert('warning', 'Invalid date', 'Enter date in YYYY-MM-DD format.');
        return;
      }
    }
    try {
      setStatusSubmitting(true);
      const endpoint = statusDialog.action === 'deactivate' ? 'deactivate' : 'reactivate';
      const body = isCustom ? { effectiveDate: statusCustomDate } : {};
      const response = await api.patch(`/api/members/${statusDialog.member.id}/${endpoint}`, body);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || `Could not ${statusDialog.action} member`);
      }
      showAlert(
        'success',
        statusDialog.action === 'deactivate' ? 'Member deactivated' : 'Member reactivated',
        `${statusDialog.member.name} has been marked ${statusDialog.action === 'deactivate' ? 'inactive' : 'active'}.`
      );
      closeStatusDialog();
      await fetchMembers(searchQuery || undefined, sortConfig ? { key: sortConfig.key, direction: sortConfig.direction } : undefined);
      try {
        await api.get('/api/payments/member-summaries?onlyWithOpenInstallments=true&limit=1&page=1');
      } catch {
        /* best-effort warm refresh */
      }
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setStatusSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      legacyMemberId: '',
      phone: '',
      email: '',
      gender: '',
      dateOfBirth: '',
      cnic: '',
      comments: '',
      packageId: '',
      requiresTrainer: false,
      trainerId: '',
      discount: '',
      admissionFeeWaived: false,
    });
  };

  const handleCNICChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-numeric characters
    let value = e.target.value.replace(/\D/g, '');
    
    // Limit to 13 digits
    if (value.length > 13) {
      value = value.slice(0, 13);
    }
    
    // Format as XXXXX-XXXXXXX-X
    let formatted = value;
    if (value.length > 5) {
      formatted = value.slice(0, 5) + '-' + value.slice(5);
    }
    if (value.length > 12) {
      formatted = value.slice(0, 5) + '-' + value.slice(5, 12) + '-' + value.slice(12);
    }
    
    setFormData({ ...formData, cnic: formatted });
  };

  // Get selected package and trainer for display - recalculate on every render
  const selectedPackage = availablePackages.find(p => 
    String(p.id) === String(formData.packageId)
  ) || null;

  /** Active trainers plus the currently assigned trainer when editing (even if inactive). */
  const trainersForSelect = useMemo(() => {
    const active = trainers.filter((t) => t.isActive !== false);
    const assigned = editingMember?.trainers?.[0];
    if (!assigned) return active;
    if (active.some((t) => String(t.id) === String(assigned.id))) return active;
    // Not in the active list → treat as inactive for display, but keep selectable.
    return [{ ...assigned, isActive: false }, ...active];
  }, [trainers, editingMember]);

  const selectedTrainer = trainersForSelect.find(t => 
    String(t.id) === String(formData.trainerId)
  );
  const selectedTrainerIsInactive = Boolean(
    selectedTrainer && selectedTrainer.isActive === false
  );

  const signupFees = useMemo(() => {
    const pkg =
      availablePackages.find((p) => String(p.id) === String(formData.packageId)) ?? null;
    const trainerList =
      formData.requiresTrainer && formData.trainerId
        ? trainersForSelect.filter((t) => String(t.id) === String(formData.trainerId))
        : [];
    const admissionFeePaid = formData.admissionFeeWaived ? 0 : globalAdmissionAmount;
    const memberDiscount = parseFloat(formData.discount || '0') || 0;
    return computeSignupOneTimeFees({
      admissionFeePaid,
      packageData: pkg,
      trainers: trainerList,
      memberDiscount,
    });
  }, [
    formData.admissionFeeWaived,
    formData.packageId,
    formData.trainerId,
    formData.requiresTrainer,
    formData.discount,
    globalAdmissionAmount,
    availablePackages,
    trainersForSelect,
  ]);

  const oneTimePayment = signupFees.totalAmount;
  const monthlyPayment = signupFees.monthlyInstallmentAmount;

  const handlePrintMemberReceipt = async (member: any, memberData: any, createdPayload?: any) => {
    try {
      const root = createdPayload ?? member;
      const memberRecord =
        root?.member?.name != null ? root.member : root?.name ? root : member;
      const oneTimeFromApi = (root?.oneTimePayment ??
        root?.paymentSummary?.oneTimePayment ??
        member?.oneTimePayment) as
        | {
            id?: number;
            admissionFee?: number;
            packageFee?: number;
            trainerFee?: number;
            totalAmount?: number;
            memberDiscount?: number | null;
          }
        | undefined;

      if (oneTimeFromApi?.id) {
        const discountHint =
          Number(
            oneTimeFromApi.memberDiscount ??
              root?.discount ??
              memberRecord?.discount ??
              memberData?.discount
          ) || undefined;
        await printOneTimePaymentReceipt(
          oneTimeFromApi.id,
          {
            name: user?.name || user?.email || 'Staff',
            email: user?.email ?? null,
            role: user?.role ?? null,
          },
          memberRecord?.id,
          discountHint ? { memberDiscount: discountHint } : undefined
        );
        return;
      }
    } catch (error) {
      console.error('Error generating receipt:', error);
    }
  };

  const openAddForm = () => {
    setEditingMember(null);
    resetForm();
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showPageSkeleton = loading && members.length === 0;

  return (
    <Layout>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Member"
        message={`Are you sure you want to delete "${deleteDialog.memberName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      {statusDialog.isOpen && statusDialog.member && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/35" onClick={closeStatusDialog} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-dark-gray">
              {statusDialog.action === 'deactivate' ? 'Deactivate member' : 'Reactivate member'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {statusDialog.member.name}
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="statusDateMode"
                  checked={statusDateMode === 'today'}
                  onChange={() => setStatusDateMode('today')}
                />
                Effective from today
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="statusDateMode"
                  checked={statusDateMode === 'custom'}
                  onChange={() => setStatusDateMode('custom')}
                />
                Custom effective date
              </label>
              <input
                type="date"
                disabled={statusDateMode !== 'custom' || statusSubmitting}
                value={statusCustomDate}
                onChange={(e) => setStatusCustomDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:opacity-50"
              />
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={closeStatusDialog}
                disabled={statusSubmitting}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitStatusAction}
                disabled={statusSubmitting}
                className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
              >
                {statusSubmitting ? 'Saving…' : statusDialog.action === 'deactivate' ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-6 overflow-x-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold text-dark-gray">Members</h1>
            {!showAddForm && !editingMember && (
              showPageSkeleton ? (
                <PageHeaderActionsSkeleton />
              ) : (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 sm:w-auto"
                  >
                    Export to Excel
                  </button>
                  {canManage && (
                    <button
                      onClick={openAddForm}
                      className="w-full rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-opacity-90 sm:w-auto"
                    >
                      + Add Member
                    </button>
                  )}
                </div>
              )
            )}
          </div>

          {showPageSkeleton ? (
            <>
              <SearchBarSkeleton />
              <TableSkeleton rows={10} columns={canManage ? 9 : 8} />
            </>
          ) : (
            <>
          {/* Search/Filter */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by member ID / name, phone, or email… (Press Enter or click Go)"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <button
                onClick={() => setSearchQuery(searchInput)}
                className="w-full rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-opacity-90 sm:w-auto"
              >
                Go
              </button>
              {(searchQuery || searchInput) && (
                <button
                  onClick={handleClearSearch}
                  className="w-full px-4 py-2 text-left text-gray-600 hover:text-gray-800 sm:w-auto sm:text-center"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingMember) && (
            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-dark-gray">
                    {editingMember ? 'Edit Member' : 'Add New Member'}
                  </h2>
                  {editingMember && (
                    <p className="mt-1 text-sm text-gray-500">
                      Member ID:{' '}
                      <span className="font-medium text-dark-gray">{displayMemberId(editingMember)}</span>
                    </p>
                  )}
                </div>
              <button
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.name.length}/100 characters
                  </p>
                </div>
                {!editingMember && (
                  <div>
                    <label className="block text-sm font-medium text-dark-gray mb-1">
                      Member ID <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.legacyMemberId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          legacyMemberId: e.target.value.replace(/[^\d]/g, ''),
                        })
                      }
                      placeholder="Leave blank to auto-assign"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Gym-facing ID. If empty, the next number is assigned automatically.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Phone</label>
                  <input
                    type="tel"
                    maxLength={20}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="+923001234567"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.phone.length}/20 characters
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Email</label>
                  <input
                    type="email"
                    maxLength={255}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.email.length}/255 characters
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">CNIC</label>
                  <input
                    type="text"
                    placeholder="XXXXX-XXXXXXX-X"
                    value={formData.cnic}
                    onChange={handleCNICChange}
                    maxLength={15}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {formData.cnic && formData.cnic.replace(/\D/g, '').length < 13 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {13 - formData.cnic.replace(/\D/g, '').length} digits remaining
                    </p>
                  )}
                  {formData.cnic && formData.cnic.replace(/\D/g, '').length === 13 && (
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Valid CNIC format
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-gray mb-1">Select Package *</label>
                  <select
                    required
                    value={formData.packageId}
                    onChange={(e) => setFormData({ ...formData, packageId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select a package</option>
                    {availablePackages.map((pkg) => {
                      const finalPrice = pkg.discount && pkg.discount > 0 
                        ? Math.max(0, pkg.price - pkg.discount) 
                        : pkg.price;
                      return (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} - Rs. {finalPrice.toLocaleString()} {pkg.discount && pkg.discount > 0 ? `(Save ${pkg.discount.toLocaleString()})` : ''} ({pkg.duration})
                        </option>
                      );
                    })}
                  </select>
                  {selectedPackage && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-1">Package Features:</p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {selectedPackage.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center">
                            <span className="mr-2">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.requiresTrainer}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            requiresTrainer: e.target.checked,
                            trainerId: e.target.checked ? formData.trainerId : '',
                          });
                        }}
                        className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-dark-gray">Do you require a trainer?</span>
                    </label>
                  </div>
                  
                  {formData.requiresTrainer && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-dark-gray mb-1">Select Trainer *</label>
                        <select
                          required={formData.requiresTrainer}
                          value={formData.trainerId}
                          onChange={(e) => setFormData({ ...formData, trainerId: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="">Select a trainer</option>
                          {trainersForSelect.map((trainer) => {
                            const inactive = trainer.isActive === false;
                            return (
                              <option key={trainer.id} value={trainer.id}>
                                {trainer.name}
                                {trainer.specialization ? ` - ${trainer.specialization}` : ''}
                                {inactive ? ' (Inactive)' : ''}
                              </option>
                            );
                          })}
                        </select>
                        {selectedTrainerIsInactive && (
                          <p className="mt-1 text-xs text-amber-800">
                            This member&apos;s current trainer is inactive. You can keep them, clear the trainer, or pick an active trainer.
                          </p>
                        )}
                      </div>
                      
                      {selectedTrainer && selectedTrainer.charges && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-blue-900">Trainer Charges</p>
                              <p className="text-xs text-blue-700 mt-1">
                                {selectedTrainer.name} - {selectedTrainer.specialization || 'General Training'}
                                {selectedTrainerIsInactive && (
                                  <span className="ml-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                                    Inactive
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-blue-900">
                                Rs. {selectedTrainer.charges.toLocaleString()}
                              </p>
                              <p className="text-xs text-blue-700">per month</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Admission Amount Field */}
                <div className="md:col-span-2">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <label className="block text-sm font-medium text-dark-gray mb-1">
                          Admission Fee
                        </label>
                        <p className="text-xs text-gray-500">
                          One-time admission fee: <span className="font-semibold text-dark-gray">Rs. {globalAdmissionAmount.toLocaleString()}</span>
                          <span className="ml-2 text-blue-600 hover:text-blue-800">
                            <a href="/settings" className="underline">Change in Settings</a>
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.admissionFeeWaived}
                            onChange={(e) => {
                              setFormData({ ...formData, admissionFeeWaived: e.target.checked });
                            }}
                            className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                          <span className="text-sm font-medium text-dark-gray">Waive Admission Fee</span>
                        </label>
                      </div>
                    </div>
                    {formData.admissionFeeWaived && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                        <p className="text-xs text-yellow-800 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Admission fee will be waived for this member
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Discount Field */}
                {selectedPackage && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-dark-gray mb-1">
                      Discount (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={maxMemberDiscount}
                      step="100"
                      value={formData.discount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setFormData({ ...formData, discount: value });
                          return;
                        }
                        const parsed = parseFloat(value);
                        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= maxMemberDiscount) {
                          setFormData({ ...formData, discount: value });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="e.g., 200"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum Rs. {maxMemberDiscount.toLocaleString()} per member (
                      <a href="/settings" className="text-primary underline">
                        change in Settings
                      </a>
                      )
                    </p>
                    {formData.discount && parseFloat(formData.discount) > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        Discount of Rs. {parseFloat(formData.discount).toLocaleString()} will be applied
                      </p>
                    )}
                  </div>
                )}
                
                {/* Payment Summary */}
                <div className="md:col-span-2">
                  <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-5 text-white">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white opacity-90 mb-2">Payment Summary</p>
                        <div className="space-y-1 text-xs text-white opacity-80">
                          {/* Admission Fee */}
                          <div className="flex justify-between items-center pb-2 border-b border-white border-opacity-20">
                            <span>Admission fee:</span>
                            <span>
                              {formData.admissionFeeWaived ? (
                                <span className="text-yellow-200">Waived</span>
                              ) : (
                                <span>Rs. {signupFees.admissionFee.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                              )}
                            </span>
                          </div>
                          {formData.admissionFeeWaived && (
                            <div className="flex justify-between items-center text-yellow-200 pb-2 border-b border-white border-opacity-20">
                              <span className="flex items-center">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Admission Fee Waived
                              </span>
                              <span className="text-green-300">Rs. 0</span>
                            </div>
                          )}
                          {/* Monthly Payment Breakdown */}
                          <div className="pt-2 space-y-1">
                            {selectedPackage ? (() => {
                              const packagePrice = selectedPackage.discount && selectedPackage.discount > 0
                                ? Math.max(0, selectedPackage.price - selectedPackage.discount)
                                : selectedPackage.price;
                              const monthlyPackagePrice = selectedPackage.duration.includes('12')
                                ? packagePrice / 12
                                : packagePrice;
                              return (
                                <div>
                                  <div className="flex justify-between">
                                    <span>Package ({selectedPackage.name}):</span>
                                    <span>
                                      {selectedPackage.discount && selectedPackage.discount > 0 ? (
                                        <span>
                                          <span className="line-through text-white opacity-60 mr-2">
                                            Rs. {selectedPackage.duration.includes('12') 
                                              ? (selectedPackage.price / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })
                                              : selectedPackage.price.toLocaleString()}
                                          </span>
                                          <span>
                                            Rs. {monthlyPackagePrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                          </span>
                                        </span>
                                      ) : (
                                        <span>Rs. {monthlyPackagePrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                                      )}
                                    </span>
                                  </div>
                                  {selectedPackage.discount && selectedPackage.discount > 0 && (
                                    <div className="flex justify-between text-xs text-white opacity-80 mt-1">
                                      <span>Package Discount:</span>
                                      <span>Rs. {selectedPackage.discount.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })() : (
                              <div className="flex justify-between text-white opacity-60">
                                <span>Package:</span>
                                <span>Not selected</span>
                              </div>
                            )}
                            {selectedTrainer && selectedTrainer.charges ? (
                              <div className="flex justify-between pt-1">
                                <span>Trainer ({selectedTrainer.name}):</span>
                                <span>Rs. {selectedTrainer.charges.toLocaleString()}</span>
                              </div>
                            ) : formData.requiresTrainer && !selectedTrainer ? (
                              <div className="flex justify-between text-white opacity-60 pt-1">
                                <span>Trainer:</span>
                                <span>Not selected</span>
                              </div>
                            ) : null}
                            {formData.discount && parseFloat(formData.discount) > 0 && (
                              <div className="flex justify-between text-xs text-green-300 pt-1">
                                <span>Additional Discount:</span>
                                <span>- Rs. {parseFloat(formData.discount).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-white border-opacity-30 pt-5 text-left sm:text-right lg:ml-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                        {/* One-Time Payment */}
                        <div className="mb-4 pb-4 border-b border-white border-opacity-20">
                          <p className="text-xs text-white opacity-80 mb-1">One-Time Payment</p>
                          <p className="text-2xl font-bold">
                            Rs. {oneTimePayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </p>
                          <div className="text-xs text-white opacity-70 mt-1 space-y-0.5">
                            {!formData.admissionFeeWaived && signupFees.admissionFee > 0 && (
                              <div>Admission: Rs. {signupFees.admissionFee.toLocaleString()}</div>
                            )}
                            {formData.admissionFeeWaived && (
                              <div className="text-yellow-200">Admission fee waived</div>
                            )}
                            {monthlyPayment > 0 && (
                              <div>First month: Rs. {signupFees.firstMonthRecurring.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                            )}
                          </div>
                        </div>
                        {/* Monthly Payment */}
                        <div>
                          <p className="text-xs text-white opacity-80 mb-1">Total Monthly</p>
                          <p className="text-3xl font-bold">
                            Rs. {monthlyPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </p>
                          {monthlyPayment === 0 && !selectedPackage && !selectedTrainer && (
                            <p className="text-xs text-white opacity-60 mt-1">Select package or trainer</p>
                          )}
                          {monthlyPayment > 0 && (
                            <p className="text-xs text-white opacity-70 mt-1">Recurring monthly</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-gray mb-1">Comments</label>
                  <textarea
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    rows={4}
                    maxLength={1000}
                    placeholder="Add any additional comments or notes about this member..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.comments.length}/1000 characters
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:gap-4">
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-6 py-2 font-medium text-white transition-colors hover:bg-opacity-90"
                >
                  {editingMember ? 'Update Member' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg bg-gray-300 px-6 py-2 font-medium text-dark-gray transition-colors hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-light-gray">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Member ID</span>
                      {sortConfig?.key === 'id' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Name</span>
                      {sortConfig?.key === 'name' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('phone')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Contact</span>
                      {sortConfig?.key === 'phone' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('gender')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Gender</span>
                      {sortConfig?.key === 'gender' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('dateOfBirth')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date of Birth</span>
                      {sortConfig?.key === 'dateOfBirth' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('cnic')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>CNIC</span>
                      {sortConfig?.key === 'cnic' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('package')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Package</span>
                      {sortConfig?.key === 'package' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('monthlyPayment')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Monthly Payment</span>
                      {sortConfig?.key === 'monthlyPayment' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('trainer')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Trainer</span>
                      {sortConfig?.key === 'trainer' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      {sortConfig?.key === 'status' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  {canManage && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 12 : 11} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? 'No members found matching your search.' : 'No members found.'}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const memberPackage = availablePackages.find(p => String(p.id) === String(member.packageId));
                  const memberTrainer = member.trainers.length > 0 ? trainers.find(t => String(t.id) === String(member.trainers[0].id)) : null;
                  const inactiveFromText = formatDate(member.inactiveFrom);
                  const resumeFromText = formatDate(member.billingResumeFrom);
                  
                  // Calculate monthly payment for display (apply package discount)
                  let monthlyTotal = 0;
                  if (memberPackage) {
                    const packagePrice = memberPackage.discount && memberPackage.discount > 0
                      ? Math.max(0, memberPackage.price - memberPackage.discount)
                      : memberPackage.price;
                    monthlyTotal += memberPackage.duration.includes('12') 
                      ? packagePrice / 12 
                      : packagePrice;
                  }
                  if (memberTrainer && memberTrainer.charges) {
                    monthlyTotal += memberTrainer.charges;
                  }
                  // Apply discount
                  if (member.discount) {
                    monthlyTotal = Math.max(0, monthlyTotal - member.discount);
                  }
                  
                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className="text-sm font-medium text-dark-gray"
                          title={displayMemberId(member)}
                        >
                          {displayMemberId(member)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-dark-gray">{member.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.phone || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{member.email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.gender || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatDate(member.dateOfBirth)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.cnic || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">
                          {memberPackage ? (
                            <div>
                              <div className="font-medium">{memberPackage.name}</div>
                              {memberPackage.discount && memberPackage.discount > 0 ? (
                                <div className="text-xs">
                                  <span className="line-through text-gray-400">Rs. {memberPackage.price.toLocaleString()}</span>
                                  <span className="text-primary font-semibold ml-2">
                                    Rs. {Math.max(0, memberPackage.price - memberPackage.discount).toLocaleString()}
                                  </span>
                                  <div className="text-green-600 mt-0.5">Save Rs. {memberPackage.discount.toLocaleString()}</div>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400">Rs. {memberPackage.price.toLocaleString()}</div>
                              )}
                            </div>
                          ) : (
                            'No package'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary">
                          Rs. {monthlyTotal > 0 ? monthlyTotal.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}
                        </div>
                        <div className="text-xs text-gray-400">per month</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">
                          {memberTrainer ? (
                            <div>
                              <div>{memberTrainer.name}</div>
                              <div className="text-xs text-gray-400">Rs. {memberTrainer.charges?.toLocaleString()}/mo</div>
                            </div>
                          ) : (
                            'No trainer'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="space-y-1">
                          {statusBadge(member)}
                          {member.inactiveFrom && inactiveFromText !== 'N/A' && (
                            <div className="text-xs text-gray-500">Inactive from: {inactiveFromText}</div>
                          )}
                          {member.billingResumeFrom && resumeFromText !== 'N/A' && (
                            <div className="text-xs text-gray-500">Resumed billing: {resumeFromText}</div>
                          )}
                        </div>
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(member)}
                            className="text-blue hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(member.id, member.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => openStatusDialog(member, member.isActive === false ? 'reactivate' : 'deactivate')}
                            disabled={statusSubmitting}
                            className="ml-4 text-primary hover:text-primary-dark disabled:opacity-50"
                          >
                            {member.isActive === false ? 'Reactivate Member' : 'Deactivate Member'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
            </>
          )}
      </div>
    </Layout>
  );
}

