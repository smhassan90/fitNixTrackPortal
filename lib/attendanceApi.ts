import api from '@/lib/api';
import { displayMemberId, normalizeMemberNumberFields } from '@/lib/displayMemberId';
import { pickMemberPhotoUrl } from '@/lib/memberPhoto';
import { normalizeOverdueAlert, normalizeOverdueAlerts, type OverdueCheckinAlert } from '@/lib/overdueAlerts';
import { parseThemeFromUnknown, type GymThemeColors } from '@/lib/theme';

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

export interface AttendancePolicy {
  autoCheckoutHours: number;
  absenceInactiveDays: number | null;
  absenceInactiveEnabled: boolean;
}

/** Fallback when GET /api/settings omits maxMemberDiscount (legacy backend default). */
export const DEFAULT_MAX_MEMBER_DISCOUNT = 100;

export interface GymSettings {
  admissionFee: number;
  /** Max flat PKR discount allowed per member (monthly package + trainer fees). */
  maxMemberDiscount: number;
  autoCheckoutHours: number;
  absenceInactiveDays: number | null;
  attendancePolicy: AttendancePolicy;
  gym: {
    id: number;
    name: string;
    /** IANA timezone from GET /api/settings (e.g. Asia/Karachi). */
    timezone?: string | null;
    /** Gym logo URL for sidebar / receipts. */
    logoUrl?: string | null;
    /** Per-gym brand colors; defaults applied when omitted. */
    theme?: GymThemeColors;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

export interface MemberInGym {
  memberId: number;
  memberNumber: string | null;
  legacyMemberId: string | null;
  memberName: string;
  contact: string;
  checkInTime?: string | null;
  checkInFormatted: string | null;
  durationMinutes?: number | null;
  durationFormatted: string | null;
  hasOverduePayment: boolean;
  attendanceRecordId?: string;
}

export interface CurrentlyInGymResponse {
  count: number;
  overdueCount: number;
  policy: AttendancePolicy;
  members: MemberInGym[];
}

export interface RecentCheckInWithOverdue {
  memberId: number;
  memberName: string;
  /** Gym-formatted check-in (prefer for display). */
  checkInFormatted: string | null;
  /** Raw UTC ISO — do not show as-is. */
  checkInTime: string;
  durationFormatted: string;
  hasOverduePayment: boolean;
}

export interface DashboardAttendanceStats {
  currentlyInGym: number;
  currentlyInGymOverdueCount: number;
  recentCheckInsWithOverdue: RecentCheckInWithOverdue[];
  attendancePolicy: AttendancePolicy;
}

export interface NoSignInMember {
  memberId: number;
  memberNumber: string | null;
  legacyMemberId: string | null;
  memberName: string;
  photoUrl: string | null;
  phone: string;
  lastCheckInDate: string | null;
  daysSinceLastSignIn: number;
  hasOverduePayment: boolean;
}

export interface NoSignInReport {
  days: number;
  cutoffDate: string;
  total: number;
  members: NoSignInMember[];
}

export interface ApplyPoliciesResult {
  autoCheckedOut: number;
  markedInactive: number;
  message?: string;
}

function normalizePolicy(raw: unknown, fallback?: Partial<AttendancePolicy>): AttendancePolicy {
  const o = asObj(raw);
  const autoCheckoutHours =
    o?.autoCheckoutHours != null
      ? Number(o.autoCheckoutHours)
      : fallback?.autoCheckoutHours ?? 6;
  const absenceInactiveDays =
    o?.absenceInactiveDays != null && o.absenceInactiveDays !== ''
      ? Number(o.absenceInactiveDays)
      : fallback?.absenceInactiveDays ?? null;
  const absenceInactiveEnabled =
    o?.absenceInactiveEnabled === true ||
    (o?.absenceInactiveEnabled == null && absenceInactiveDays != null) ||
    fallback?.absenceInactiveEnabled === true;

  return {
    autoCheckoutHours: Math.min(24, Math.max(1, autoCheckoutHours || 6)),
    absenceInactiveDays:
      absenceInactiveDays != null && !Number.isNaN(absenceInactiveDays)
        ? absenceInactiveDays
        : null,
    absenceInactiveEnabled,
  };
}

export function normalizeGymSettings(raw: unknown): GymSettings {
  const o = asObj(raw) ?? {};
  const gym = asObj(o.gym) ?? {};
  const policy = normalizePolicy(o.attendancePolicy, {
    autoCheckoutHours: o.autoCheckoutHours != null ? Number(o.autoCheckoutHours) : 6,
    absenceInactiveDays:
      o.absenceInactiveDays != null && o.absenceInactiveDays !== ''
        ? Number(o.absenceInactiveDays)
        : null,
  });

  const maxMemberDiscountRaw = o.maxMemberDiscount;
  const maxMemberDiscount =
    maxMemberDiscountRaw != null && !Number.isNaN(Number(maxMemberDiscountRaw))
      ? Math.max(0, Number(maxMemberDiscountRaw))
      : DEFAULT_MAX_MEMBER_DISCOUNT;

  return {
    admissionFee: Number(o.admissionFee) || 0,
    maxMemberDiscount,
    autoCheckoutHours: policy.autoCheckoutHours,
    absenceInactiveDays: policy.absenceInactiveDays,
    attendancePolicy: policy,
    gym: {
      id: Number(gym.id) || 0,
      name: String(gym.name ?? ''),
      timezone: gym.timezone != null && String(gym.timezone).trim() !== '' ? String(gym.timezone) : null,
      logoUrl: pickGymLogoUrl(gym, o),
      theme: parseThemeFromUnknown(gym.theme ?? gym.brandColors ?? gym.colors ?? gym),
      address: gym.address != null ? String(gym.address) : null,
      phone: gym.phone != null ? String(gym.phone) : null,
      email: gym.email != null ? String(gym.email) : null,
    },
  };
}

function pickGymLogoUrl(...sources: Array<Record<string, unknown> | null>): string | null {
  for (const src of sources) {
    if (!src) continue;
    for (const key of ['logoUrl', 'logo', 'logo_url', 'imageUrl', 'image'] as const) {
      const v = src[key];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    const nestedLogo = asObj(src.logo);
    if (nestedLogo) {
      const nested =
        nestedLogo.url ?? nestedLogo.src ?? nestedLogo.href ?? nestedLogo.path;
      if (nested != null && String(nested).trim() !== '') return String(nested).trim();
    }
  }
  return null;
}

function normalizeMemberInGym(row: unknown): MemberInGym | null {
  const o = asObj(row);
  if (!o || o.memberId == null) return null;
  const nested = asObj(o.member);
  const nums = normalizeMemberNumberFields({
    memberNumber: o.memberNumber ?? nested?.memberNumber,
    legacyMemberId: o.legacyMemberId ?? nested?.legacyMemberId,
  });
  return {
    memberId: Number(o.memberId),
    memberNumber: nums.memberNumber,
    legacyMemberId: nums.legacyMemberId,
    memberName: String(o.memberName ?? nested?.name ?? ''),
    contact: String(o.contact ?? o.phone ?? nested?.phone ?? ''),
    checkInTime: o.checkInTime != null ? String(o.checkInTime) : null,
    checkInFormatted: o.checkInFormatted != null ? String(o.checkInFormatted) : null,
    durationMinutes: o.durationMinutes != null ? Number(o.durationMinutes) : null,
    durationFormatted: o.durationFormatted != null ? String(o.durationFormatted) : null,
    hasOverduePayment: o.hasOverduePayment === true,
    attendanceRecordId: o.attendanceRecordId != null ? String(o.attendanceRecordId) : undefined,
  };
}

export function normalizeCurrentlyInGym(raw: unknown): CurrentlyInGymResponse {
  const o = asObj(raw) ?? {};
  const members = (Array.isArray(o.members) ? o.members : [])
    .map(normalizeMemberInGym)
    .filter((m): m is MemberInGym => m != null);

  const sorted = [
    ...members.filter((m) => m.hasOverduePayment),
    ...members.filter((m) => !m.hasOverduePayment),
  ];

  return {
    count: Number(o.count) || sorted.length,
    overdueCount: Number(o.overdueCount) || sorted.filter((m) => m.hasOverduePayment).length,
    policy: normalizePolicy(o.policy ?? o.attendancePolicy),
    members: sorted,
  };
}

export function normalizeDashboardAttendanceStats(raw: Record<string, unknown>): DashboardAttendanceStats {
  const recent = (Array.isArray(raw.recentCheckInsWithOverdue) ? raw.recentCheckInsWithOverdue : [])
    .map((row) => {
      const o = asObj(row);
      if (!o) return null;
      return {
        memberId: Number(o.memberId),
        memberName: String(o.memberName ?? ''),
        checkInFormatted:
          o.checkInFormatted != null && String(o.checkInFormatted).trim() !== ''
            ? String(o.checkInFormatted)
            : o.checkIn != null && String(o.checkIn).trim() !== ''
              ? String(o.checkIn)
              : null,
        checkInTime: String(o.checkInTime ?? ''),
        durationFormatted: String(o.durationFormatted ?? ''),
        hasOverduePayment: o.hasOverduePayment === true,
      };
    })
    .filter((r): r is RecentCheckInWithOverdue => r != null);

  return {
    currentlyInGym: Number(raw.currentlyInGym) || 0,
    currentlyInGymOverdueCount: Number(raw.currentlyInGymOverdueCount) || 0,
    recentCheckInsWithOverdue: recent,
    attendancePolicy: normalizePolicy(raw.attendancePolicy, {
      autoCheckoutHours: raw.autoCheckoutHours != null ? Number(raw.autoCheckoutHours) : 6,
      absenceInactiveDays:
        raw.absenceInactiveDays != null && raw.absenceInactiveDays !== ''
          ? Number(raw.absenceInactiveDays)
          : null,
    }),
  };
}

function normalizeNoSignInMember(row: unknown): NoSignInMember | null {
  const o = asObj(row);
  if (!o || o.memberId == null) return null;
  const nested = asObj(o.member);
  const nums = normalizeMemberNumberFields({
    memberNumber: o.memberNumber ?? nested?.memberNumber,
    legacyMemberId: o.legacyMemberId ?? nested?.legacyMemberId,
  });
  return {
    memberId: Number(o.memberId),
    memberNumber: nums.memberNumber,
    legacyMemberId: nums.legacyMemberId,
    memberName: String(o.memberName ?? nested?.name ?? ''),
    photoUrl: pickMemberPhotoUrl(nested) ?? pickMemberPhotoUrl(o),
    phone: String(o.phone ?? o.contact ?? nested?.phone ?? ''),
    lastCheckInDate: o.lastCheckInDate != null ? String(o.lastCheckInDate) : null,
    daysSinceLastSignIn: Number(o.daysSinceLastSignIn) || 0,
    hasOverduePayment: o.hasOverduePayment === true,
  };
}

export function normalizeNoSignInReport(raw: unknown): NoSignInReport {
  const o = asObj(raw) ?? {};
  const members = (Array.isArray(o.members) ? o.members : [])
    .map(normalizeNoSignInMember)
    .filter((m): m is NoSignInMember => m != null);

  return {
    days: Number(o.days) || 2,
    cutoffDate: String(o.cutoffDate ?? ''),
    total: Number(o.total) || members.length,
    members,
  };
}

export async function fetchGymSettings(): Promise<GymSettings> {
  const res = await api.get('/api/settings');
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to load settings');
  }
  return normalizeGymSettings(res.data.data);
}

export type SaveAttendanceSettingsInput = {
  autoCheckoutHours: number;
  absenceInactiveDays: number | null;
};

export async function saveAttendanceSettings(input: SaveAttendanceSettingsInput): Promise<GymSettings> {
  const res = await api.put('/api/settings', {
    autoCheckoutHours: input.autoCheckoutHours,
    absenceInactiveDays: input.absenceInactiveDays,
  });
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to save attendance settings');
  }
  return normalizeGymSettings(res.data.data);
}

export async function fetchCurrentlyInGym(): Promise<CurrentlyInGymResponse> {
  const res = await api.get('/api/dashboard/currently-in-gym');
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to load currently in gym');
  }
  return normalizeCurrentlyInGym(res.data.data);
}

