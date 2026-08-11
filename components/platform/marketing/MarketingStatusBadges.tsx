'use client';

import type {
  MarketingContentStatus,
  MarketingOpportunityStatus,
} from '@/lib/platform/marketingTypes';
import {
  CONTENT_STATUS_LABELS,
  OPPORTUNITY_STATUS_LABELS,
} from '@/lib/platform/marketingTypes';

const opportunityTone: Record<MarketingOpportunityStatus, string> = {
  DRAFT: 'bg-light-gray text-dark-gray',
  AWAITING_REVIEW: 'bg-warning/20 text-warning-dark',
  APPROVED: 'bg-primary/20 text-ink',
  REJECTED: 'bg-error-light/30 text-error-dark',
  CONVERTED: 'bg-dark-gray/10 text-dark-gray',
};

const contentTone: Record<MarketingContentStatus, string> = {
  DRAFT: 'bg-light-gray text-dark-gray',
  AWAITING_APPROVAL: 'bg-warning/20 text-warning-dark',
  APPROVED: 'bg-primary/20 text-ink',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  PUBLISHED: 'bg-primary/30 text-ink',
  FAILED: 'bg-error-light/30 text-error-dark',
  REJECTED: 'bg-error-light/30 text-error-dark',
};

export function OpportunityStatusBadge({ status }: { status: MarketingOpportunityStatus | string }) {
  const key = status as MarketingOpportunityStatus;
  const label = OPPORTUNITY_STATUS_LABELS[key] || status;
  const tone = opportunityTone[key] || 'bg-light-gray text-dark-gray';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function ContentStatusBadge({ status }: { status: MarketingContentStatus | string }) {
  const key = status as MarketingContentStatus;
  const label = CONTENT_STATUS_LABELS[key] || status;
  const tone = contentTone[key] || 'bg-light-gray text-dark-gray';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

const imageTone: Record<string, string> = {
  PENDING: 'bg-light-gray text-dark-gray',
  READY: 'bg-warning/20 text-warning-dark',
  APPROVED: 'bg-primary/20 text-ink',
  REJECTED: 'bg-error-light/30 text-error-dark',
  FAILED: 'bg-error-light/30 text-error-dark',
};

export function ImageStatusBadge({ status }: { status: string }) {
  const label =
    status === 'READY'
      ? 'Generated'
      : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  const tone = imageTone[status] || 'bg-light-gray text-dark-gray';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}
