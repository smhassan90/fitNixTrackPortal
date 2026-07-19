'use client';

type Props = {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  /** primary = brand color, success = green (used for always-on rows). */
  tone?: 'primary' | 'success';
};

/**
 * Styled checkbox with a springy check animation.
 * The native input stays in the DOM (sr-only) so keyboard and form semantics work.
 */
export default function AnimatedCheckbox({
  checked,
  onChange,
  disabled = false,
  title,
  ariaLabel,
  tone = 'primary',
}: Props) {
  const checkedBox =
    tone === 'success'
      ? 'peer-checked:border-emerald-500 peer-checked:bg-emerald-500'
      : 'peer-checked:border-primary peer-checked:bg-primary';
  const hoverRing =
    tone === 'success'
      ? 'peer-hover:border-emerald-400 peer-focus-visible:ring-emerald-300'
      : 'peer-hover:border-primary/60 peer-focus-visible:ring-primary/40';

  return (
    <label
      title={title}
      className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center align-middle ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`absolute inset-0 rounded-md border-2 border-gray-300 bg-white shadow-sm transition-all duration-200 ease-out peer-checked:shadow ${checkedBox} ${
          disabled ? '' : hoverRing
        } peer-focus-visible:ring-2 peer-focus-visible:ring-offset-1`}
      />
      <svg
        aria-hidden
        viewBox="0 0 12 10"
        fill="none"
        className="pointer-events-none relative h-3 w-3 scale-0 text-white opacity-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.8,0.64,1)] peer-checked:scale-100 peer-checked:opacity-100"
      >
        <path
          d="M1 5.3 4.2 8.5 11 1.5"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </label>
  );
}
