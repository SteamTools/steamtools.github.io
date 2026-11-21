import {
  COLOR_SCHEME_STORAGE_KEY,
  computeNextStoredScheme,
  parseStoredScheme,
  resolveEffectiveScheme,
  resolveMetaSchemeContent,
  type ColorSchemeOverride,
  type EffectiveScheme,
} from './theme-logic.ts';
import { trackEvent } from './bridge.ts';

function readStoredOverride(): ColorSchemeOverride {
  try {
    return parseStoredScheme(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function readSystemDark(): boolean {
  try {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

function applyDomScheme(override: ColorSchemeOverride): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  const content = resolveMetaSchemeContent(override);
  if (meta) {
    meta.content = content;
  }
  if (override === 'light' || override === 'dark') {
    document.documentElement.dataset.scheme = override;
  } else {
    delete document.documentElement.dataset.scheme;
  }
}

class ThemeStore {
  storedOverride = $state<ColorSchemeOverride>(null);
  systemIsDark = $state<boolean>(false);

  effectiveScheme = $derived<EffectiveScheme>(
    resolveEffectiveScheme(this.storedOverride, this.systemIsDark),
  );

  constructor() {
    if (typeof window === 'undefined') return;
    this.storedOverride = readStoredOverride();
    this.systemIsDark = readSystemDark();
    applyDomScheme(this.storedOverride);

    if (window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const onMediaChange = (ev: MediaQueryListEvent) => {
        // Never remove a stored override inside matchMedia change handlers.
        this.systemIsDark = ev.matches;
      };
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onMediaChange);
      }
    }

    window.addEventListener('storage', (ev: StorageEvent) => {
      if (ev.key === COLOR_SCHEME_STORAGE_KEY || ev.key === null) {
        const next = readStoredOverride();
        this.storedOverride = next;
        applyDomScheme(next);
      }
    });
  }

  toggle(): void {
    const next = computeNextStoredScheme(this.storedOverride, this.systemIsDark);
    this.storedOverride = next;
    applyDomScheme(next);
    trackEvent('theme_toggle', {
      a: next ?? 'system',
      b: resolveEffectiveScheme(next, this.systemIsDark),
    });
    try {
      if (next === null) {
        window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
      }
    } catch {
      // Theme still applies to document even if localStorage is restricted.
    }
  }
}

export const themeStore = new ThemeStore();
