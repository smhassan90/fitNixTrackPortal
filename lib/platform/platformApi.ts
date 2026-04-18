import platformClient, { assertPlatformSuccess } from './platformClient';
import type {
  CreateGymResponse,
  PlatformApiEnvelope,
  PlatformAuditLogsData,
  PlatformBillingDuesData,
  PlatformGymsListData,
  PlatformLoginData,
  PlatformReportsSummary,
  PlatformTopGymsData,
  PlatformUser,
} from './types';
import { PlatformApiError } from './errors';

export async function platformAuthLogin(email: string, password: string): Promise<PlatformLoginData> {
  const res = await platformClient.post<PlatformApiEnvelope<PlatformLoginData>>(
    '/api/platform/auth/login',
    { email, password }
  );
  if (!res.data.success) {
    const e = res.data.error;
    throw new PlatformApiError(res.status, e?.code, e?.message, e?.details);
  }
  return res.data.data;
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

export async function listPlatformBillingDues(params: Record<string, string | number | undefined>) {
  const res = await platformClient.get<PlatformApiEnvelope<PlatformBillingDuesData>>(
    '/api/platform/billing/dues',
    { params }
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
