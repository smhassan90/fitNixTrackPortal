'use client';

import type { PosProductType } from '@/lib/pos/types';

export default function PosProductTypeTabs({
  value,
  onChange,
}: {
  value: PosProductType;
  onChange: (v: PosProductType) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
      {(['NUTRIENT', 'ACCESSORY'] as PosProductType[]).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            value === type ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {type === 'NUTRIENT' ? 'Nutrients' : 'Accessories'}
        </button>
      ))}
    </div>
  );
}
