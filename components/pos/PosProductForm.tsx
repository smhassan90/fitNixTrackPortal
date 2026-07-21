'use client';

import type { Dispatch, SetStateAction } from 'react';
import PosProductImageEditor from '@/components/pos/PosProductImageEditor';
import type { NutrientForm, PosProduct, PosProductType, PosSubcategory } from '@/lib/pos/types';

export type PosProductFormState = {
  productType: PosProductType;
  subcategoryId: string;
  name: string;
  imageUrl: string;
  brand: string;
  description: string;
  form: NutrientForm;
  servingSizeG: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
  sugarG: string;
  material: string;
  color: string;
  size: string;
  price: string;
  discount: string;
  initialStock: string;
  trackInventory: boolean;
  isActive: boolean;
};

export function emptyProductForm(type: PosProductType): PosProductFormState {
  return {
    productType: type,
    subcategoryId: '',
    name: '',
    imageUrl: '',
    brand: '',
    description: '',
    form: 'PACKAGED',
    servingSizeG: '',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
    sugarG: '',
    material: '',
    color: '',
    size: '',
    price: '',
    discount: '',
    initialStock: '',
    trackInventory: false,
    isActive: true,
  };
}

export function productToForm(p: PosProduct): PosProductFormState {
  return {
    productType: p.productType,
    subcategoryId: String(p.subcategoryId),
    name: p.name,
    imageUrl: p.imageUrl ?? '',
    brand: p.brand ?? '',
    description: p.description ?? '',
    form: p.form === 'SERVING' ? 'SERVING' : 'PACKAGED',
    servingSizeG: p.servingSizeG != null ? String(p.servingSizeG) : '',
    calories: p.calories != null ? String(p.calories) : '',
    proteinG: p.proteinG != null ? String(p.proteinG) : '',
    carbsG: p.carbsG != null ? String(p.carbsG) : '',
    fatG: p.fatG != null ? String(p.fatG) : '',
    fiberG: p.fiberG != null ? String(p.fiberG) : '',
    sugarG: p.sugarG != null ? String(p.sugarG) : '',
    material: p.material ?? '',
    color: p.color ?? '',
    size: p.size ?? '',
    price: String(p.price ?? ''),
    discount: p.discount != null ? String(p.discount) : '',
    initialStock: p.stockQuantity != null ? String(p.stockQuantity) : '',
    trackInventory: p.trackInventory !== false,
    isActive: p.isActive !== false,
  };
}

function inferNutrientFormFromSubcategory(sub?: PosSubcategory | null): NutrientForm | null {
  const name = (sub?.name ?? '').trim().toLowerCase();
  if (name === 'packaged') return 'PACKAGED';
  if (name === 'serving') return 'SERVING';
  return null;
}

function allowedFormsForSub(sub?: PosSubcategory | null): NutrientForm[] {
  const inferred = inferNutrientFormFromSubcategory(sub);
  if (inferred) return [inferred];
  if (!sub?.allowedForms?.length) return ['PACKAGED', 'SERVING'];
  return sub.allowedForms;
}

export function validateProductForm(
  form: PosProductFormState,
  sub?: PosSubcategory | null,
  isEdit = false
): string | null {
  if (!form.name.trim()) return 'Name is required.';
  if (!form.subcategoryId) return 'Subcategory is required.';
  if (!form.price.trim() || Number(form.price) < 0) return 'Valid price is required.';

  if (form.productType === 'ACCESSORY') {
    if (!form.material.trim()) return 'Material is required for accessories.';
    return null;
  }

  const nutrientForm = inferNutrientFormFromSubcategory(sub) ?? form.form;
  const allowed = allowedFormsForSub(sub);
  if (!allowed.includes(nutrientForm)) {
    return `This subcategory only allows: ${allowed.join(', ')}.`;
  }

  if (nutrientForm === 'PACKAGED') {
    if (!form.servingSizeG.trim()) return 'Serving size (g) is required for packaged nutrients.';
    if (!form.calories.trim()) return 'Calories are required for packaged nutrients.';
    if (!form.proteinG.trim()) return 'Protein (g) is required for packaged nutrients.';
  } else {
    if (!form.calories.trim()) return 'Calories are required for serving products.';
  }

  if (!isEdit && nutrientForm === 'PACKAGED' && form.initialStock === '' && form.trackInventory) {
    return 'Initial stock is required when inventory is tracked.';
  }

  return null;
}

