import platformClient, { assertPlatformSuccess } from './platformClient';
import { PlatformApiError } from './errors';
import type { PlatformApiEnvelope } from './types';
import type {
  MarketingContent,
  MarketingContentsListData,
  MarketingContentUpdate,
  MarketingGenerateOpportunitiesResult,
  MarketingGymsListData,
  MarketingImageVersion,
  MarketingOpportunitiesListData,
  MarketingOpportunity,
  MarketingOverviewData,
  MarketingProfile,
  MarketingProfileUpdate,
  MarketingRegenerateImageMode,
  MarketingSocialAccount,
  MarketingSocialAccountsListData,
  MarketingSocialConnectResult,
  MarketingSocialPlatform,
  MarketingPlatformSettings,
  MarketingPlatformSettingsUpdate,
  MarketingPublishResult,
  MarketingScheduleResult,
  MarketingCalendarData,
  MarketingBlog,
  MarketingBlogsListData,
  MarketingBlogUpdate,
  MarketingAiUsageSummary,
  MarketingAuditLogData,
  MarketingPublishAttempt,
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

/* ─── Phase 3: image prompt + generation ─── */

/** AI (re)generates imageConcept + imagePrompt text only — does not create pixels. */
export async function generateMarketingImagePrompt(
  contentId: string | number,
  body?: { notes?: string }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingContent>>(
    `/api/platform/marketing/contents/${contentId}/generate-image-prompt`,
    body ?? {}
  );
  return assertPlatformSuccess(res);
}

/**
 * Generate an image from the reviewed prompt.
 * Creates a NEW MarketingImageVersion (never overwrites prior versions).
 */
export async function generateMarketingImage(
  contentId: string | number,
  body?: { prompt?: string }
) {
  const res = await platformClient.post<
    PlatformApiEnvelope<{ content: MarketingContent; imageVersion: MarketingImageVersion }>
  >(`/api/platform/marketing/contents/${contentId}/generate-image`, body ?? {});
  return assertPlatformSuccess(res);
}

export async function regenerateMarketingImage(
  contentId: string | number,
  body: { mode: MarketingRegenerateImageMode; instructions?: string; prompt?: string }
) {
  const res = await platformClient.post<
    PlatformApiEnvelope<{ content: MarketingContent; imageVersion: MarketingImageVersion }>
  >(`/api/platform/marketing/contents/${contentId}/regenerate-image`, body);
  return assertPlatformSuccess(res);
}

export async function listMarketingImageVersions(contentId: string | number) {
  const res = await platformClient.get<
    PlatformApiEnvelope<{ imageVersions: MarketingImageVersion[] }>
  >(`/api/platform/marketing/contents/${contentId}/images`);
  return assertPlatformSuccess(res);
}

export async function approveMarketingImageVersion(
  contentId: string | number,
  imageVersionId: string | number
) {
  const res = await platformClient.post<
    PlatformApiEnvelope<{ content: MarketingContent; imageVersion: MarketingImageVersion }>
  >(`/api/platform/marketing/contents/${contentId}/images/${imageVersionId}/approve`, {});
  return assertPlatformSuccess(res);
}

export async function rejectMarketingImageVersion(
  contentId: string | number,
  imageVersionId: string | number,
  body?: { reason?: string }
) {
  const res = await platformClient.post<
    PlatformApiEnvelope<{ content: MarketingContent; imageVersion: MarketingImageVersion }>
  >(
    `/api/platform/marketing/contents/${contentId}/images/${imageVersionId}/reject`,
    body ?? {}
  );
  return assertPlatformSuccess(res);
}

/* ─── Phase 4: social accounts (OAuth; tokens never returned) ─── */

export async function listMarketingSocialAccounts(gymId: string | number) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingSocialAccountsListData>>(
    `/api/platform/marketing/gyms/${gymId}/social-accounts`
  );
  return assertPlatformSuccess(res);
}

/**
 * Starts OAuth for a platform. Returns authorizeUrl — redirect the browser there.
 * Backend: POST /gyms/:gymId/social-accounts/connect  body: { platform }
 * Never returns access tokens.
 */
export async function connectMarketingSocialAccount(
  gymId: string | number,
  platform: MarketingSocialPlatform,
  _body?: { returnPath?: string }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingSocialConnectResult>>(
    `/api/platform/marketing/gyms/${gymId}/social-accounts/connect`,
    { platform }
  );
  return assertPlatformSuccess(res);
}

export async function disconnectMarketingSocialAccount(
  gymId: string | number,
  accountId: string | number
) {
  const res = await platformClient.delete<
    PlatformApiEnvelope<{ id: number; status: string }>
  >(`/api/platform/marketing/gyms/${gymId}/social-accounts/${accountId}`);
  return assertPlatformSuccess(res);
}

