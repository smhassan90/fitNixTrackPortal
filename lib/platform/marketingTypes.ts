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
