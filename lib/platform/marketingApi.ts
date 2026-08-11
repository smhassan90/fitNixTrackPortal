import platformClient, { assertPlatformSuccess } from './platformClient';
import type { PlatformApiEnvelope } from './types';
import type {
  MarketingContent,
  MarketingContentsListData,
  MarketingContentUpdate,
  MarketingGenerateOpportunitiesResult,
  MarketingGymsListData,
  MarketingOpportunitiesListData,
  MarketingOpportunity,
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

/* ─── Phase 2 ─── */

export async function listMarketingOpportunities(
  gymId: string | number,
  params?: Record<string, string | number | undefined>
) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingOpportunitiesListData>>(
    `/api/platform/marketing/gyms/${gymId}/opportunities`,
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function getMarketingOpportunity(opportunityId: string | number) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingOpportunity>>(
    `/api/platform/marketing/opportunities/${opportunityId}`
  );
  return assertPlatformSuccess(res);
}

/** AI generates opportunity ideas from marketing profile — does not publish. */
export async function generateMarketingOpportunities(
  gymId: string | number,
  body?: { count?: number; focus?: string }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingGenerateOpportunitiesResult>>(
    `/api/platform/marketing/gyms/${gymId}/opportunities/generate`,
    body ?? {}
  );
  return assertPlatformSuccess(res);
}

export async function approveMarketingOpportunity(opportunityId: string | number) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingOpportunity>>(
    `/api/platform/marketing/opportunities/${opportunityId}/approve`,
    {}
  );
  return assertPlatformSuccess(res);
}

export async function rejectMarketingOpportunity(
  opportunityId: string | number,
  body?: { reason?: string }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingOpportunity>>(
    `/api/platform/marketing/opportunities/${opportunityId}/reject`,
    body ?? {}
  );
  return assertPlatformSuccess(res);
}

/** Generate a social post draft. Backend requires opportunity status APPROVED. */
export async function generateSocialPostFromOpportunity(
  opportunityId: string | number,
  body?: { notes?: string }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingContent>>(
    `/api/platform/marketing/opportunities/${opportunityId}/generate-social-post`,
    body ?? {}
  );
  return assertPlatformSuccess(res);
}

export async function listMarketingContents(
  gymId: string | number,
  params?: Record<string, string | number | undefined>
) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingContentsListData>>(
    `/api/platform/marketing/gyms/${gymId}/contents`,
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function getMarketingContent(contentId: string | number) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingContent>>(
    `/api/platform/marketing/contents/${contentId}`
  );
  return assertPlatformSuccess(res);
}

export async function updateMarketingContent(
  contentId: string | number,
  body: MarketingContentUpdate
) {
  const res = await platformClient.put<PlatformApiEnvelope<MarketingContent>>(
    `/api/platform/marketing/contents/${contentId}`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function submitMarketingContentForApproval(contentId: string | number) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingContent>>(
    `/api/platform/marketing/contents/${contentId}/submit-for-approval`,
    {}
  );
  return assertPlatformSuccess(res);
}

export async function approveMarketingContent(contentId: string | number) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingContent>>(
    `/api/platform/marketing/contents/${contentId}/approve`,
    {}
  );
  return assertPlatformSuccess(res);
}

export async function rejectMarketingContent(
  contentId: string | number,
  body?: { reason?: string }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingContent>>(
    `/api/platform/marketing/contents/${contentId}/reject`,
    body ?? {}
  );
  return assertPlatformSuccess(res);
}
