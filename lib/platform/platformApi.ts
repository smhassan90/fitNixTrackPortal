import type { AxiosError } from 'axios';
import platformClient, { assertPlatformSuccess } from './platformClient';
import type {
  CreateGymResponse,
  CreatePlatformUserResponse,
  PlatformApiEnvelope,
  PlatformAuditLogsData,
  PlatformBillingDuesData,
  PlatformGymsListData,
  PlatformLoginData,
  PlatformOperatorUser,
  PlatformPermissionsCatalogData,
  PlatformReportsSummary,
  PlatformTopGymsData,
  PlatformUser,
  PlatformUsersListData,
} from './types';
import { PlatformApiError } from './errors';

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (!local) return `***@${domain}`;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function platformAuthLogin(email: string, password: string): Promise<PlatformLoginData> {
  const endpoint = '/api/platform/auth/login';
  console.info('[platformAuthLogin] request', {
    endpoint,
    email: maskEmail(email),
  });
  try {
    const res = await platformClient.post<PlatformApiEnvelope<PlatformLoginData>>(
      endpoint,
      { email, password }
    );
    console.info('[platformAuthLogin] response', {
      endpoint,
      status: res.status,
      body: res.data,
    });
    if (!res.data.success) {
      const e = res.data.error;
      throw new PlatformApiError(res.status, e?.code, e?.message, e?.details);
    }
    return res.data.data;
  } catch (error) {
    const ax = error as AxiosError<ApiErrorBody>;
    const status = ax.response?.status ?? 0;
    const backendError = ax.response?.data?.error;
    console.error('[platformAuthLogin] failure', {
      endpoint,
      status,
      body: ax.response?.data,
      message: ax.message,
    });
    throw new PlatformApiError(
      status,
      backendError?.code,
      backendError?.message || ax.message || 'Platform login failed',
      backendError?.details
    );
  }
}

export async function platformAuthLogout(): Promise<void> {
  const res = await platformClient.post<PlatformApiEnvelope<unknown>>('/api/platform/auth/logout', {});
  if (!res.data.success) {
    const e = res.data.error;
    throw new PlatformApiError(res.status, e?.code, e?.message, e?.details);
  }
}

export async function platformAuthMe(): Promise<PlatformUser> {
  const res = await platformClient.get<PlatformApiEnvelope<PlatformUser>>('/api/platform/auth/me');
  return assertPlatformSuccess(res);
}

