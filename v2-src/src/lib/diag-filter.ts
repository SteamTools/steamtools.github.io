export interface SentryStackFrameLike {
  filename?: string;
  abs_path?: string;
  function?: string;
  module?: string;
}

export interface SentryExceptionLike {
  type?: string;
  value?: string;
  stacktrace?: {
    frames?: SentryStackFrameLike[];
  };
}

export interface SentryEventLike {
  type?: string;
  exception?: {
    values?: SentryExceptionLike[];
  };
}

export interface SentryHintLike {
  originalException?: unknown;
}

const FETCH_ERROR_HOST_RE =
  /^(?:Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.)\s*\(([^)]+)\)\s*$/i;

const SENTRY_INTERNAL_FILENAME_RE =
  /(?:\/v2\/assets\/diag-client-[^/?#]+\.js(?:[?#]|$)|node_modules\/@sentry\/)/i;

const FIRST_PARTY_SCRIPT_RE =
  /^(?:https?:\/\/(?:www\.)?steam\.tools\/(?:v2\/assets|js)\/|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/(?:v2\/assets|src|js)\/|\/(?:v2\/assets|js)\/)/i;

export function isFirstPartyFetchHost(rawHost: string): boolean {
  const host = String(rawHost || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
  if (!host) return false;
  return (
    host === 'steam.tools' ||
    host.endsWith('.steam.tools') ||
    host === 'steamcommunity.com' ||
    host.endsWith('.steamcommunity.com') ||
    host.endsWith('.steamstatic.com') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}

export function isSentryInternalFrame(frame: SentryStackFrameLike): boolean {
  if (!frame) return false;
  if (frame.function === 'sentryWrapped') return true;
  const candidate = frame.abs_path || frame.filename || '';
  return SENTRY_INTERNAL_FILENAME_RE.test(candidate);
}

export function isFirstPartyAppFrame(frame: SentryStackFrameLike): boolean {
  if (!frame || isSentryInternalFrame(frame)) return false;
  const candidate = frame.abs_path || frame.filename || '';
  if (!candidate || candidate === '<anonymous>' || candidate === '[native code]') {
    return false;
  }
  return FIRST_PARTY_SCRIPT_RE.test(candidate);
}

function extractFetchErrorHost(event: SentryEventLike, hint?: SentryHintLike): string | null {
  const orig = hint?.originalException;
  if (orig && typeof orig === 'object' && '__sentry_fetch_url_host__' in orig) {
    const host = (orig as { __sentry_fetch_url_host__?: unknown }).__sentry_fetch_url_host__;
    if (typeof host === 'string' && host.trim()) {
      return host.trim();
    }
  }
  const values = event.exception?.values;
  if (Array.isArray(values)) {
    for (const ex of values) {
      if (typeof ex?.value === 'string') {
        const match = FETCH_ERROR_HOST_RE.exec(ex.value.trim());
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }
  }
  return null;
}

/**
 * Drop third-party ad/extension/browser-translate errors that leak past Sentry's
 * built-in allowUrls/denyUrls (which only inspect the single innermost frame,
 * often Sentry's own `window.fetch` wrapper in `diag-client-*.js`).
 */
export function shouldDropSentryEvent(event: SentryEventLike, hint?: SentryHintLike): boolean {
  // Never drop non-error events (e.g. feedback, transactions) or plain captureMessage events.
  if (event.type) return false;
  const exceptions = event.exception?.values;
  if (!Array.isArray(exceptions) || exceptions.length === 0) return false;

  // 1. Drop unhandled fetch network errors targeting third-party hosts (ad bidders, trackers, etc.).
  const fetchHost = extractFetchErrorHost(event, hint);
  if (fetchHost && !isFirstPartyFetchHost(fetchHost)) {
    return true;
  }

  // 2. Require at least one non-Sentry stack frame from our actual JS bundles (/v2/assets/ or /js/).
  // This drops:
  // - Ad/tracker scripts whose innermost frame is Sentry's fetch Proxy in diag-client-*.js
  // - Eval/<anonymous> ad scripts (e.g. Pubstack)
  // - Browser-injected scripts without src (e.g. Chrome Google Translate) credited to /v2/
  const allFrames: SentryStackFrameLike[] = [];
  for (const ex of exceptions) {
    if (Array.isArray(ex?.stacktrace?.frames)) {
      allFrames.push(...ex.stacktrace.frames);
    }
  }

  if (allFrames.length > 0 && !allFrames.some(isFirstPartyAppFrame)) {
    return true;
  }

  return false;
}
