'use client';

import { useState } from 'react';

export default function PosRestockModal({
  open,
  productName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  productName: string;
  onClose: () => void;
  onConfirm: (quantity: number, note: string) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = Number(quantity);
    if (!q || q <= 0) return;
    setSaving(true);
    try {
      await onConfirm(q, note.trim());
      setQuantity('');
      setNote('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="relative z-10 w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <h3 className="font-semibold text-dark-gray">Restock — {productName}</h3>
        <label className="mt-4 block text-sm">
          Quantity to add
          <input type="number" min={1} required className="mt-1 w-full rounded-lg border px-3 py-2" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm">
          Note
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary py-2 text-sm text-white disabled:opacity-50">Restock</button>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
