export type ColorSchemeOverride = 'light' | 'dark' | null;
export type EffectiveScheme = 'light' | 'dark';

export const COLOR_SCHEME_STORAGE_KEY = 'color-scheme';

export function parseStoredScheme(raw: string | null | undefined): ColorSchemeOverride {
  if (raw === 'light' || raw === 'dark') {
    return raw;
  }
  return null;
}

export function resolveEffectiveScheme(
  stored: ColorSchemeOverride,
  systemIsDark: boolean,
): EffectiveScheme {
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return systemIsDark ? 'dark' : 'light';
}

export function resolveMetaSchemeContent(stored: ColorSchemeOverride): 'light' | 'dark' | 'light dark' {
  return stored ?? 'light dark';
}

/**
 * Compute next stored color-scheme override when toggling from current state.
 * Divergence from the OS preference is checked ONLY at storage time:
 * if the user toggles back to what the OS already prefers, return null (remove override)
 * so future OS changes resume taking effect. Never retroactively strip a stored value
 * inside a matchMedia change listener.
 */
export function computeNextStoredScheme(
  currentStored: ColorSchemeOverride,
  systemIsDark: boolean,
): ColorSchemeOverride {
  const rendered = resolveEffectiveScheme(currentStored, systemIsDark);
  const target: EffectiveScheme = rendered === 'dark' ? 'light' : 'dark';
  const systemScheme: EffectiveScheme = systemIsDark ? 'dark' : 'light';
  return target === systemScheme ? null : target;
}
