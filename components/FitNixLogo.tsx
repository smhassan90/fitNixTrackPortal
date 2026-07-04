import { useId } from 'react';
import { Outfit } from 'next/font/google';

const brandFont = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

type FitNixLogoProps = {
  /** mark = icon only; full = icon + wordmark */
  variant?: 'mark' | 'full';
  /**
   * brand — teal gradient mark (default)
   * onBrand — translucent white mark for teal/brand panels
   * mono — solid currentColor mark (inherits text color)
   */
  tone?: 'brand' | 'onBrand' | 'mono';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  subtitle?: string;
  className?: string;
  /** Wordmark text color classes when variant is full */
  titleClassName?: string;
  subtitleClassName?: string;
};

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-14 w-14',
} as const;

const radiusMap = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-2xl',
} as const;

const titleSizeMap = {
  sm: 'text-[15px]',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
} as const;

function DumbbellMark({
  stroke,
  fill,
  trackOpacity = 0.22,
}: {
  stroke: string;
  fill: string;
  trackOpacity?: number;
}) {
  return (
    <>
      <circle cx="32" cy="32" r="23" stroke={stroke} strokeOpacity={trackOpacity} strokeWidth="2.75" />
      <path
        d="M32 9a23 23 0 1 1-16.26 6.74"
        stroke={stroke}
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <g fill={fill}>
        <rect x="14" y="23.5" width="6.5" height="17" rx="2.25" />
        <rect x="19.5" y="26.5" width="4" height="11" rx="1.25" />
        <rect x="22.5" y="30" width="19" height="4" rx="2" />
        <rect x="40.5" y="26.5" width="4" height="11" rx="1.25" />
        <rect x="43.5" y="23.5" width="6.5" height="17" rx="2.25" />
      </g>
    </>
  );
}

function LogoMark({ tone, size }: { tone: NonNullable<FitNixLogoProps['tone']>; size: keyof typeof sizeMap }) {
  const uid = useId().replace(/:/g, '');
  const bgId = `fnLogoBg-${uid}`;
  const shineId = `fnLogoShine-${uid}`;
  const box = `${sizeMap[size]} ${radiusMap[size]} shrink-0`;

  if (tone === 'mono') {
    return (
      <svg className={box} viewBox="0 0 64 64" fill="none" aria-hidden>
        <rect width="64" height="64" rx="18" fill="currentColor" opacity="0.12" />
        <DumbbellMark stroke="currentColor" fill="currentColor" trackOpacity={0.28} />
      </svg>
    );
  }

  if (tone === 'onBrand') {
    return (
      <div
        className={`flex items-center justify-center bg-white/15 shadow-lg ring-1 ring-white/20 backdrop-blur-sm ${box}`}
      >
        <svg className="h-[88%] w-[88%] text-white" viewBox="0 0 64 64" fill="none" aria-hidden>
          <DumbbellMark stroke="currentColor" fill="currentColor" trackOpacity={0.3} />
        </svg>
      </div>
    );
  }

  return (
    <svg className={`${box} drop-shadow-sm`} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id={bgId} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#48C9B0" />
          <stop offset="1" stopColor="#0E8F7A" />
        </linearGradient>
        <linearGradient id={shineId} x1="32" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${bgId})`} />
      <rect width="64" height="64" rx="18" fill={`url(#${shineId})`} />
      <DumbbellMark stroke="#fff" fill="#fff" />
    </svg>
  );
}

export default function FitNixLogo({
  variant = 'full',
  tone = 'brand',
  size = 'md',
  subtitle,
  className = '',
  titleClassName,
  subtitleClassName,
}: FitNixLogoProps) {
  const titleTone =
    titleClassName ??
    (tone === 'onBrand' ? 'text-white' : tone === 'mono' ? 'text-current' : 'text-dark-gray');
  const subTone =
    subtitleClassName ??
    (tone === 'onBrand' ? 'text-white/75' : tone === 'mono' ? 'text-gray-400' : 'text-dark-gray-light');
  const trackAccent =
    tone === 'onBrand' ? 'text-white/85' : tone === 'mono' ? 'text-current opacity-70' : 'text-primary';

  return (
    <div className={`flex items-center gap-3 ${className}`} role="img" aria-label="FitNix Track">
      <LogoMark tone={tone} size={size} />
      {variant === 'full' && (
        <div className={`min-w-0 leading-none ${brandFont.className}`}>
          <p className={`font-extrabold tracking-tight ${titleSizeMap[size]} ${titleTone}`}>
            FitNix
            <span className={`ml-1.5 font-semibold tracking-wide ${trackAccent}`}>Track</span>
          </p>
          {subtitle != null && subtitle !== '' && (
            <p className={`mt-1 text-[11px] font-medium tracking-wide ${subTone}`}>{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