export function buildProductPayload(
  form: PosProductFormState,
  isEdit = false,
  sub?: PosSubcategory | null
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    productType: form.productType,
    subcategoryId: Number(form.subcategoryId),
    name: form.name.trim(),
    imageUrl: form.imageUrl.trim() || undefined,
    price: Number(form.price),
    discount: form.discount.trim() ? Number(form.discount) : undefined,
    isActive: form.isActive,
  };

  if (form.productType === 'ACCESSORY') {
    return {
      ...base,
      material: form.material.trim(),
      color: form.color.trim() || undefined,
      size: form.size.trim() || undefined,
      brand: form.brand.trim() || undefined,
      ...(!isEdit && form.initialStock.trim()
        ? { initialStock: Number(form.initialStock), trackInventory: true }
        : { trackInventory: true }),
    };
  }

  const nutrientForm = inferNutrientFormFromSubcategory(sub) ?? form.form;
  const nutrient: Record<string, unknown> = {
    ...base,
    // Backend also infers from Packaged/Serving subcategory names; send form for consistency.
    form: nutrientForm,
    brand: form.brand.trim() || undefined,
    calories: Number(form.calories),
    proteinG: form.proteinG.trim() ? Number(form.proteinG) : undefined,
    carbsG: form.carbsG.trim() ? Number(form.carbsG) : undefined,
    fatG: form.fatG.trim() ? Number(form.fatG) : undefined,
    fiberG: form.fiberG.trim() ? Number(form.fiberG) : undefined,
    sugarG: form.sugarG.trim() ? Number(form.sugarG) : undefined,
    trackInventory: nutrientForm === 'SERVING' ? form.trackInventory : true,
  };

  if (nutrientForm === 'PACKAGED') {
    nutrient.servingSizeG = Number(form.servingSizeG);
    if (!isEdit && form.initialStock.trim()) nutrient.initialStock = Number(form.initialStock);
  } else {
    nutrient.description = form.description.trim() || undefined;
  }

  return nutrient;
}

type Props = {
  form: PosProductFormState;
  setForm: Dispatch<SetStateAction<PosProductFormState>>;
  subcategories: PosSubcategory[];
  productId?: string | number | null;
  onPendingImageChange?: (blob: Blob | null) => void;
  onImageError?: (message: string) => void;
  onImageSuccess?: (message: string) => void;
  disabled?: boolean;
  isEdit?: boolean;
};

