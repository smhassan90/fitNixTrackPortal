/** Marketing domain types — Super Admin internal workstation (Phase 1+) */

export type MarketingOpportunityStatus =
  | 'NEW'
  | 'REVIEWED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'PUBLISHED'
  | 'REJECTED';

export type MarketingContentStatus =
  | 'DRAFT'
  | 'AWAITING_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED';

/** Gym row for marketing gym picker (subset of platform gym + marketing flags). */
export interface MarketingGymSummary {
  id: number;
  name: string;
  slug?: string | null;
  city?: string | null;
  country?: string | null;
  tenantStatus?: 'ACTIVE' | 'SUSPENDED' | string;
  logoUrl?: string | null;
  /** True when a MarketingProfile row exists */
  hasMarketingProfile?: boolean;
  /** Connected social account count (0 until Phase 4) */
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
 * Empty strings / null mean “unknown”; AI must not invent facts.
 */
export interface MarketingProfile {
  id?: number;
  gymId: number;
  /** Denormalized / mirrored from Gym when useful for display */
  gymName?: string;
  description?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  /** Free-text or JSON-friendly lists stored as text on backend */
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
  /** Claims / facilities / stats the AI must never invent */
  doNotClaim?: string | null;
  additionalInstructions?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type MarketingProfileUpdate = Partial<
  Omit<MarketingProfile, 'id' | 'gymId' | 'createdAt' | 'updatedAt' | 'gymName'>
>;

/** Overview dashboard metrics for a selected gym (Phase 1 shell; later phases fill real counts). */
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
