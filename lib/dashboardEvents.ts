export const DASHBOARD_STATS_REFRESH_EVENT = 'fitnix:dashboard-stats-refresh';

/** Fired after payments change so dashboard refetches stats + fee collections + revenue. */
export function notifyDashboardStatsRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_STATS_REFRESH_EVENT));
}
