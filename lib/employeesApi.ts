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

export type GymEmployee = {
  id: number;
  gymId?: number;
  employeeNumber?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  designation?: string | null;
  department?: string | null;
  dateOfJoining?: string | null;
  salary?: number | null;
  notes?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { attendanceRecords?: number };
};

export type GymEmployeePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type GymEmployeePayload = {
  name?: string;
  employeeNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | null;
  dateOfBirth?: string | null;
  designation?: string | null;
  department?: string | null;
  dateOfJoining?: string | null;
  salary?: number | null;
  notes?: string | null;
  isActive?: boolean;
};

function normalizeEmployee(row: unknown): GymEmployee | null {
  const o = asObj(row);
  if (!o) return null;
  const id = num(o.id);
  if (!id) return null;
  const countObj = asObj(o._count);
  return {
    id,
    gymId: o.gymId != null ? num(o.gymId) : undefined,
    employeeNumber: pickStr(o.employeeNumber) || null,
    name: pickStr(o.name) || '—',
    phone: pickStr(o.phone) || null,
    email: pickStr(o.email) || null,
    gender: pickStr(o.gender) || null,
    dateOfBirth: pickStr(o.dateOfBirth) || null,
    designation: pickStr(o.designation) || null,
    department: pickStr(o.department) || null,
    dateOfJoining: pickStr(o.dateOfJoining) || null,
    salary: o.salary != null && o.salary !== '' ? num(o.salary) : null,
    notes: pickStr(o.notes) || null,
    isActive: o.isActive !== false,
    createdAt: pickStr(o.createdAt) || undefined,
    updatedAt: pickStr(o.updatedAt) || undefined,
    _count: {
      attendanceRecords: countObj?.attendanceRecords != null ? num(countObj.attendanceRecords) : 0,
    },
  };
}

function normalizePagination(raw: unknown, page: number, limit: number): GymEmployeePagination {
  const o = asObj(raw);
  const p = asObj(o?.pagination) ?? o;
  return {
    page: num(p?.page, page),
    limit: num(p?.limit, limit),
    total: num(p?.total),
    totalPages: Math.max(1, num(p?.totalPages, 1)),
  };
}

export async function fetchEmployees(params: {
  search?: string;
  designation?: string;
  department?: string;
  isActive?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<{ employees: GymEmployee[]; pagination: GymEmployeePagination }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const res = await api.get('/api/employees', {
    params: {
      search: params.search || undefined,
      designation: params.designation || undefined,
      department: params.department || undefined,
      isActive:
        params.isActive === undefined ? undefined : params.isActive ? 'true' : 'false',
      createdFrom: params.createdFrom || undefined,
      createdTo: params.createdTo || undefined,
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
    : Array.isArray(root?.employees)
      ? root!.employees
      : [];
  return {
    employees: list.map(normalizeEmployee).filter((e): e is GymEmployee => e != null),
    pagination: normalizePagination(root?.pagination ?? root, page, limit),
  };
}

export async function fetchEmployee(id: number | string): Promise<GymEmployee> {
  const res = await api.get(`/api/employees/${id}`);
  const data = unwrapData(res.data);
  const root = asObj(data);
  const employee = normalizeEmployee(root?.employee ?? data);
  if (!employee) throw new Error('Employee not found');
  return employee;
}

export async function createEmployee(body: GymEmployeePayload): Promise<GymEmployee> {
  const res = await api.post('/api/employees', body);
  const data = unwrapData(res.data);
  const root = asObj(data);
  const employee = normalizeEmployee(root?.employee ?? data);
  if (!employee) throw new Error('Invalid create response');
  return employee;
}

export async function updateEmployee(
  id: number | string,
  body: GymEmployeePayload
): Promise<GymEmployee> {
  const res = await api.put(`/api/employees/${id}`, body);
  const data = unwrapData(res.data);
  const root = asObj(data);
  const employee = normalizeEmployee(root?.employee ?? data);
  if (!employee) throw new Error('Invalid update response');
  return employee;
}

export async function activateEmployee(id: number | string): Promise<void> {
  const res = await api.patch(`/api/employees/${id}/activate`);
  unwrapData(res.data);
}

export async function deactivateEmployee(id: number | string): Promise<void> {
  const res = await api.patch(`/api/employees/${id}/deactivate`);
  unwrapData(res.data);
}

export async function deleteEmployee(
  id: number | string
): Promise<{ message?: string; deletedAttendanceRecords?: number }> {
  const res = await api.delete(`/api/employees/${id}`);
  const data = unwrapData(res.data);
  const root = asObj(data) ?? {};
  return {
    message: pickStr(root.message) || undefined,
    deletedAttendanceRecords:
      root.deletedAttendanceRecords != null ? num(root.deletedAttendanceRecords) : undefined,
  };
}

export function employeeErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message || 'Something went wrong';
}
