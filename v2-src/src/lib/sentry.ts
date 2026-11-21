import {
  browserTracingIntegration,
  init,
  setTag,
} from '@sentry/svelte';
import { currencyStore } from './currency.svelte.ts';
import { routerStore } from './router.svelte.ts';
import {
  isSentryProdHost,
  registerSentryContextSync,
  shouldSendToSentry,
  type SentryContextTags,
} from './sentry-bridge.ts';
import { themeStore } from './theme.svelte.ts';

export const SENTRY_DSN =
  'https://b68144c98d912ae0bab8f38b6719be4d@o4512471924408320.ingest.us.sentry.io/4512471951343616';

let initialized = false;

function createNoopTransport() {
  return {
    send: async () => ({ statusCode: 200 }),
    flush: async () => true,
  };
}

export function updateSentryContext(tags: SentryContextTags): void {
  if (!initialized) return;
  if (tags.route) setTag('st.route', tags.route);
  if (tags.theme) setTag('st.theme', tags.theme);
  if (tags.currency) setTag('st.currency', tags.currency);
}

registerSentryContextSync(updateSentryContext);

export function initSentry(options?: { allowLocalPreview?: boolean }): boolean {
  if (typeof window === 'undefined') return false;
  const transmit = shouldSendToSentry();
  if (!transmit && !options?.allowLocalPreview) {
    return false;
  }
  if (initialized) {
    return true;
  }

  const prod = isSentryProdHost();
  const release =
    typeof __ST_SENTRY_RELEASE__ === 'string'
      ? __ST_SENTRY_RELEASE__
      : 'steamtools-v2@dev';

  init({
    dsn: SENTRY_DSN,
    environment: prod ? 'production' : 'development',
    release,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
    },
    enhanceFetchErrorMessages: 'report-only',
    integrations: [browserTracingIntegration()],
    tracesSampleRate: prod ? 0.1 : 1.0,
    // Strictly avoid injecting sentry-trace / baggage onto third-party CDNs or cross-origin API hosts.
    tracePropagationTargets: [/^https:\/\/(?:www\.)?steam\.tools\/v2\//],
    allowUrls: [
      /https?:\/\/(?:www\.)?steam\.tools\//,
      /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//,
    ],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^safari-extension:\/\//i,
      /kumo\.network-n\.com/i,
      /googlesyndication\.com/i,
      /doubleclick\.net/i,
    ],
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      /^Non-Error promise rejection captured/,
    ],
    ...(transmit ? {} : { transport: () => createNoopTransport() }),
  });

  initialized = true;
  const activeCurrency = currencyStore.currencies[currencyStore.curIndex]?.name;
  updateSentryContext({
    route: routerStore.currentRoute,
    theme: themeStore.effectiveScheme,
    currency: activeCurrency,
  });
  setTag('st.version', 'v2');
  return true;
}