export async function fetchNoSignInReport(days = 2): Promise<NoSignInReport> {
  const res = await api.get(`/api/attendance/no-sign-in?days=${days}`);
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to load no sign-in report');
  }
  return normalizeNoSignInReport(res.data.data);
}

export async function applyAttendancePolicies(): Promise<ApplyPoliciesResult> {
  const res = await api.post('/api/attendance/apply-policies');
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to apply policies');
  }
  const o = asObj(res.data.data) ?? {};
  return {
    autoCheckedOut: Number(o.autoCheckedOut ?? o.autoCheckouts ?? 0),
    markedInactive: Number(o.markedInactive ?? o.inactivated ?? 0),
    message: res.data.message != null ? String(res.data.message) : undefined,
  };
}

export interface AttendanceSearchMember {
  id: number;
  name: string;
  memberNumber: string | null;
  legacyMemberId: string | null;
  phone: string;
  gender: string | null;
  photoUrl: string | null;
}

export interface ManualCheckInResult {
  message: string;
  checkInTime: string | null;
  checkInFormatted: string | null;
  attendanceRecordId: string | null;
  overdueAlerts: OverdueCheckinAlert[];
}

export interface ManualCheckOutResult {
  message: string;
  checkOutTime: string | null;
  checkOutFormatted: string | null;
  attendanceRecordId: string | null;
}

