export type SentryScheme = 'light' | 'dark';

export interface SentryContextTags {
  route?: string;
  theme?: SentryScheme;
  currency?: string;
}

let contextSyncHandler: ((tags: SentryContextTags) => void) | null = null;
let themeSyncHandler: ((scheme: SentryScheme) => void) | null = null;

export function isSentryProdHost(hostname?: string): boolean {
  const host =
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  return host === 'steam.tools' || host === 'www.steam.tools';
}

export function isSentryDebugMode(search?: string): boolean {
  const qs =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!qs) return false;
  try {
    return new URLSearchParams(qs).get('sentry_debug') === '1';
  } catch {
    return false;
  }
}

export function shouldSendToSentry(): boolean {
  if (typeof window === 'undefined') return false;
  return isSentryProdHost() || isSentryDebugMode();
}

export function registerSentryContextSync(fn: (tags: SentryContextTags) => void): void {
  contextSyncHandler = fn;
}

export function registerSentryThemeSync(fn: (scheme: SentryScheme) => void): void {
  themeSyncHandler = fn;
}

export function syncSentryContext(tags: SentryContextTags): void {
  if (contextSyncHandler) {
    contextSyncHandler(tags);
  }
  if (tags.theme && themeSyncHandler) {
    themeSyncHandler(tags.theme);
  }
}