export default function PosProductForm({
  form,
  setForm,
  subcategories,
  productId,
  onPendingImageChange,
  onImageError,
  onImageSuccess,
  disabled,
  isEdit,
}: Props) {
  const selectedSub = subcategories.find((s) => String(s.id) === form.subcategoryId);
  const inferredForm = form.productType === 'NUTRIENT' ? inferNutrientFormFromSubcategory(selectedSub) : null;
  const nutrientForm = inferredForm ?? form.form;
  const allowedForms =
    form.productType === 'NUTRIENT' ? allowedFormsForSub(selectedSub) : ([] as NutrientForm[]);
  const showFormSelector = form.productType === 'NUTRIENT' && inferredForm == null;

  const set = (patch: Partial<PosProductFormState>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-gray-700">Subcategory</span>
        <select
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={form.subcategoryId}
          disabled={disabled || isEdit}
          onChange={(e) => {
            const nextId = e.target.value;
            const nextSub = subcategories.find((s) => String(s.id) === nextId);
            const nextForm = inferNutrientFormFromSubcategory(nextSub);
            set({
              subcategoryId: nextId,
              ...(nextForm ? { form: nextForm } : {}),
            });
          }}
        >
          <option value="">Select subcategory</option>
          {subcategories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.enabledForGym === false ? ' (disabled)' : ''}
            </option>
          ))}
        </select>
        {inferredForm && (
          <p className="mt-1 text-xs text-gray-500">
            Product type is set from subcategory ({inferredForm === 'PACKAGED' ? 'Packaged' : 'Serving'}).
          </p>
        )}
      </label>

      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-gray-700">Name</span>
        <input
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={form.name}
          disabled={disabled}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>

      <PosProductImageEditor
        productId={productId}
        imageUrl={form.imageUrl || null}
        disabled={disabled}
        onImageUrlChange={(url) => set({ imageUrl: url ?? '' })}
        onPendingImageChange={onPendingImageChange}
        onError={onImageError}
        onSuccess={onImageSuccess}
      />

      {form.productType === 'NUTRIENT' && (
        <>
          {showFormSelector && (
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Form</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.form}
                disabled={disabled}
                onChange={(e) => set({ form: e.target.value as NutrientForm })}
              >
                {allowedForms.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Brand</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.brand}
              disabled={disabled}
              onChange={(e) => set({ brand: e.target.value })}
            />
          </label>
          {nutrientForm === 'PACKAGED' ? (
            <>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Serving size (g) *</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.servingSizeG}
                  disabled={disabled}
                  onChange={(e) => set({ servingSizeG: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Calories *</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.calories}
                  disabled={disabled}
                  onChange={(e) => set({ calories: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Protein (g) *</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.proteinG}
                  disabled={disabled}
                  onChange={(e) => set({ proteinG: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Carbs (g)</span>
                <input type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.carbsG} disabled={disabled} onChange={(e) => set({ carbsG: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Fat (g)</span>
                <input type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.fatG} disabled={disabled} onChange={(e) => set({ fatG: e.target.value })} />
              </label>
              {!isEdit && (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Initial stock</span>
                  <input type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.initialStock} disabled={disabled} onChange={(e) => set({ initialStock: e.target.value })} />
                </label>
              )}
            </>
          ) : (
            <>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Description</span>
                <textarea className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} value={form.description} disabled={disabled} onChange={(e) => set({ description: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Calories *</span>
                <input type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.calories} disabled={disabled} onChange={(e) => set({ calories: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Protein (g)</span>
                <input type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.proteinG} disabled={disabled} onChange={(e) => set({ proteinG: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={form.trackInventory} disabled={disabled} onChange={(e) => set({ trackInventory: e.target.checked })} />
                <span className="text-sm text-gray-700">Track inventory</span>
              </label>
              {!isEdit && form.trackInventory && (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Initial stock</span>
                  <input type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.initialStock} disabled={disabled} onChange={(e) => set({ initialStock: e.target.value })} />
                </label>
              )}
            </>
          )}
        </>
      )}

      {form.productType === 'ACCESSORY' && (
        <>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Material *</span>
            <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.material} disabled={disabled} onChange={(e) => set({ material: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Color</span>
            <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.color} disabled={disabled} onChange={(e) => set({ color: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Size</span>
            <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.size} disabled={disabled} onChange={(e) => set({ size: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Brand</span>
            <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.brand} disabled={disabled} onChange={(e) => set({ brand: e.target.value })} />
          </label>
          {!isEdit && (
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Initial stock</span>
              <input type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.initialStock} disabled={disabled} onChange={(e) => set({ initialStock: e.target.value })} />
            </label>
          )}
        </>
      )}

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Price *</span>
        <input type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.price} disabled={disabled} onChange={(e) => set({ price: e.target.value })} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Default discount</span>
        <input type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.discount} disabled={disabled} onChange={(e) => set({ discount: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" checked={form.isActive} disabled={disabled} onChange={(e) => set({ isActive: e.target.checked })} />
        <span className="text-sm text-gray-700">Active (visible at checkout when in enabled subcategory)</span>
      </label>
    </div>
  );
}
