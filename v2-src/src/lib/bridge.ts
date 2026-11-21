export interface HttpAdapterResponse<T = any> {
  status: number;
  data: T;
  headers?: (name: string) => string | null;
}

function appendQueryParams(baseUrl: string, params: unknown): string {
  if (!params || typeof params !== 'object') return baseUrl;
  const search = new URLSearchParams();
  for (const [key, val] of Object.entries(params as Record<string, unknown>)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item !== undefined && item !== null) search.append(key, String(item));
      }
    } else {
      search.append(key, String(val));
    }
  }
  const qs = search.toString();
  if (!qs) return baseUrl;
  return baseUrl + (baseUrl.includes('?') ? '&' : '?') + qs;
}

export async function fetchHttpRequest(reqConfig: Record<string, unknown>): Promise<HttpAdapterResponse> {
  const url = appendQueryParams(String(reqConfig.url || ''), reqConfig.params);
  const method = String(reqConfig.method || 'GET').toUpperCase();
  const headers: Record<string, string> = Object.assign(
    {},
    (reqConfig.headers as Record<string, string> | undefined) || {},
  );
  const init: RequestInit = {
    method,
    headers,
    credentials: reqConfig.withCredentials ? 'include' : 'same-origin',
  };
  if (reqConfig.data !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
    init.body = typeof reqConfig.data === 'string' ? reqConfig.data : JSON.stringify(reqConfig.data);
  }

  let resp: Response;
  try {
    resp = await fetch(url, init);
  } catch {
    throw { status: 0, data: null, headers: () => null };
  }

  let data: unknown = null;
  try {
    const rawText = await resp.text();
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    }
  } catch {
    data = null;
  }

  const wrapped: HttpAdapterResponse = {
    status: resp.status,
    data,
    headers: (name: string) => resp.headers.get(name),
  };

  if (!resp.ok) {
    throw wrapped;
  }
  return wrapped;
}

export const httpShim = {
  get(url: string, opts?: Record<string, unknown>) {
    return fetchHttpRequest({ ...(opts || {}), method: 'GET', url });
  },
  post(url: string, data: unknown, opts?: Record<string, unknown>) {
    return fetchHttpRequest({ ...(opts || {}), method: 'POST', url, data });
  },
};

export function getCfg(): SteamToolsConfigGlobal {
  if (!window.STEAMTOOLS_CONFIG) {
    throw new Error('STEAMTOOLS_CONFIG is not loaded');
  }
  return window.STEAMTOOLS_CONFIG;
}

export function getImporter(): SteamToolsImportGlobal | null {
  return window.SteamToolsImport || null;
}

export async function apiRequestWithFailover(
  pathAndQuery: string,
  reqConfig: Record<string, unknown> = {},
  options?: Record<string, unknown>,
): Promise<HttpAdapterResponse> {
  const cfg = getCfg();
  return cfg.httpRequestWithFailover(fetchHttpRequest, pathAndQuery, reqConfig, options);
}

export function computeShardHex64(key: string): string {
  const cfg = getCfg();
  if (typeof cfg.fnv1a32Hex64 === 'function') {
    return cfg.fnv1a32Hex64(key);
  }
  let hash = 0x811c9dc5;
  const s = String(key ?? '');
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) & 0x3f).toString(16).padStart(2, '0');
}

export function normalizeAssetUrl(url: string): string {
  const cfg = getCfg();
  if (typeof cfg.normalizeSteamAssetUrl === 'function') {
    return cfg.normalizeSteamAssetUrl(url);
  }
  return String(url || '').replace(
    /^https?:\/\/cdn\.(?:akamai|edgecast)\.steamstatic\.com/,
    'https://shared.fastly.steamstatic.com',
  );
}

export function sanitizeEmoteName(raw: string): string {
  const imp = getImporter();
  if (imp && typeof imp.sanitizeEmoteName === 'function') {
    return imp.sanitizeEmoteName(raw);
  }
  return String(raw || '').trim().replace(/^:|:$/g, '');
}

export async function loadDataset<T = any>(logicalKey: string, options: Record<string, unknown> = {}): Promise<T> {
  const cfg = getCfg();
  return cfg.getDatasetJson(null, logicalKey, options) as Promise<T>;
}

export async function fetchCdnJson<T = any>(relPath: string): Promise<T> {
  const cfg = getCfg();
  const clean = String(relPath || '').replace(/^\/+/, '');
  const bases = Array.from(
    new Set([cfg.CDN_BASE, cfg.CDN2_BASE].filter((b): b is string => Boolean(b))),
  );
  let lastErr: unknown = new Error(`Failed to fetch CDN resource: ${clean}`);
  for (const base of bases) {
    const url = `${base.replace(/\/+$/, '')}/${clean}`;
    try {
      const resp = await fetch(url, { credentials: 'omit' });
      if (resp.ok) {
        return (await resp.json()) as T;
      }
      lastErr = new Error(`HTTP ${resp.status} for ${url}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

let turnstilePromise: Promise<TurnstileGlobal | null> | null = null;

export function loadTurnstileApi(): Promise<TurnstileGlobal | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.turnstile && typeof window.turnstile.render === 'function') {
    return Promise.resolve(window.turnstile);
  }
  if (turnstilePromise) return turnstilePromise;

  turnstilePromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-st-turnstile="1"]');
    if (existing) {
      let ticks = 0;
      const poll = window.setInterval(() => {
        ticks += 1;
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          window.clearInterval(poll);
          resolve(window.turnstile);
        } else if (ticks >= 40) {
          window.clearInterval(poll);
          resolve(null);
        }
      }, 200);
      return;
    }

    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.dataset.stTurnstile = '1';
    s.onload = () => resolve(window.turnstile || null);
    s.onerror = () => {
      turnstilePromise = null;
      resolve(null);
    };
    document.head.appendChild(s);
  });

  return turnstilePromise;
}

export function isWebviewClient(): boolean {
  try {
    const cfg = window.STEAMTOOLS_CONFIG;
    return Boolean(cfg && typeof cfg.isInAppWebview === 'function' && cfg.isInAppWebview());
  } catch {
    return false;
  }
}
