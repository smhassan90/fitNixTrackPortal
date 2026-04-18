/** Shared API envelope from FitNix platform backend */

export interface PlatformApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface PlatformApiFailure {
  success: false;
  error: {
    code?: string;
    message?: string;
    details?: Record<string, string[] | string> | unknown;
  };
}

export type PlatformApiEnvelope<T> = PlatformApiSuccess<T> | PlatformApiFailure;

export type PlatformRole = 'SUPER_ADMIN' | 'PLATFORM_SUPPORT';

export interface PlatformUser {
  id: string;
  role: PlatformRole;
  email: string;
  name: string;
}

export interface PlatformLoginData {
  token: string;
  user: PlatformUser;
}

export interface PlatformPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlatformGymsListData {
  gyms: PlatformGymRow[];
  pagination: PlatformPagination;
}

/** Row shape may grow with backend; keep index for extras */
export interface PlatformGymRow {
  id: string | number;
  name: string;
  slug?: string;
  tenantStatus?: 'ACTIVE' | 'SUSPENDED' | string;
  membersCount?: number;
  trainersCount?: number;
  pendingAmount?: number | string | null;
  overdueAmount?: number | string | null;
  subscription?: {
    dueDate?: string;
    planName?: string;
    planId?: number;
    subscriptionStatus?: string;
  };
  [key: string]: unknown;
}

export interface CreateGymResponse {
  gym?: unknown;
  generatedPassword?: string;
  [key: string]: unknown;
}

export interface PlatformBillingDuesData {
  items?: unknown[];
  dues?: unknown[];
  pagination?: PlatformPagination;
  [key: string]: unknown;
}

export interface PlatformReportsSummary {
  totalCollectedInRange?: number | string;
  [key: string]: unknown;
}

export interface PlatformTopGymsData {
  gyms?: unknown[];
  [key: string]: unknown;
}

export interface PlatformAuditLogsData {
  logs?: unknown[];
  items?: unknown[];
  pagination?: PlatformPagination;
  [key: string]: unknown;
}
