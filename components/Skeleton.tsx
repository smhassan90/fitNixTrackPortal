'use client';

function cx(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(' ');
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx('animate-pulse rounded-md bg-gray-200/90', className)}
    />
  );
}

export function SearchBarSkeleton() {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full sm:w-20" />
      </div>
    </div>
  );
}

export function FilterBarSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {Array.from({ length: fields }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full sm:w-40" />
        ))}
        <Skeleton className="h-10 w-full sm:w-20" />
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  const cellWidths = ['w-20', 'w-32', 'w-24', 'w-28', 'w-16', 'w-20'];

  return (
    <div className={cx('overflow-hidden rounded-lg bg-white shadow', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row}>
                {Array.from({ length: columns }).map((_, col) => (
                  <td key={col} className="px-6 py-4">
                    <Skeleton className={cx('h-4', cellWidths[col % cellWidths.length])} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-white p-6 shadow">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

export function MetricCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex w-full min-w-0 flex-nowrap gap-3 overflow-x-auto pb-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="min-w-[10rem] flex-1 basis-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ChartPanelSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <Skeleton className="h-5 w-48" />
      <Skeleton className={cx('mt-4 w-full rounded-lg', height)} />
    </div>
  );
}

export function DashboardContentSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={3} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartPanelSkeleton />
        <ChartPanelSkeleton />
      </div>
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
}

export function SettingsContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="space-y-4 rounded-lg bg-white p-6 shadow">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}

export function ReportsContentSkeleton() {
  return (
    <div className="space-y-8">
      <section>
        <Skeleton className="mb-3 h-6 w-56" />
        <MetricCardsSkeleton count={5} />
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartPanelSkeleton />
        <ChartPanelSkeleton />
      </section>
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}

export function MemberPaymentsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-36" />
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-6 w-20" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}

export function PageHeaderActionsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Skeleton className="h-10 w-full sm:w-36" />
      <Skeleton className="h-10 w-full sm:w-32" />
    </div>
  );
}
