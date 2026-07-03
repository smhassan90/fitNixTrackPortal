import api from '@/lib/api';

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
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

export interface MemberInGym {
  memberId: number;
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
  memberName: string;
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
      address: gym.address != null ? String(gym.address) : null,
      phone: gym.phone != null ? String(gym.phone) : null,
      email: gym.email != null ? String(gym.email) : null,
    },
  };
}

function normalizeMemberInGym(row: unknown): MemberInGym | null {
  const o = asObj(row);
  if (!o || o.memberId == null) return null;
  return {
    memberId: Number(o.memberId),
    memberName: String(o.memberName ?? ''),
    contact: String(o.contact ?? o.phone ?? ''),
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
  return {
    memberId: Number(o.memberId),
    memberName: String(o.memberName ?? ''),
    phone: String(o.phone ?? o.contact ?? ''),
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

export function exportNoSignInCsv(report: NoSignInReport): void {
  const headers = ['Name', 'Phone', 'Last check-in', 'Days absent', 'Payment overdue'];
  const rows = report.members.map((m) => [
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
