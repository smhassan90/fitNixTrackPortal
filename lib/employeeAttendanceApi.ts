import api from '@/lib/api';

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function pickStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function unwrapData(body: unknown): unknown {
  const root = asObj(body);
  if (!root) return body;
  if (root.success === false) {
    const err = asObj(root.error);
    throw new Error(pickStr(err?.message) || 'Request failed');
  }
  return root.data ?? body;
}

export type EmployeeAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

export type EmployeeAttendanceSummary = {
  totalEmployees: number;
  recorded: number;
  present: number;
  late: number;
  absent: number;
  notMarked: number;
  checkedIn: number;
};

export type EmployeeDailyRosterRow = {
  employeeId: number;
  employeeNumber?: string | null;
  employee: string;
  designation?: string | null;
  department?: string | null;
  contact?: string | null;
  isActive: boolean;
  date: string;
  attendanceRecordId: number | null;
  status: EmployeeAttendanceStatus | null;
  checkIn?: string | null;
  checkOut?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  duration?: number | null;
  durationFormatted?: string | null;
  notes?: string | null;
  recorded: boolean;
};

export type EmployeeDailyAttendance = {
  date: string;
  summary: EmployeeAttendanceSummary;
  roster: EmployeeDailyRosterRow[];
};

export type EmployeeAttendanceOption = {
  id: number;
  employeeNumber?: string | null;
  name: string;
  designation?: string | null;
  department?: string | null;
  label: string;
  contact?: string | null;
};

export type EmployeeAttendanceRecord = {
  id: number;
  employeeId: number;
  employeeName?: string;
  employeeNumber?: string | null;
  designation?: string | null;
  date: string;
  status: EmployeeAttendanceStatus;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  durationFormatted?: string | null;
  notes?: string | null;
};

export type EmployeeAttendancePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function normalizeStatus(v: unknown): EmployeeAttendanceStatus | null {
  const s = pickStr(v).toUpperCase();
  if (s === 'PRESENT' || s === 'ABSENT' || s === 'LATE') return s;
  return null;
}

function normalizeSummary(raw: unknown): EmployeeAttendanceSummary {
  const o = asObj(raw) ?? {};
  return {
    totalEmployees: num(o.totalEmployees),
    recorded: num(o.recorded),
    present: num(o.present),
    late: num(o.late),
    absent: num(o.absent),
    notMarked: num(o.notMarked),
    checkedIn: num(o.checkedIn),
  };
}

function normalizeRosterRow(row: unknown, fallbackDate: string): EmployeeDailyRosterRow | null {
  const o = asObj(row);
  if (!o) return null;
  const employeeId = num(o.employeeId ?? asObj(o.employeeObj)?.id ?? asObj(o.Employee)?.id);
  if (!employeeId) return null;
  const empObj = asObj(o.employee);
  const employeeName =
    typeof o.employee === 'string'
      ? pickStr(o.employee)
      : pickStr(empObj?.name ?? o.employeeName ?? o.name);
  return {
    employeeId,
    employeeNumber: pickStr(o.employeeNumber ?? empObj?.employeeNumber) || null,
    employee: employeeName || '—',
    designation: pickStr(o.designation ?? empObj?.designation) || null,
    department: pickStr(o.department ?? empObj?.department) || null,
    contact: pickStr(o.contact ?? o.phone ?? empObj?.phone) || null,
    isActive: o.isActive !== false,
    date: pickStr(o.date) || fallbackDate,
    attendanceRecordId:
      o.attendanceRecordId != null && o.attendanceRecordId !== ''
        ? num(o.attendanceRecordId)
        : null,
    status: normalizeStatus(o.status),
    checkIn: pickStr(o.checkIn) || null,
    checkOut: pickStr(o.checkOut) || null,
    checkInTime: pickStr(o.checkInTime) || null,
    checkOutTime: pickStr(o.checkOutTime) || null,
    duration: o.duration != null ? num(o.duration) : null,
    durationFormatted: pickStr(o.durationFormatted) || null,
    notes: pickStr(o.notes) || null,
    recorded: o.recorded === true || o.attendanceRecordId != null,
  };
}