/** Re-list accounts for this gym (backend has no separate refresh-status route). */
export async function refreshMarketingSocialAccountStatus(
  gymId: string | number,
  accountId: string | number
) {
  const data = await listMarketingSocialAccounts(gymId);
  const updated = (data.accounts || []).find((a) => String(a.id) === String(accountId));
  if (!updated) {
    throw new PlatformApiError(404, 'NOT_FOUND', 'Social account not found');
  }
  return updated;
}

/* ─── Platform marketing settings (DB; no marketing env vars) ─── */

export async function getMarketingPlatformSettings() {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingPlatformSettings>>(
    '/api/platform/marketing/settings'
  );
  return assertPlatformSuccess(res);
}

export async function updateMarketingPlatformSettings(body: MarketingPlatformSettingsUpdate) {
  const res = await platformClient.put<PlatformApiEnvelope<MarketingPlatformSettings>>(
    '/api/platform/marketing/settings',
    body
  );
  return assertPlatformSuccess(res);
}

/* ─── Phase 5: publish / schedule / calendar ─── */

/** Explicit Super Admin action — never auto-called by AI. */
export async function publishMarketingContent(
  contentId: string | number,
  body: { socialAccountIds: number[] }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingPublishResult>>(
    `/api/platform/marketing/contents/${contentId}/publish`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function scheduleMarketingContent(
  contentId: string | number,
  body: { socialAccountIds: number[]; scheduledAt: string }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingScheduleResult>>(
    `/api/platform/marketing/contents/${contentId}/schedule`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function retryMarketingPublishAttempt(attemptId: string | number) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingPublishAttempt>>(
    `/api/platform/marketing/publish-attempts/${attemptId}/retry`,
    {}
  );
  return assertPlatformSuccess(res);
}

export async function listMarketingPublishAttempts(contentId: string | number) {
  const res = await platformClient.get<
    PlatformApiEnvelope<{ attempts: MarketingPublishAttempt[] }>
  >(`/api/platform/marketing/contents/${contentId}/publish-attempts`);
  return assertPlatformSuccess(res);
}

export async function getMarketingCalendar(
  params: Record<string, string | number | undefined>
) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingCalendarData>>(
    '/api/platform/marketing/calendar',
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function rescheduleMarketingContent(
  contentId: string | number,
  body: { scheduledAt: string }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingScheduleResult>>(
    `/api/platform/marketing/contents/${contentId}/reschedule`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function cancelMarketingSchedule(contentId: string | number) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingContent>>(
    `/api/platform/marketing/contents/${contentId}/cancel-schedule`,
    {}
  );
  return assertPlatformSuccess(res);
}

export async function duplicateMarketingContent(contentId: string | number) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingContent>>(
    `/api/platform/marketing/contents/${contentId}/duplicate`,
    {}
  );
  return assertPlatformSuccess(res);
}

/* ─── Phase 6: blogs & SEO ─── */

export async function listMarketingBlogs(
  gymId: string | number,
  params?: Record<string, string | number | undefined>
) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingBlogsListData>>(
    `/api/platform/marketing/gyms/${gymId}/blogs`,
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function getMarketingBlog(blogId: string | number) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingBlog>>(
    `/api/platform/marketing/blogs/${blogId}`
  );
  return assertPlatformSuccess(res);
}

export async function generateMarketingBlog(
  gymId: string | number,
  body?: { opportunityId?: number; topic?: string; targetKeyword?: string }
) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingBlog>>(
    `/api/platform/marketing/gyms/${gymId}/blogs/generate`,
    body ?? {}
  );
  return assertPlatformSuccess(res);
}

export async function updateMarketingBlog(blogId: string | number, body: MarketingBlogUpdate) {
  const res = await platformClient.put<PlatformApiEnvelope<MarketingBlog>>(
    `/api/platform/marketing/blogs/${blogId}`,
    body
  );
  return assertPlatformSuccess(res);
}

export async function approveMarketingBlog(blogId: string | number) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingBlog>>(
    `/api/platform/marketing/blogs/${blogId}/approve`,
    {}
  );
  return assertPlatformSuccess(res);
}

/** Publish into existing FitNixTrack website blog architecture — explicit click only. */
export async function publishMarketingBlogToWebsite(blogId: string | number) {
  const res = await platformClient.post<PlatformApiEnvelope<MarketingBlog>>(
    `/api/platform/marketing/blogs/${blogId}/publish-to-website`,
    {}
  );
  return assertPlatformSuccess(res);
}

/* ─── Phase 7: usage + marketing audit ─── */

export async function getMarketingAiUsage(params: Record<string, string | number | undefined>) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingAiUsageSummary>>(
    '/api/platform/marketing/usage',
    { params }
  );
  return assertPlatformSuccess(res);
}

export async function getMarketingAuditLog(params: Record<string, string | number | undefined>) {
  const res = await platformClient.get<PlatformApiEnvelope<MarketingAuditLogData>>(
    '/api/platform/marketing/audit-log',
    { params }
  );
  return assertPlatformSuccess(res);
}
