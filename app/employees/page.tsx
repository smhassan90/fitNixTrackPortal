'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import Layout from '@/components/Layout';
import { FilterBarSkeleton, Skeleton, TableSkeleton } from '@/components/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { EMPLOYEE_PERMISSION_KEYS } from '@/lib/employeePermissions';
import {
  activateEmployee,
  createEmployee,
  deactivateEmployee,
  deleteEmployee,
  employeeErrorMessage,
  fetchEmployee,
  fetchEmployees,
  updateEmployee,
  type GymEmployee,
  type GymEmployeePayload,
} from '@/lib/employeesApi';
import { formatDate } from '@/lib/dateUtils';
import { getErrorMessage, isForbiddenError } from '@/lib/errorHandler';

type StatusFilter = 'all' | 'active' | 'inactive';

const EMAIL_MAX = 191;

const emptyForm = () => ({
  name: '',
  employeeNumber: '',
  phone: '',
  email: '',
  gender: '',
  dateOfBirth: '',
  designation: '',
  department: '',
  dateOfJoining: '',
  salary: '',
  notes: '',
});

function employeeToForm(e: GymEmployee) {
  return {
    name: e.name || '',
    employeeNumber: e.employeeNumber ?? '',
    phone: e.phone ?? '',
    email: e.email ?? '',
    gender: e.gender || '',
    dateOfBirth: e.dateOfBirth ? e.dateOfBirth.split('T')[0] : '',
    designation: e.designation || '',
    department: e.department || '',
    dateOfJoining: e.dateOfJoining ? e.dateOfJoining.split('T')[0] : '',
    salary: e.salary != null ? String(e.salary) : '',
    notes: e.notes || '',
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function EmployeesPage() {
  const { can } = useAuth();
  const canRead = can(EMPLOYEE_PERMISSION_KEYS.read);
  const canManage = can(EMPLOYEE_PERMISSION_KEYS.manage);
  const canDelete = can(EMPLOYEE_PERMISSION_KEYS.delete);
  const canAttendance = can(EMPLOYEE_PERMISSION_KEYS.attendanceRead);
  const showActions = canManage || canDelete;
  const { alert, showAlert, closeAlert } = useAlert();

  const [employees, setEmployees] = useState<GymEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GymEmployee | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [designationFilter, setDesignationFilter] = useState('');
  const [statusSubmittingId, setStatusSubmittingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    name: string;
  }>({ isOpen: false, id: null, name: '' });

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canRead) {
        setEmployees([]);
        if (!opts?.silent) setLoading(false);
        return;
      }
      try {
        if (!opts?.silent) setLoading(true);
        const result = await fetchEmployees({
          search: searchQuery || undefined,
          designation: designationFilter.trim() || undefined,
          isActive:
            statusFilter === 'all' ? undefined : statusFilter === 'active',
          sortBy: 'name',
          sortOrder: 'asc',
          page: 1,
          limit: 500,
        });
        setEmployees(result.employees);
      } catch (error: unknown) {
        if (!isForbiddenError(error)) {
          showAlert('error', 'Error', getErrorMessage(error) || employeeErrorMessage(error));
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [canRead, searchQuery, designationFilter, statusFilter, showAlert]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setFormData(emptyForm());
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEdit = async (employee: GymEmployee) => {
    setEditing(employee);
    setFormData(employeeToForm(employee));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const full = await fetchEmployee(employee.id);
      setEditing(full);
      setFormData(employeeToForm(full));
    } catch {
      /* list row still usable */
    }
  };

  const buildPayload = (): GymEmployeePayload => {
    const email = formData.email.trim().toLowerCase();
    const salaryRaw = formData.salary.trim();
    return {
      name: formData.name.trim(),
      employeeNumber: formData.employeeNumber.trim() || null,
      phone: formData.phone.trim() || null,
      email: email || null,
      gender: (formData.gender as GymEmployeePayload['gender']) || null,
      dateOfBirth: formData.dateOfBirth || null,
      designation: formData.designation.trim() || null,
      department: formData.department.trim() || null,
      dateOfJoining: formData.dateOfJoining || null,
      salary: salaryRaw ? Number(salaryRaw) : null,
      notes: formData.notes.trim() || null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    const name = formData.name.trim();
    if (!name) {
      showAlert('warning', 'Validation', 'Name is required.');
      return;
    }
    const email = formData.email.trim();
    if (email && (!isValidEmail(email) || email.length > EMAIL_MAX)) {
      showAlert('warning', 'Validation', 'Enter a valid email (max 191 characters).');
      return;
    }
    try {
      setLoading(true);
      const payload = buildPayload();
      if (editing) {
        await updateEmployee(editing.id, payload);
        showAlert('success', 'Employee updated', 'Changes saved.');
      } else {
        const created = await createEmployee(payload);
        showAlert(
          'success',
          'Employee added',
          `Created successfully. Employee ID for the attendance device: ${created.id}`
        );
      }
      setShowForm(false);
      resetForm();
      await load({ silent: true });
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error) || employeeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (employee: GymEmployee) => {
    if (!canManage || statusSubmittingId) return;
    const nextActive = employee.isActive === false;
    try {
      setStatusSubmittingId(employee.id);
      if (nextActive) await activateEmployee(employee.id);
      else await deactivateEmployee(employee.id);
      showAlert(
        'success',
        nextActive ? 'Activated' : 'Deactivated',
        `${employee.name} is now ${nextActive ? 'active' : 'inactive'}.`
      );
      await load({ silent: true });
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error) || employeeErrorMessage(error));
    } finally {
      setStatusSubmittingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.id || !canDelete) return;
    try {
      setLoading(true);
      const result = await deleteEmployee(deleteDialog.id);
      showAlert(
        'success',
        'Employee deleted',
        result.message ||
          `"${deleteDialog.name}" deleted${
            result.deletedAttendanceRecords
              ? ` (${result.deletedAttendanceRecords} attendance records removed)`
              : ''
          }.`
      );
      setDeleteDialog({ isOpen: false, id: null, name: '' });
      await load({ silent: true });
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error) || employeeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const showPageSkeleton = loading && employees.length === 0;

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
        onClose={() => setDeleteDialog({ isOpen: false, id: null, name: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete employee"
        message={`Delete "${deleteDialog.name}"? This also removes their attendance records. Prefer Deactivate if you may need them again.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-dark-gray">Employees</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gym staff roster (reception, cleaning, security, etc.). Separate from members and
              trainers. After you create an employee, use their Employee ID (auto-assigned) as the
              user ID / PIN on the attendance device.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canAttendance && (
              <Link
                href="/employee-attendance"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
              >
                Staff attendance
              </Link>
            )}
            {canManage && !showForm && (
              showPageSkeleton ? (
                <Skeleton className="h-10 w-36" />
              ) : (
                <button
                  type="button"
                  onClick={openAdd}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark active:bg-primary-dark"
                >
                  + Add employee
                </button>
              )
            )}
          </div>
        </div>

        {showForm && canManage && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-dark-gray">
                {editing ? 'Edit employee' : 'Add employee'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Name *</label>
                  <input
                    required
                    maxLength={100}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Employee ID</label>
                  {editing ? (
                    <>
                      <input
                        readOnly
                        value={editing.id}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 font-mono font-semibold text-dark-gray"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Auto-assigned. Enter this ID on the attendance device (user ID / PIN).
                      </p>
                    </>
                  ) : (
                    <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-500">
                      Assigned automatically after you save. Use that ID on the attendance device.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Staff code (optional)</label>
                  <input
                    maxLength={40}
                    value={formData.employeeNumber}
                    onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                    placeholder="Optional internal code"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Phone</label>
                  <input
                    type="tel"
                    maxLength={40}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    maxLength={EMAIL_MAX}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Date of birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Designation</label>
                  <input
                    maxLength={100}
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                    placeholder="Receptionist, Cleaner, Security…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Department</label>
                  <input
                    maxLength={100}
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Date of joining</label>
                  <input
                    type="date"
                    value={formData.dateOfJoining}
                    onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Salary</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Notes</label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary py-2 font-medium text-white hover:bg-primary-dark"
                >
                  {editing ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="flex-1 rounded-lg bg-gray-200 py-2 font-medium text-dark-gray hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showPageSkeleton ? (
          <>
            <FilterBarSkeleton fields={3} />
            <TableSkeleton rows={8} columns={showActions ? 8 : 7} />
          </>
        ) : (
          <>
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  placeholder="Search name, ID, phone, email…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(searchInput)}
                  className="flex-1 rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="Designation"
                  value={designationFilter}
                  onChange={(e) => setDesignationFilter(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm sm:w-40"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSearchQuery(searchInput)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  Go
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-light-gray">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                        Employee ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                        Designation
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                        Department
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                        Joined
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                        Status
                      </th>
                      {showActions && (
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employees.length === 0 ? (
                      <tr>
                        <td
                          colSpan={showActions ? 8 : 7}
                          className="px-4 py-10 text-center text-sm text-gray-500"
                        >
                          No employees found.
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => {
                        const active = emp.isActive !== false;
                        return (
                          <tr
                            key={emp.id}
                            className={active ? 'hover:bg-gray-50' : 'bg-gray-50/80 text-gray-500'}
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm font-semibold text-dark-gray">
                                {emp.id}
                              </span>
                              {emp.employeeNumber?.trim() ? (
                                <div className="text-xs text-gray-500">
                                  Code: {emp.employeeNumber.trim()}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-dark-gray">{emp.name}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              <div>{emp.phone || '—'}</div>
                              <div>{emp.email || '—'}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {emp.designation || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {emp.department || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {formatDate(emp.dateOfJoining)}
                            </td>
                            <td className="px-4 py-3">
                              {active ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                                  Inactive
                                </span>
                              )}
                            </td>
                            {showActions && (
                              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => void openEdit(emp)}
                                    className="mr-3 text-blue hover:text-blue-900"
                                  >
                                    Edit
                                  </button>
                                )}
                                {canManage && (
                                  <button
                                    type="button"
                                    disabled={statusSubmittingId === emp.id}
                                    onClick={() => void handleToggleActive(emp)}
                                    className="mr-3 text-primary hover:text-primary-dark disabled:opacity-50"
                                  >
                                    {statusSubmittingId === emp.id
                                      ? 'Saving…'
                                      : active
                                        ? 'Deactivate'
                                        : 'Activate'}
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteDialog({
                                        isOpen: true,
                                        id: emp.id,
                                        name: emp.name,
                                      })
                                    }
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Delete
                                  </button>
                                )}
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