function normalizeRecord(row: unknown): EmployeeAttendanceRecord | null {
  const o = asObj(row);
  if (!o) return null;
  const id = num(o.id ?? o.attendanceRecordId);
  const employeeId = num(o.employeeId);
  const status = normalizeStatus(o.status);
  if (!id || !employeeId || !status) return null;
  return {
    id,
    employeeId,
    employeeName: pickStr(o.employeeName ?? o.employee ?? asObj(o.Employee)?.name) || undefined,
    employeeNumber: pickStr(o.employeeNumber) || null,
    designation: pickStr(o.designation) || null,
    date: pickStr(o.date),
    status,
    checkInTime: pickStr(o.checkInTime) || null,
    checkOutTime: pickStr(o.checkOutTime) || null,
    checkIn: pickStr(o.checkIn) || null,
    checkOut: pickStr(o.checkOut) || null,
    durationFormatted: pickStr(o.durationFormatted) || null,
    notes: pickStr(o.notes) || null,
  };
}

function normalizePagination(
  raw: unknown,
  page: number,
  limit: number
): EmployeeAttendancePagination {
  const o = asObj(raw);
  const p = asObj(o?.pagination) ?? o;
  return {
    page: num(p?.page, page),
    limit: num(p?.limit, limit),
    total: num(p?.total),
    totalPages: Math.max(1, num(p?.totalPages, 1)),
  };
}

export async function fetchEmployeeAttendanceDaily(params?: {
  date?: string;
  includeInactive?: boolean;
}): Promise<EmployeeDailyAttendance> {
  const res = await api.get('/api/employee-attendance/daily', {
    params: {
      date: params?.date || undefined,
      includeInactive: params?.includeInactive ? 'true' : 'false',
    },
  });
  const data = unwrapData(res.data);
  const root = asObj(data) ?? {};
  const date = pickStr(root.date) || params?.date || '';
  const rosterRaw = Array.isArray(root.roster) ? root.roster : [];
  return {
    date,
    summary: normalizeSummary(root.summary),
    roster: rosterRaw
      .map((row) => normalizeRosterRow(row, date))
      .filter((r): r is EmployeeDailyRosterRow => r != null),
  };
}

export async function fetchEmployeeAttendanceEmployees(): Promise<EmployeeAttendanceOption[]> {
  const res = await api.get('/api/employee-attendance/employees');
  const data = unwrapData(res.data);
  const root = asObj(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(root?.employees)
      ? root!.employees
      : [];
  const out: EmployeeAttendanceOption[] = [];
  for (const row of list) {
    const o = asObj(row);
    if (!o) continue;
    const id = num(o.id);
    if (!id) continue;
    const name = pickStr(o.name) || '—';
    out.push({
      id,
      employeeNumber: pickStr(o.employeeNumber) || null,
      name,
      designation: pickStr(o.designation) || null,
      department: pickStr(o.department) || null,
      label: pickStr(o.label) || name,
      contact: pickStr(o.contact ?? o.phone) || null,
    });
  }
  return out;
}

export async function fetchEmployeeAttendanceHistory(params: {
  employeeId?: number;
  startDate?: string;
  endDate?: string;
  status?: EmployeeAttendanceStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<{ records: EmployeeAttendanceRecord[]; pagination: EmployeeAttendancePagination }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const res = await api.get('/api/employee-attendance', {
    params: {
      employeeId: params.employeeId || undefined,
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
      status: params.status || undefined,
      sortBy: params.sortBy || undefined,
      sortOrder: params.sortOrder || undefined,
      page,
      limit,
    },
  });
  const data = unwrapData(res.data);
  const root = asObj(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(root?.records)
      ? root!.records
      : [];
  return {
    records: list.map(normalizeRecord).filter((r): r is EmployeeAttendanceRecord => r != null),
    pagination: normalizePagination(root?.pagination ?? root, page, limit),
  };
}

export async function markEmployeeAttendance(body: {
  employeeId: number;
  date: string;
  status: EmployeeAttendanceStatus;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  notes?: string | null;
}): Promise<EmployeeAttendanceRecord | null> {
  const res = await api.post('/api/employee-attendance/mark', body);
  const data = unwrapData(res.data);
  const root = asObj(data);
  return normalizeRecord(root?.record ?? data);
}

export async function bulkMarkEmployeeAttendance(body: {
  date: string;
  records: Array<{
    employeeId: number;
    status: EmployeeAttendanceStatus;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    notes?: string | null;
  }>;
}): Promise<{ date: string; marked: number }> {
  const res = await api.post('/api/employee-attendance/daily/bulk', body);
  const data = unwrapData(res.data);
  const root = asObj(data) ?? {};
  return {
    date: pickStr(root.date) || body.date,
    marked: num(root.marked, body.records.length),
  };
}

export function employeeAttendanceErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message || 'Something went wrong';
}
