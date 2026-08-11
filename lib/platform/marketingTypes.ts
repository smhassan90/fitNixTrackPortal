/** Marketing domain types — Super Admin internal workstation */

/** Matches Prisma `MarketingOpportunityStatus` */
export type MarketingOpportunityStatus =
  | 'DRAFT'
  | 'AWAITING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED';

/** Matches Prisma `MarketingContentStatus` (extended for UI clarity) */
export type MarketingContentStatus =
  | 'DRAFT'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'REJECTED';

export type MarketingContentKind = 'SOCIAL_POST' | 'BLOG' | 'GOOGLE_BUSINESS' | string;

/** Gym row for marketing gym picker */
export interface MarketingGymSummary {
  id: number;
  name: string;
  slug?: string | null;
  city?: string | null;
  country?: string | null;
  tenantStatus?: 'ACTIVE' | 'SUSPENDED' | string;
  logoUrl?: string | null;
  hasMarketingProfile?: boolean;
  connectedAccountsCount?: number;
  [key: string]: unknown;
}

export interface MarketingGymsListData {
  gyms: MarketingGymSummary[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Marketing Profile — AI source of truth for a gym.
 * Empty / null = unknown; AI must not invent facts.
 */
export interface MarketingProfile {
  id?: number;
  gymId: number;
  gymName?: string;
  description?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  services?: string | null;
  membershipPackages?: string | null;
  targetAudience?: string | null;
  uniqueSellingPoints?: string | null;
  facilities?: string | null;
  trainers?: string | null;
  promotions?: string | null;
  brandTone?: string | null;
  preferredLanguage?: string | null;
  keywords?: string | null;
  seoTopics?: string | null;
  doNotClaim?: string | null;
  additionalInstructions?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type MarketingProfileUpdate = Partial<
  Omit<MarketingProfile, 'id' | 'gymId' | 'createdAt' | 'updatedAt' | 'gymName'>
>;

export interface MarketingOverviewAttentionItem {
  type: string;
  message: string;
  href?: string;
  severity?: 'info' | 'warning' | 'error';
}

export interface MarketingOverviewData {
  gym: {
    id: number;
    name: string;
    city?: string | null;
    country?: string | null;
    logoUrl?: string | null;
  };
  profileComplete: boolean;
  profileUpdatedAt?: string | null;
  contentThisMonth: {
    socialPosts: number;
    blogs: number;
    googleBusinessPosts: number;
    scheduledPosts: number;
    publishedPosts: number;
    failedPosts: number;
  };
  aiActivity: {
    textGenerations: number;
    imageGenerations: number;
    estimatedCostUsd?: number | null;
  };
  attention: MarketingOverviewAttentionItem[];
  recommendations: string[];
  connectedAccountsCount: number;
  opportunitiesAwaitingReview: number;
  postsAwaitingApproval: number;
}

/* ─── Phase 2: opportunities + social content ─── */

export interface MarketingOpportunity {
  id: number;
  gymId: number;
  title: string;
  reason?: string | null;
  audience?: string | null;
  /** e.g. SOCIAL_POST | BLOG | GOOGLE_BUSINESS */
  contentType?: string | null;
  suggestedPlatform?: string | null;
  seoIntent?: string | null;
  priority?: number;
  keywords?: string | null;
  status: MarketingOpportunityStatus;
  createdAt?: string;
  updatedAt?: string;
  /** Linked content count when list includes it */
  contentsCount?: number;
}

export interface MarketingOpportunitiesListData {
  opportunities: MarketingOpportunity[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MarketingGenerateOpportunitiesResult {
  opportunities: MarketingOpportunity[];
  generatedCount: number;
  provider?: string;
  model?: string;
}

/** Platform-specific caption variants (not published until later phases). */
export interface MarketingPlatformVariants {
  facebook?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  googleBusiness?: string | null;
  [key: string]: string | null | undefined;
}

/**
 * Image version statuses (align with Prisma after Phase 3 migration).
 * READY = successfully generated (product “GENERATED”).
 */
export type MarketingImageStatus =
  | 'PENDING'
  | 'READY'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED';

export interface MarketingImageVersion {
  id: number;
  contentId: number;
  prompt?: string | null;
  modifiedPrompt?: string | null;
  imageUrl?: string | null;
  status: MarketingImageStatus;
  provider?: string | null;
  model?: string | null;
  createdAt?: string;
}

export interface MarketingContent {
  id: number;
  gymId: number;
  opportunityId?: number | null;
  title: string;
  status: MarketingContentStatus;
  /** SOCIAL_POST etc. */
  contentKind?: MarketingContentKind | null;
  topic?: string | null;
  headline?: string | null;
  caption?: string | null;
  captionShort?: string | null;
  cta?: string | null;
  hashtags?: string | null;
  imageConcept?: string | null;
  /** Editable prompt — reviewed before Generate Image */
  imagePrompt?: string | null;
  suggestedPlatforms?: string[] | string | null;
  platformVariants?: MarketingPlatformVariants | null;
  opportunity?: Pick<MarketingOpportunity, 'id' | 'title' | 'status'> | null;
  /** Newest first when returned by GET content / list images */
  imageVersions?: MarketingImageVersion[];
  approvedImageVersionId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingContentUpdate {
  title?: string;
  topic?: string | null;
  headline?: string | null;
  caption?: string | null;
  captionShort?: string | null;
  cta?: string | null;
  hashtags?: string | null;
  imageConcept?: string | null;
  imagePrompt?: string | null;
  suggestedPlatforms?: string[] | string | null;
  platformVariants?: MarketingPlatformVariants | null;
}

export interface MarketingContentsListData {
  contents: MarketingContent[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const OPPORTUNITY_STATUS_LABELS: Record<MarketingOpportunityStatus, string> = {
  DRAFT: 'Draft',
  AWAITING_REVIEW: 'Awaiting review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CONVERTED: 'Converted',
};

export const CONTENT_STATUS_LABELS: Record<MarketingContentStatus, string> = {
  DRAFT: 'Draft',
  AWAITING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
};

export const IMAGE_STATUS_LABELS: Record<MarketingImageStatus, string> = {
  PENDING: 'Pending',
  READY: 'Generated',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  FAILED: 'Failed',
};

export type MarketingRegenerateImageMode = 'quick' | 'custom';

/* ─── Phase 4: social connections ─── */

/** Supported now; extras reserved for later providers. */
export type MarketingSocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'google_business'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | string;

export type MarketingSocialAccountStatus =
  | 'DISCONNECTED'
  | 'CONNECTED'
  | 'ERROR'
  | 'PENDING';

/** Safe DTO — never includes access/refresh tokens. */
export interface MarketingSocialAccount {
  id: number;
  gymId: number;
  platform: MarketingSocialPlatform;
  accountName?: string | null;
  /** Optional page/profile handle or external id for display */
  externalAccountId?: string | null;
  status: MarketingSocialAccountStatus;
  connectedAt?: string | null;
  lastPublishAt?: string | null;
  tokenExpiresAt?: string | null;
  /** Human-readable status detail when ERROR (e.g. expired auth) */
  statusMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingSocialAccountsListData {
  accounts: MarketingSocialAccount[];
}

export interface MarketingSocialConnectResult {
  /** Browser redirect URL for OAuth authorize */
  authorizeUrl: string;
  platform: MarketingSocialPlatform;
  /** Optional pending account id while OAuth completes */
  accountId?: number | null;
}

export const MARKETING_SOCIAL_PLATFORMS: {
  id: MarketingSocialPlatform;
  label: string;
  description: string;
  available: boolean;
}[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    description: 'Facebook Pages via official Graph API OAuth',
    available: true,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    description: 'Instagram Business/Creator accounts linked to a Page',
    available: true,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    description: 'LinkedIn organization/page posting',
    available: true,
  },
  {
    id: 'google_business',
    label: 'Google Business Profile',
    description: 'Local business posts via Google Business Profile API',
    available: true,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    description: 'Coming later',
    available: false,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    description: 'Coming later',
    available: false,
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    description: 'Coming later',
    available: false,
  },
];

export const SOCIAL_ACCOUNT_STATUS_LABELS: Record<MarketingSocialAccountStatus, string> = {
  DISCONNECTED: 'Not connected',
  CONNECTED: 'Connected',
  ERROR: 'Needs attention',
  PENDING: 'Connecting…',
};

/* ─── Platform marketing settings (DB-backed; Super Admin managed) ─── */

/** Masked secret as returned by API — never full key unless just set (still prefer mask). */
export interface MarketingSecretField {
  /** True when a non-empty secret is stored */
  configured: boolean;
  /** e.g. "••••ab12" or null when empty */
  hint?: string | null;
}

export interface MarketingAiSettings {
  provider: string;
  textModel: string;
  imageModel: string;
  apiKey: MarketingSecretField;
  /** Optional base URL for compatible providers */
  baseUrl?: string | null;
  enabled: boolean;
}

export interface MarketingOAuthAppSettings {
  platform: MarketingSocialPlatform;
  clientId: string;
  clientSecret: MarketingSecretField;
  /** Full callback URL registered with the provider (stored in DB) */
  redirectUri: string;
  enabled: boolean;
  /** Extra non-secret notes / scopes display */
  notes?: string | null;
}

/**
 * Platform-wide marketing configuration.
 * All provider credentials live in DB — not backend env vars.
 */
export interface MarketingPlatformSettings {
  ai: MarketingAiSettings;
  oauthApps: MarketingOAuthAppSettings[];
  updatedAt?: string | null;
}

/** PUT body: omit secret fields or send empty string to leave unchanged; non-empty replaces. */
export interface MarketingPlatformSettingsUpdate {
  ai?: {
    provider?: string;
    textModel?: string;
    imageModel?: string;
    /** Set only when rotating; omit/empty = keep existing */
    apiKey?: string | null;
    baseUrl?: string | null;
    enabled?: boolean;
  };
  oauthApps?: Array<{
    platform: MarketingSocialPlatform;
    clientId?: string;
    clientSecret?: string | null;
    redirectUri?: string;
    enabled?: boolean;
    notes?: string | null;
  }>;
}

/* ─── Phase 5: publish / schedule / calendar ─── */

export type MarketingPublishAttemptStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface MarketingPublishAttempt {
  id: number;
  gymId: number;
  contentId?: number | null;
  socialAccountId?: number | null;
  platform?: string | null;
  accountName?: string | null;
  status: MarketingPublishAttemptStatus;
  externalId?: string | null;
  errorMessage?: string | null;
  attemptedAt?: string;
  createdAt?: string;
}

export interface MarketingPublishResult {
  content: MarketingContent;
  attempts: MarketingPublishAttempt[];
  /** True only if every selected platform succeeded */
  allSucceeded: boolean;
}

export interface MarketingScheduleResult {
  content: MarketingContent;
  scheduledAt: string;
  selectedAccountIds: number[];
}

export interface MarketingCalendarItem {
  id: number;
  contentId: number;
  gymId: number;
  gymName?: string;
  title: string;
  platform?: string | null;
  status: MarketingContentStatus | string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  contentKind?: string | null;
}

export interface MarketingCalendarData {
  items: MarketingCalendarItem[];
  view?: 'month' | 'week' | 'list';
  rangeStart?: string;
  rangeEnd?: string;
}

/* ─── Phase 6: blogs & SEO (FitNixTrack website integration) ─── */

export type MarketingBlogStatus =
  | 'DRAFT'
  | 'AWAITING_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED';

/** Matches public website BlogSection shape for export. */
export interface MarketingBlogSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  subheadings?: { heading: string; paragraphs: string[] }[];
}

export interface MarketingBlog {
  id: number;
  gymId?: number | null;
  /** FitNixTrack site blogs may be platform-level (null gym) or gym-scoped */
  title: string;
  slug: string;
  excerpt?: string | null;
  introduction?: string | null;
  /** Structured body preferred for website posts.ts shape */
  sections?: MarketingBlogSection[] | null;
  /** Optional freeform markdown/HTML body if used */
  body?: string | null;
  conclusion?: string | null;
  cta?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  targetKeyword?: string | null;
  secondaryKeywords?: string | null;
  internalLinks?: string | null;
  externalReferences?: string | null;
  featuredImageUrl?: string | null;
  imageAlt?: string | null;
  author?: string | null;
  category?: string | null;
  faqJson?: unknown;
  status: MarketingBlogStatus;
  publishedAt?: string | null;
  /** When published to fitnixTrack_website architecture */
  websitePublished?: boolean;
  readingTimeMinutes?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingBlogsListData {
  blogs: MarketingBlog[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type MarketingBlogUpdate = Partial<
  Omit<MarketingBlog, 'id' | 'createdAt' | 'updatedAt' | 'websitePublished'>
>;

/* ─── Phase 7: usage + audit ─── */

export interface MarketingAiUsageRow {
  id: number;
  gymId: number;
  gymName?: string;
  platformUserId?: number | null;
  operationType: string;
  provider?: string | null;
  model?: string | null;
  tokens?: number | null;
  costUsd?: number | null;
  createdAt: string;
}

export interface MarketingAiUsageSummary {
  gymId?: number;
  periodStart: string;
  periodEnd: string;
  textRequests: number;
  imageGenerations: number;
  blogGenerations: number;
  opportunityGenerations?: number;
  estimatedCostUsd: number;
  byOperation?: Record<string, number>;
  rows?: MarketingAiUsageRow[];
}

export interface MarketingAuditLogRow {
  id: number;
  actorUserId: number;
  actorName?: string | null;
  actorRole: string;
  actionType: string;
  targetGymId?: number | null;
  gymName?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface MarketingAuditLogData {
  logs: MarketingAuditLogRow[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