export async function listPlatformGyms(params: Record<string, string | number | undefined>) {
  const res = await platformClient.get<PlatformApiEnvelope<PlatformGymsListData>>(
    '/api/platform/gyms',
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function getPlatformGym(id: string | number) {
  const res = await platformClient.get<PlatformApiEnvelope<unknown>>(`/api/platform/gyms/${id}`);
  return assertPlatformSuccess(res);
}

export async function createPlatformGym(body: unknown) {
  const res = await platformClient.post<PlatformApiEnvelope<CreateGymResponse>>(
    '/api/platform/gyms',
    body
  );
  return assertPlatformSuccess(res);
}

export async function getPlatformLocationsCatalog() {
  const res = await platformClient.get<PlatformApiEnvelope<unknown>>('/api/platform/locations/catalog');
  return assertPlatformSuccess(res);
}

export async function patchPlatformGym(id: string | number, body: unknown) {
  const res = await platformClient.patch<PlatformApiEnvelope<unknown>>(
    `/api/platform/gyms/${id}`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function suspendPlatformGym(id: string | number) {
  const res = await platformClient.patch<PlatformApiEnvelope<unknown>>(
    `/api/platform/gyms/${id}/suspend`,
    {}
  );
  return assertPlatformSuccess(res);
}

export async function activatePlatformGym(id: string | number) {
  const res = await platformClient.patch<PlatformApiEnvelope<unknown>>(
    `/api/platform/gyms/${id}/activate`,
    {}
  );
  return assertPlatformSuccess(res);
}

export async function patchPlatformGymSubscription(id: string | number, body: unknown) {
  const res = await platformClient.patch<PlatformApiEnvelope<unknown>>(
    `/api/platform/gyms/${id}/subscription`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function recordPlatformGymPayment(id: string | number, body: unknown) {
  const res = await platformClient.post<PlatformApiEnvelope<unknown>>(
    `/api/platform/gyms/${id}/billing/payments`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function listPlatformBillingDues(params: Record<string, string | number | undefined>) {
  const res = await platformClient.get<PlatformApiEnvelope<PlatformBillingDuesData>>(
    '/api/platform/billing/dues',
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function listPlatformBillingPlans(params: Record<string, string | number | undefined> = {}) {
  const res = await platformClient.get<PlatformApiEnvelope<unknown>>('/api/platform/billing/plans', { params });
  return assertPlatformSuccess(res);
}

export async function createPlatformBillingPlan(body: unknown) {
  const res = await platformClient.post<PlatformApiEnvelope<unknown>>('/api/platform/admin/billing/plans', body);
  return assertPlatformSuccess(res);
}

export async function patchPlatformBillingPlan(id: string | number, body: unknown) {
  const res = await platformClient.patch<PlatformApiEnvelope<unknown>>(
    `/api/platform/admin/billing/plans/${id}`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function deletePlatformBillingPlan(id: string | number) {
  const res = await platformClient.delete<PlatformApiEnvelope<unknown>>(
    `/api/platform/admin/billing/plans/${id}`
  );
  return assertPlatformSuccess(res);
}

export async function listPlatformCountries() {
  const res = await platformClient.get<PlatformApiEnvelope<unknown>>('/api/platform/locations/countries');
  return assertPlatformSuccess(res);
}

export async function listPlatformCountryCities(countryId: string | number) {
  const res = await platformClient.get<PlatformApiEnvelope<unknown>>(
    `/api/platform/locations/countries/${countryId}/cities`
  );
  return assertPlatformSuccess(res);
}

export async function createPlatformCountry(body: unknown) {
  const res = await platformClient.post<PlatformApiEnvelope<unknown>>(
    '/api/platform/admin/locations/countries',
    body
  );
  return assertPlatformSuccess(res);
}

export async function patchPlatformCountry(id: string | number, body: unknown) {
  const res = await platformClient.patch<PlatformApiEnvelope<unknown>>(
    `/api/platform/admin/locations/countries/${id}`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function deletePlatformCountry(id: string | number) {
  const res = await platformClient.delete<PlatformApiEnvelope<unknown>>(
    `/api/platform/admin/locations/countries/${id}`
  );
  return assertPlatformSuccess(res);
}

export async function createPlatformCity(body: unknown) {
  const res = await platformClient.post<PlatformApiEnvelope<unknown>>('/api/platform/admin/locations/cities', body);
  return assertPlatformSuccess(res);
}

export async function patchPlatformCity(id: string | number, body: unknown) {
  const res = await platformClient.patch<PlatformApiEnvelope<unknown>>(
    `/api/platform/admin/locations/cities/${id}`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function deletePlatformCity(id: string | number) {
  const res = await platformClient.delete<PlatformApiEnvelope<unknown>>(
    `/api/platform/admin/locations/cities/${id}`
  );
  return assertPlatformSuccess(res);
}

export async function getPlatformReportsSummary(startDate: string, endDate: string) {
  const res = await platformClient.get<PlatformApiEnvelope<PlatformReportsSummary>>(
    '/api/platform/reports/summary',
    { params: { startDate, endDate } }
  );
  return assertPlatformSuccess(res);
}

export async function getPlatformTopGymsByMembers(limit = 10) {
  const res = await platformClient.get<PlatformApiEnvelope<PlatformTopGymsData>>(
    '/api/platform/reports/gyms/top-by-members',
    { params: { limit } }
  );
  return assertPlatformSuccess(res);
}

export async function listPlatformAuditLogs(params: Record<string, string | number | undefined>) {
  const res = await platformClient.get<PlatformApiEnvelope<PlatformAuditLogsData>>(
    '/api/platform/audit-logs',
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function listPlatformUsers(params: Record<string, string | number | undefined>) {
  const res = await platformClient.get<PlatformApiEnvelope<PlatformUsersListData>>(
    '/api/platform/users',
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function getPlatformOperatorUser(id: string | number) {
  const res = await platformClient.get<PlatformApiEnvelope<{ user: PlatformOperatorUser }>>(
    `/api/platform/users/${id}`
  );
  return assertPlatformSuccess(res);
}

export async function createPlatformUser(body: unknown) {
  const res = await platformClient.post<PlatformApiEnvelope<CreatePlatformUserResponse>>(
    '/api/platform/users',
    body
  );
  return assertPlatformSuccess(res);
}

export async function updatePlatformUser(id: string | number, body: unknown) {
  const res = await platformClient.patch<PlatformApiEnvelope<{ user: PlatformOperatorUser }>>(
    `/api/platform/users/${id}`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function deletePlatformUser(id: string | number) {
  const res = await platformClient.delete<PlatformApiEnvelope<unknown>>(`/api/platform/users/${id}`);
  return assertPlatformSuccess(res);
}

export async function listPlatformPermissionsCatalog() {
  const res = await platformClient.get<PlatformApiEnvelope<PlatformPermissionsCatalogData>>(
    '/api/platform/permissions'
  );
  return assertPlatformSuccess(res);
}
