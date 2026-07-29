'use client';

import type { PosNutrientSellFilter } from '@/lib/pos/nutrientForm';

const OPTIONS: Array<{ value: PosNutrientSellFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'NUTRIENT', label: 'Nutrient' },
  { value: 'SERVING', label: 'Serving' },
];

export default function PosNutrientFormTabs({
  value,
  onChange,
}: {
  value: PosNutrientSellFilter;
  onChange: (v: PosNutrientSellFilter) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1"
      role="tablist"
      aria-label="Nutrient sell type"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
