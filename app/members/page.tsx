'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';

interface Trainer {
  id: string;
  name: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  specialization: string | null;
  charges?: number;
  startTime?: string;
  endTime?: string;
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
}

export default function MembersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { alert, showAlert, closeAlert } = useAlert();
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

  // Fetch admission fee from API
  useEffect(() => {
    const fetchAdmissionFee = async () => {
      try {
        const response = await api.get('/api/settings');
        if (response.data.success) {
          setGlobalAdmissionAmount(response.data.data.admissionFee || 0);
        }
      } catch (error) {
        console.warn('Could not fetch admission fee, using default:', error);
        setGlobalAdmissionAmount(0);
      }
    };
    fetchAdmissionFee();
  }, []);

  // Fetch members from API
  const fetchMembers = useCallback(async (search?: string, sort?: { key: string; direction: string }) => {
    try {
      setLoading(true);
      console.log('🔵 Fetching members from API...');
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (sort?.key) params.append('sortBy', sort.key);
      if (sort?.direction) params.append('sortOrder', sort.direction);
      params.append('limit', '1000');

      const response = await api.get(`/api/members?${params}`);
      console.log('Members API Response:', response.data);

      if (response.data.success) {
        const membersList = response.data.data.members || [];
        // Transform API response to match Member interface
        const transformedMembers: Member[] = membersList.map((m: any) => ({
          id: m.id,
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
        }));
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

  // Fetch trainers from API
  const fetchTrainers = useCallback(async () => {
    try {
      console.log('🔵 Fetching trainers from API...');
      const response = await api.get('/api/trainers?limit=1000');
      console.log('Trainers API Response:', response.data);

      if (response.data.success) {
        const trainersList = response.data.data.trainers || [];
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
          const idStr = member.id ? String(member.id).toLowerCase() : '';
          const nameStr = member.name ? member.name.toLowerCase() : '';
          const phoneStr = member.phone ? member.phone.toLowerCase() : '';
          const emailStr = member.email ? member.email.toLowerCase() : '';
          const cnicStr = member.cnic ? member.cnic.toLowerCase() : '';
          
          return idStr.includes(query) ||
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
            aValue = String(a.id || '').toLowerCase();
            bValue = String(b.id || '').toLowerCase();
            break;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const memberData: any = {
        name: formData.name,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        gender: formData.gender || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        cnic: formData.cnic ? formData.cnic.replace(/\D/g, '') : undefined,
        comments: formData.comments || undefined,
        packageId: formData.packageId || undefined,
        discount: formData.discount ? parseFloat(formData.discount) : undefined,
        admissionFeeWaived: formData.admissionFeeWaived,
      };

      // Handle trainerIds differently for create vs update
      if (editingMember) {
        // When updating: always include trainerIds to explicitly set trainers
        // Empty array means remove all trainers, array with IDs means set those trainers
        memberData.trainerIds = formData.requiresTrainer && formData.trainerId 
          ? [formData.trainerId] 
          : []; // Empty array to remove all trainers
      } else {
        // When creating: only include trainerIds if a trainer is selected
        if (formData.requiresTrainer && formData.trainerId) {
          memberData.trainerIds = [formData.trainerId];
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
          const createdMember = response.data.data.member;
          showAlert('success', 'Member Added', 'Member added successfully!');
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
            handlePrintMemberReceipt(createdMember, memberData);
          } catch (receiptError) {
            console.warn('Failed to print receipt:', receiptError);
            // Don't show error - member was created successfully, receipt is optional
          }
          
          resetForm();
        }
      }
    } catch (error: any) {
      console.error('Error saving member:', error);
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setShowAddForm(false);
    setFormData({
      name: member.name,
      phone: member.phone || '',
      email: member.email || '',
      gender: member.gender || '',
      dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
      cnic: member.cnic || '',
      comments: member.comments || '',
      packageId: member.packageId || '',
      requiresTrainer: member.trainers.length > 0,
      trainerId: member.trainers.length > 0 ? member.trainers[0].id : '',
      discount: member.discount?.toString() || '',
      admissionFeeWaived: member.admissionAmount === 0 || member.admissionAmount === null,
    });
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

  const resetForm = () => {
    setFormData({
      name: '',
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
  const selectedTrainer = trainers.find(t => 
    String(t.id) === String(formData.trainerId)
  );

  // Calculate one-time payment (admission fee + first month's payment)
  const oneTimePayment = useMemo(() => {
    let total = 0;
    
    // Add admission fee (unless waived)
    if (!formData.admissionFeeWaived) {
      total += globalAdmissionAmount;
    }
    
    // Add first month's payment (package + trainer - discounts)
    let monthlyTotal = 0;
    
    // Find selected package
    const pkg = availablePackages.find(p => 
      String(p.id) === String(formData.packageId)
    ) || null;
    
    if (pkg) {
      const packagePrice = pkg.discount && pkg.discount > 0
        ? Math.max(0, pkg.price - pkg.discount)
        : pkg.price;
      if (pkg.duration.includes('12')) {
        monthlyTotal += packagePrice / 12;
      } else {
        monthlyTotal += packagePrice;
      }
    }
    
    // Find selected trainer
    const trainer = trainers.find(t => 
      String(t.id) === String(formData.trainerId)
    );
    
    if (trainer && trainer.charges) {
      monthlyTotal += trainer.charges;
    }
    
    // Apply discount
    const discountAmount = parseFloat(formData.discount || '0');
    monthlyTotal = Math.max(0, monthlyTotal - discountAmount);
    
    // Add first month to one-time payment
    total += monthlyTotal;
    
    return total;
  }, [formData.admissionFeeWaived, formData.packageId, formData.trainerId, formData.discount, globalAdmissionAmount]);

  // Calculate monthly payment - recalculate whenever formData changes
  // Note: We access availablePackages and trainers from closure, but only depend on formData values
  const monthlyPayment = useMemo(() => {
    let total = 0;
    
    // Find selected package using current formData
    const pkg = availablePackages.find(p => 
      String(p.id) === String(formData.packageId)
    ) || null;
    
    // Package price (convert annual to monthly if needed, apply discount)
    if (pkg) {
      const packagePrice = pkg.discount && pkg.discount > 0
        ? Math.max(0, pkg.price - pkg.discount)
        : pkg.price;
      if (pkg.duration.includes('12')) {
        total += packagePrice / 12; // Annual package divided by 12
      } else {
        total += packagePrice;
      }
    }
    
    // Find selected trainer using current formData
    const trainer = trainers.find(t => 
      String(t.id) === String(formData.trainerId)
    );
    
    // Trainer charges
    if (trainer && trainer.charges) {
      total += trainer.charges;
    }
    
    // Apply discount
    const discountAmount = parseFloat(formData.discount || '0');
    total = Math.max(0, total - discountAmount);
    
    return total;
  }, [formData.packageId, formData.trainerId, formData.discount]);

  const handlePrintMemberReceipt = (member: any, memberData: any) => {
    try {
      // Get package and trainer info for receipt
      const pkg = availablePackages.find(p => String(p.id) === String(memberData.packageId));
      const trainer = trainers.find(t => String(t.id) === String(memberData.trainerId));
    
    // Calculate amounts
    let monthlyTotal = 0;
    if (pkg) {
      const packagePrice = pkg.discount && pkg.discount > 0
        ? Math.max(0, pkg.price - pkg.discount)
        : pkg.price;
      monthlyTotal += pkg.duration.includes('12') ? packagePrice / 12 : packagePrice;
    }
    if (trainer && trainer.charges) {
      monthlyTotal += trainer.charges;
    }
    const discountAmount = parseFloat(memberData.discount || '0');
    monthlyTotal = Math.max(0, monthlyTotal - discountAmount);
    
    // Get admission fee - check if it was waived (admissionAmount === 0) or use global amount
    const admissionFee = memberData.admissionFeeWaived 
      ? 0 
      : globalAdmissionAmount;
    const oneTimeTotal = admissionFee + monthlyTotal;
    
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Membership Receipt - ${member.name}</title>
          <style>
            @media print {
              @page { margin: 20mm; }
            }
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              color: #333;
              font-size: 28px;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            .receipt-info {
              margin-bottom: 30px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #eee;
            }
            .info-label {
              font-weight: bold;
              color: #333;
            }
            .info-value {
              color: #666;
            }
            .amount-section {
              background: #f5f5f5;
              padding: 20px;
              border-radius: 8px;
              margin: 30px 0;
            }
            .amount-row {
              display: flex;
              justify-content: space-between;
              font-size: 18px;
              margin: 10px 0;
            }
            .total {
              font-size: 24px;
              font-weight: bold;
              color: #333;
              border-top: 2px solid #333;
              padding-top: 10px;
              margin-top: 10px;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #eee;
              padding-top: 20px;
            }
            .status-badge {
              display: inline-block;
              padding: 5px 15px;
              background: #10b981;
              color: white;
              border-radius: 20px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>FitNixTrack Gym</h1>
            <p>Membership Receipt</p>
          </div>
          
          <div class="receipt-info">
            <div class="info-row">
              <span class="info-label">Receipt Number:</span>
              <span class="info-value">#${member.id}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${formatDate(new Date().toISOString())}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Member Name:</span>
              <span class="info-value">${member.name}</span>
            </div>
            ${member.phone ? `
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span class="info-value">${member.phone}</span>
            </div>
            ` : ''}
            ${member.email ? `
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${member.email}</span>
            </div>
            ` : ''}
            ${pkg ? `
            <div class="info-row">
              <span class="info-label">Package:</span>
              <span class="info-value">${pkg.name} (${pkg.duration})</span>
            </div>
            ` : ''}
            ${trainer ? `
            <div class="info-row">
              <span class="info-label">Trainer:</span>
              <span class="info-value">${trainer.name}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value"><span class="status-badge">ACTIVE</span></span>
            </div>
          </div>
          
          <div class="amount-section">
            <div class="amount-row">
              <span>Admission Fee:</span>
              <span>Rs. ${admissionFee.toFixed(2)}</span>
            </div>
            ${monthlyTotal > 0 ? `
            <div class="amount-row">
              <span>First Month Payment:</span>
              <span>Rs. ${monthlyTotal.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="amount-row total">
              <span>Total One-Time Payment:</span>
              <span>Rs. ${oneTimeTotal.toFixed(2)}</span>
            </div>
            ${monthlyTotal > 0 ? `
            <div class="amount-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ccc;">
              <span>Monthly Recurring Payment:</span>
              <span>Rs. ${monthlyTotal.toFixed(2)}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p>Thank you for joining FitNixTrack Gym!</p>
            <p>This is a computer-generated receipt.</p>
            <p>Generated on: ${formatDate(new Date().toISOString())}</p>
          </div>
        </body>
      </html>
    `;

    // Create a blob URL and open it in a new window
    const blob = new Blob([receiptHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (!printWindow) {
      showAlert('error', 'Print Error', 'Please allow popups for this site to print receipts.');
      URL.revokeObjectURL(url);
      return;
    }

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        // Clean up the blob URL after printing
        URL.revokeObjectURL(url);
      }, 250);
    };
    
    printWindow.onerror = () => {
      console.warn('Error opening print window');
      URL.revokeObjectURL(url);
    };
    } catch (error) {
      console.error('Error generating receipt:', error);
      // Don't throw - receipt printing failure shouldn't block member creation success
    }
  };

  const openAddForm = () => {
    setEditingMember(null);
    resetForm();
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading members..." />
      </Layout>
    );
  }

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
      <div className="space-y-6 overflow-x-hidden">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-dark-gray">Members</h1>
            {user?.role === 'GYM_ADMIN' && !showAddForm && !editingMember && (
              <button
                onClick={openAddForm}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
              >
                + Add Member
              </button>
            )}
          </div>

          {/* Search/Filter */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search members by name, phone, or email... (Press Enter or click Go)"
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
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Go
              </button>
              {(searchQuery || searchInput) && (
                <button
                  onClick={handleClearSearch}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingMember) && (
            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-dark-gray">
                {editingMember ? 'Edit Member' : 'Add New Member'}
              </h2>
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
                  <div className="flex items-center space-x-3 mb-4">
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
                          {trainers.map((trainer) => (
                            <option key={trainer.id} value={trainer.id}>
                              {trainer.name} {trainer.specialization ? `- ${trainer.specialization}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {selectedTrainer && selectedTrainer.charges && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-blue-900">Trainer Charges</p>
                              <p className="text-xs text-blue-700 mt-1">
                                {selectedTrainer.name} - {selectedTrainer.specialization || 'General Training'}
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
                    <div className="flex items-center justify-between mb-3">
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
                      <div className="flex items-center space-x-3">
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
                      max="999999"
                      step="100"
                      value={formData.discount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 999999)) {
                          setFormData({ ...formData, discount: value });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="e.g., 200"
                    />
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
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white opacity-90 mb-2">Payment Summary</p>
                        <div className="space-y-1 text-xs text-white opacity-80">
                          {/* Admission Fee */}
                          <div className="flex justify-between items-center pb-2 border-b border-white border-opacity-20">
                            <span>Admission Fee:</span>
                            <span>
                              {formData.admissionFeeWaived ? (
                                <span className="line-through opacity-60">Rs. {globalAdmissionAmount.toLocaleString()}</span>
                              ) : (
                                <span>Rs. {globalAdmissionAmount.toLocaleString()}</span>
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
                      <div className="text-right border-l border-white border-opacity-30 pl-5 ml-5">
                        {/* One-Time Payment */}
                        <div className="mb-4 pb-4 border-b border-white border-opacity-20">
                          <p className="text-xs text-white opacity-80 mb-1">One-Time Payment</p>
                          <p className="text-2xl font-bold">
                            Rs. {oneTimePayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </p>
                          <div className="text-xs text-white opacity-70 mt-1 space-y-0.5">
                            {!formData.admissionFeeWaived && (
                              <div>Admission: Rs. {globalAdmissionAmount.toLocaleString()}</div>
                            )}
                            {formData.admissionFeeWaived && (
                              <div className="text-yellow-200">Admission fee waived</div>
                            )}
                            {monthlyPayment > 0 && (
                              <div>First month: Rs. {monthlyPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
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
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="bg-primary text-white py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors font-medium"
                >
                  {editingMember ? 'Update Member' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-300 text-dark-gray py-2 px-6 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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
                      <span>ID</span>
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
                  {user?.role === 'GYM_ADMIN' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'GYM_ADMIN' ? 10 : 9} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? 'No members found matching your search.' : 'No members found.'}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const memberPackage = availablePackages.find(p => String(p.id) === String(member.packageId));
                  const memberTrainer = member.trainers.length > 0 ? trainers.find(t => String(t.id) === String(member.trainers[0].id)) : null;
                  
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
                          className="text-xs font-mono text-gray-600 truncate max-w-[120px]" 
                          title={member.id}
                        >
                          {member.id}
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
                      {user?.role === 'GYM_ADMIN' && (
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
      </div>
    </Layout>
  );
}

