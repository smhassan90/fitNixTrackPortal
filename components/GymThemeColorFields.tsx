'use client';

import type { GymThemeColors } from '@/lib/theme';
import { DEFAULT_THEME, THEME_FIELD_META, isValidHexColor, normalizeHexColor } from '@/lib/theme';

type Props = {
  value: GymThemeColors;
  onChange: (next: GymThemeColors) => void;
  disabled?: boolean;
  /** Optional — show reset-to-defaults control */
  showReset?: boolean;
};

export default function GymThemeColorFields({
  value,
  onChange,
  disabled = false,
  showReset = true,
}: Props) {
  const setField = (key: keyof GymThemeColors, raw: string) => {
    const next = raw.startsWith('#') ? raw : `#${raw}`;
    onChange({ ...value, [key]: next });
  };

  const commitField = (key: keyof GymThemeColors, raw: string) => {
    onChange({
      ...value,
      [key]: normalizeHexColor(raw, DEFAULT_THEME[key]),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-dark-gray">Brand colors</p>
          <p className="text-xs text-dark-gray-light mt-0.5">
            Personalize this gym&apos;s portal. Leave as-is to use FitNix defaults.
          </p>
        </div>
        {showReset && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...DEFAULT_THEME })}
            className="text-xs font-medium text-primary hover:underline disabled:opacity-40"
          >
            Reset to defaults
          </button>
        )}
      </div>

      <div
        className="rounded-xl border border-light-gray-dark overflow-hidden"
        style={{ background: value.canvas }}
      >
        <div className="flex h-10">
          <div className="flex-1" style={{ background: value.ink }} title="Ink" />
          <div className="flex-1" style={{ background: value.surface }} title="Surface" />
          <div className="flex-1" style={{ background: value.primary }} title="Primary" />
          <div className="flex-1" style={{ background: value.primaryDark }} title="Primary dark" />
          <div
            className="flex-1 border-l border-black/5"
            style={{ background: value.canvas }}
            title="Canvas"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: value.surface }}>
          <span
            className="rounded-md px-2.5 py-1 text-xs font-semibold text-white"
            style={{ background: value.primary }}
          >
            Primary
          </span>
          <span className="text-xs" style={{ color: '#f8f8f8' }}>
            Preview on dark
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {THEME_FIELD_META.map(({ key, label, hint }) => {
          const hex = value[key];
          const valid = isValidHexColor(hex);
          return (
            <label key={key} className="block text-sm">
              <span className="text-xs font-medium text-dark-gray">{label}</span>
              <span className="ml-1 text-[11px] text-dark-gray-light">{hint}</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={valid ? hex : DEFAULT_THEME[key]}
                  disabled={disabled}
                  onChange={(e) => setField(key, e.target.value)}
                  className="h-9 w-11 shrink-0 cursor-pointer rounded border border-light-gray-dark bg-white p-0.5 disabled:opacity-50"
                  aria-label={label}
                />
                <input
                  type="text"
                  value={hex}
                  disabled={disabled}
                  onChange={(e) => setField(key, e.target.value)}
                  onBlur={(e) => commitField(key, e.target.value)}
                  className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 font-mono text-xs ${
                    valid ? 'border-light-gray-dark' : 'border-error'
                  } disabled:opacity-50`}
                  placeholder={DEFAULT_THEME[key]}
                  spellCheck={false}
                />
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
