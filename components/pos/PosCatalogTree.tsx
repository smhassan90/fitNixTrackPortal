'use client';

import type { PosCategory, PosSubcategory } from '@/lib/pos/types';

type Props = {
  categories: PosCategory[];
  readOnly?: boolean;
  showEnableToggle?: boolean;
  enabledIds?: Set<number>;
  onToggleEnable?: (subcategoryId: number, enabled: boolean) => void;
  selectedSubcategoryId?: number | null;
  onSelectSubcategory?: (sub: PosSubcategory) => void;
  onAddCategory?: () => void;
  onEditCategory?: (cat: PosCategory) => void;
  onDeleteCategory?: (cat: PosCategory) => void;
  onAddSubcategory?: (cat: PosCategory) => void;
  onEditSubcategory?: (sub: PosSubcategory, cat: PosCategory) => void;
  onDeleteSubcategory?: (sub: PosSubcategory) => void;
};

export default function PosCatalogTree({
  categories,
  readOnly = false,
  showEnableToggle = false,
  enabledIds,
  onToggleEnable,
  selectedSubcategoryId,
  onSelectSubcategory,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddSubcategory,
  onEditSubcategory,
  onDeleteSubcategory,
}: Props) {
  if (categories.length === 0) {
    return <p className="text-sm text-gray-500">No categories yet.</p>;
  }

  return (
    <div className="space-y-4">
      {!readOnly && onAddCategory && (
        <button
          type="button"
          onClick={onAddCategory}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
        >
          Add category
        </button>
      )}
      {categories.map((cat) => (
        <div key={cat.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-dark-gray">{cat.name}</h3>
            {!readOnly && (
              <div className="flex gap-2">
                {onAddSubcategory && (
                  <button type="button" onClick={() => onAddSubcategory(cat)} className="text-xs text-primary">
                    + Subcategory
                  </button>
                )}
                {onEditCategory && (
                  <button type="button" onClick={() => onEditCategory(cat)} className="text-xs text-gray-600">
                    Edit
                  </button>
                )}
                {onDeleteCategory && (
                  <button type="button" onClick={() => onDeleteCategory(cat)} className="text-xs text-red-600">
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {(cat.subcategories ?? []).map((sub) => {
              const enabled = enabledIds ? enabledIds.has(sub.id) : sub.enabledForGym;
              const selected = selectedSubcategoryId === sub.id;
              return (
                <li
                  key={sub.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                    selected ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-gray-50'
                  }`}
                >
                  <button
                    type="button"
                    className="text-left text-sm font-medium text-gray-800"
                    onClick={() => onSelectSubcategory?.(sub)}
                  >
                    {sub.name}
                    {sub.allowedForms?.length ? (
                      <span className="ml-2 text-xs text-gray-500">
                        ({sub.allowedForms.join(', ')})
                      </span>
                    ) : null}
                  </button>
                  <div className="flex items-center gap-3">
                    {showEnableToggle && onToggleEnable && (
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={Boolean(enabled)}
                          onChange={(e) => onToggleEnable(sub.id, e.target.checked)}
                        />
                        Enabled
                      </label>
                    )}
                    {!readOnly && (
                      <>
                        {onEditSubcategory && (
                          <button
                            type="button"
                            onClick={() => onEditSubcategory(sub, cat)}
                            className="text-xs text-gray-600"
                          >
                            Edit
                          </button>
                        )}
                        {onDeleteSubcategory && (
                          <button
                            type="button"
                            onClick={() => onDeleteSubcategory(sub)}
                            className="text-xs text-red-600"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
