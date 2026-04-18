'use client';

interface Props {
  open: boolean;
  password: string;
  onClose: () => void;
}

export default function GeneratedPasswordModal({ open, password, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 max-w-lg w-full rounded-xl bg-white p-6 shadow-2xl border-2 border-warning"
      >
        <h2 className="text-lg font-bold text-dark-gray">Owner password generated</h2>
        <p className="mt-2 text-sm text-dark-gray-light">
          Copy this password now. It will not be shown again. Store it securely (password manager).
          Do not paste into shared chat or logs.
        </p>
        <div className="mt-4 rounded-lg bg-light-gray p-3 font-mono text-sm break-all border border-light-gray-dark">
          {password}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-white text-sm font-medium hover:bg-primary-dark"
            onClick={async () => {
              await navigator.clipboard.writeText(password);
            }}
          >
            Copy to clipboard
          </button>
          <button
            type="button"
            className="rounded-lg border border-light-gray-dark px-4 py-2 text-sm hover:bg-light-gray"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
