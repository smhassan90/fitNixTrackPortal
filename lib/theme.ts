/** FitNix portal brand theme — 5 colors, overridable per gym. */

export type GymThemeColors = {
  /** Near-black: sidebar, headings, strong text on light surfaces */
  ink: string;
  /** Elevated dark: sidebar depth, dark cards */
  surface: string;
  /** Accent green: primary buttons, active nav, links */
  primary: string;
  /** Deep green: hover / pressed primary */
  primaryDark: string;
  /** Off-white: page background, light chrome */
  canvas: string;
};

export const DEFAULT_THEME: GymThemeColors = {
  ink: '#0f0f0f',
  surface: '#202020',
  primary: '#5DD62C',
  primaryDark: '#337418',
  canvas: '#f8f8f8',
};

export const THEME_FIELD_META: Array<{
  key: keyof GymThemeColors;
  label: string;
  hint: string;
}> = [
  { key: 'ink', label: 'Ink (dark)', hint: 'Sidebar & strong text' },
  { key: 'surface', label: 'Surface (dark)', hint: 'Dark panels & depth' },
  { key: 'primary', label: 'Primary (green)', hint: 'Buttons & accents' },
  { key: 'primaryDark', label: 'Primary dark', hint: 'Button hover & press' },
  { key: 'canvas', label: 'Canvas (light)', hint: 'Page background' },
];

const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  let v = value.trim();
  if (!v) return fallback;
  if (!v.startsWith('#')) v = `#${v}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    v = `#${r}${r}${g}${g}${b}${b}`;
  }
  return isValidHexColor(v) ? v.toLowerCase() : fallback;
}

function hexToRgbChannels(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeHexColor(hex, '');
  if (!normalized || !isValidHexColor(normalized)) return null;
  const h = normalized.slice(1);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when background is light enough that dark text reads better. */
export function isLightColor(hex: string, threshold = 0.45): boolean {
  return relativeLuminance(hex) > threshold;
}

/** Tailwind text class for readable contrast on a hex background. */
export function contrastTextClassOn(bgHex: string): 'text-white' | 'text-ink' {
  return isLightColor(bgHex) ? 'text-ink' : 'text-white';
}

/** Merge partial theme with defaults. */
export function resolveTheme(partial?: Partial<GymThemeColors> | null): GymThemeColors {
  return {
    ink: normalizeHexColor(partial?.ink, DEFAULT_THEME.ink),
    surface: normalizeHexColor(partial?.surface, DEFAULT_THEME.surface),
    primary: normalizeHexColor(partial?.primary, DEFAULT_THEME.primary),
    primaryDark: normalizeHexColor(partial?.primaryDark, DEFAULT_THEME.primaryDark),
    canvas: normalizeHexColor(partial?.canvas, DEFAULT_THEME.canvas),
  };
}

/** Parse theme from API gym/settings objects (flexible field names). */
export function parseThemeFromUnknown(raw: unknown): GymThemeColors {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const nested =
    o.theme && typeof o.theme === 'object'
      ? (o.theme as Record<string, unknown>)
      : o.brandColors && typeof o.brandColors === 'object'
        ? (o.brandColors as Record<string, unknown>)
        : o.colors && typeof o.colors === 'object'
          ? (o.colors as Record<string, unknown>)
          : o;

  return resolveTheme({
    ink: (nested.ink ?? nested.colorInk ?? nested.dark ?? nested.foreground) as string | undefined,
    surface: (nested.surface ?? nested.colorSurface ?? nested.panel ?? nested.elevated) as
      | string
      | undefined,
    primary: (nested.primary ?? nested.colorPrimary ?? nested.accent) as string | undefined,
    primaryDark: (nested.primaryDark ??
      nested.colorPrimaryDark ??
      nested.primary_dark ??
      nested.accentDark) as string | undefined,
    canvas: (nested.canvas ?? nested.colorCanvas ?? nested.background ?? nested.bg) as
      | string
      | undefined,
  });
}

/** Apply theme CSS variables on document root (client only). */
export function applyThemeToDocument(theme: GymThemeColors): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.style.setProperty('--theme-ink', resolved.ink);
  root.style.setProperty('--theme-ink-rgb', hexToRgbChannels(resolved.ink));
  root.style.setProperty('--theme-surface', resolved.surface);
  root.style.setProperty('--theme-surface-rgb', hexToRgbChannels(resolved.surface));
  root.style.setProperty('--theme-primary', resolved.primary);
  root.style.setProperty('--theme-primary-rgb', hexToRgbChannels(resolved.primary));
  root.style.setProperty('--theme-primary-dark', resolved.primaryDark);
  root.style.setProperty('--theme-primary-dark-rgb', hexToRgbChannels(resolved.primaryDark));
  root.style.setProperty('--theme-canvas', resolved.canvas);
  root.style.setProperty('--theme-canvas-rgb', hexToRgbChannels(resolved.canvas));
}

export function resetThemeToDefault(): void {
  applyThemeToDocument(DEFAULT_THEME);
}

/** Payload shape for create/patch gym APIs. */
export function themeToApiPayload(theme: GymThemeColors): GymThemeColors {
  return resolveTheme(theme);
}
