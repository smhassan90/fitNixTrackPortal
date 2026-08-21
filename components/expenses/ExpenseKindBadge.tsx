import type { ExpenseKind } from '@/lib/expensesApi';
import { expenseKindLabel } from '@/lib/expensesApi';

const KIND_CLASS: Record<ExpenseKind, string> = {
  FIXED: 'bg-blue-100 text-blue-800',
  PETTY: 'bg-amber-100 text-amber-800',
  OTHER: 'bg-gray-100 text-gray-700',
};

export default function ExpenseKindBadge({ kind }: { kind: ExpenseKind | string | null | undefined }) {
  const k = (String(kind || 'OTHER').toUpperCase() as ExpenseKind) || 'OTHER';
  const cls = KIND_CLASS[k] || KIND_CLASS.OTHER;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {expenseKindLabel(k)}
    </span>
  );
}