function normalizeAttendanceSearchMember(row: unknown): AttendanceSearchMember | null {
  const o = asObj(row);
  if (!o || o.id == null) return null;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  const nums = normalizeMemberNumberFields(o);
  const nested = asObj(o.member);
  return {
    id,
    name: String(o.name ?? nested?.name ?? ''),
    memberNumber: nums.memberNumber,
    legacyMemberId: nums.legacyMemberId,
    phone: String(o.phone ?? o.contact ?? nested?.phone ?? ''),
    gender: o.gender != null && o.gender !== '' ? String(o.gender) : nested?.gender != null ? String(nested.gender) : null,
    photoUrl: pickMemberPhotoUrl(o) ?? pickMemberPhotoUrl(nested),
  };
}

/** Search members by ID, phone, or name for manual check-in. */
export async function searchMembersForAttendance(query: string): Promise<AttendanceSearchMember[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await api.get('/api/members', { params: { search: q, limit: 20 } });
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to search members');
  }
  const root = asObj(res.data.data) ?? {};
  const list = Array.isArray(root.members) ? root.members : [];
  return list.map(normalizeAttendanceSearchMember).filter((m): m is AttendanceSearchMember => m != null);
}

/** Record a manual check-in when the attendance device is unavailable. */
export async function manualCheckIn(memberId: number): Promise<ManualCheckInResult> {
  const res = await api.post('/api/attendance/manual-check-in', {
    memberId,
    checkInTime: new Date().toISOString(),
  });
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to check in member');
  }
  const o = asObj(res.data.data) ?? {};
  const alertsFromArray = normalizeOverdueAlerts(o.overdueAlerts);
  const singleAlert = normalizeOverdueAlert(o.overdueAlert ?? o.alert);
  const overdueAlerts =
    alertsFromArray.length > 0
      ? alertsFromArray
      : singleAlert
        ? [singleAlert]
        : o.hasOverduePayment === true
          ? normalizeOverdueAlerts([
              {
                memberId,
                memberName: o.memberName,
                memberNumber: o.memberNumber,
                legacyMemberId: o.legacyMemberId,
                contact: o.contact ?? o.phone,
                checkInTime: o.checkInTime ?? new Date().toISOString(),
                overduePayment: o.overduePayment,
                ...asObj(o.overduePayment),
              },
            ])
          : [];
  return {
    message: String(o.message ?? res.data.message ?? 'Member checked in successfully.'),
    checkInTime: o.checkInTime != null ? String(o.checkInTime) : null,
    checkInFormatted: o.checkInFormatted != null ? String(o.checkInFormatted) : null,
    attendanceRecordId: o.attendanceRecordId != null ? String(o.attendanceRecordId) : o.id != null ? String(o.id) : null,
    overdueAlerts,
  };
}

