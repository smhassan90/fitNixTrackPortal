import platformClient, { assertPlatformSuccess } from './platformClient';
import type { PlatformApiEnvelope } from './types';
import type {
  MarketingGymsListData,
  MarketingOverviewData,
  MarketingProfile,
  MarketingProfileUpdate,
} from './marketingTypes';

/**
 * Platform marketing APIs — Super Admin only on the backend.
 * Base path: /api/platform/marketing/*
 */

export async function listMarketingGyms(params?: Record<string, string | number | undefined>) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingGymsListData>>(
    '/api/platform/marketing/gyms',
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function getMarketingOverview(gymId: string | number) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingOverviewData>>(
    `/api/platform/marketing/gyms/${gymId}/overview`
  );
  return assertPlatformSuccess(res);
}

export async function getMarketingProfile(gymId: string | number) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingProfile>>(
    `/api/platform/marketing/gyms/${gymId}/profile`
  );
  return assertPlatformSuccess(res);
}

export async function updateMarketingProfile(
  gymId: string | number,
  body: MarketingProfileUpdate
) {
  const res = await platformClient.put<PlatformApiEnvelope<MarketingProfile>>(
    `/api/platform/marketing/gyms/${gymId}/profile`,
    body
  );
  return assertPlatformSuccess(res);
}