/** Record a manual check-out when the attendance device is unavailable. */
export async function manualCheckOut(memberId: number): Promise<ManualCheckOutResult> {
  const res = await api.post('/api/attendance/manual-check-out', {
    memberId,
    checkOutTime: new Date().toISOString(),
  });
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to check out member');
  }
  const o = asObj(res.data.data) ?? {};
  return {
    message: String(o.message ?? res.data.message ?? 'Member checked out successfully.'),
    checkOutTime: o.checkOutTime != null ? String(o.checkOutTime) : null,
    checkOutFormatted: o.checkOutFormatted != null ? String(o.checkOutFormatted) : null,
    attendanceRecordId: o.attendanceRecordId != null ? String(o.attendanceRecordId) : o.id != null ? String(o.id) : null,
  };
}

export function exportNoSignInCsv(report: NoSignInReport): void {
  const headers = ['Member ID', 'Name', 'Phone', 'Last check-in', 'Days absent', 'Payment overdue'];
  const rows = report.members.map((m) => [
    displayMemberId(m) === '—' ? '' : displayMemberId(m),
    m.memberName,
    m.phone,
    m.lastCheckInDate ?? '',
    String(m.daysSinceLastSignIn),
    m.hasOverduePayment ? 'Yes' : 'No',
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `no-sign-in-${report.days}days-${report.cutoffDate || 'report'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
