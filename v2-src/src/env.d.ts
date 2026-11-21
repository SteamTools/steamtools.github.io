/// <reference types="svelte" />
/// <reference types="vite/client" />

declare const __ST_SENTRY_RELEASE__: string;

interface SteamToolsCurrency {
  name: string;
  symbolFormat: string;
  right: boolean;
  ratio: number;
}

interface SteamToolsConfigGlobal {
  CDN_BASE: string;
  CDN2_BASE: string;
  STEAM_ECON_BASE: string;
  EMOTE_CORS_BASE: string;
  API_BASE: string;
  API_POOL: string[];
  AUTH_BASE: string;
  GAMES_API_BASE: string;
  TURNSTILE_SITEKEY: string;
  USE_753_BUCKETS: boolean;
  USE_440_BUCKETS: boolean;
  CURRENCY_DATA: SteamToolsCurrency[];
  TOP_6_APPS: Array<{ appid: string; name: string; contextid: string }>;
  isTurnstileConfigured(): boolean;
  getContextId(appid: string): string;
  httpRequestWithFailover(
    httpClient: (cfg: Record<string, unknown>) => Promise<unknown>,
    pathAndQuery: string,
    reqConfig?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<{ status: number; data: any; headers?: (name: string) => string | null }>;
  fetchJsonWithFailover(
    pathAndQuery: string,
    options?: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; data: any; base: string }>;
  getManifest(options?: Record<string, unknown>): Promise<any>;
  resolveDatasetUrl(logicalKey: string, options?: Record<string, unknown>): Promise<string>;
  getDatasetJson(httpClient: unknown, logicalKey: string, options?: Record<string, unknown>): Promise<any>;
  loadCurrencyRates(httpClient: unknown): Promise<{ updated: number; total: number; cached?: boolean; error?: boolean }>;
  getSavedCurIndex(): number;
  formatPriceUsd(usdValue: number | string | null | undefined, curIndex: number, opts?: { noCurrency?: boolean; noApprox?: boolean }): string;
  openTextExportDialog(options: Record<string, unknown>): HTMLDialogElement | null;
  checkAuthSession(httpClient: { get(url: string, opts?: Record<string, unknown>): Promise<unknown> }): Promise<{ authenticated: boolean; steamid: string | null; source: string | null }>;
  getLoginUrl(returnTo?: string): string;
  performLogout(httpClient: { post(url: string, data: unknown, opts?: Record<string, unknown>): Promise<unknown> }): Promise<{ ok: boolean }>;
  escapeCsvFormula(str: unknown): string;
  escapeHtml(str: unknown): string;
  fnv1a32Hex64(key: string): string;
  fnv1a32Hex256?(key: string): string;
  normalizeSteamAssetUrl?(url: string): string;
  unpackGalleryV2(doc: unknown): any[];
  unpackGalleryV3(catalogDoc: unknown, pricesDoc: unknown): { items: any[]; dates: Record<string, number> | null } | null;
  unpackSetDataV2(doc: unknown): any;
  unpackItemValueV2(v2Doc: unknown, fallbackAppid?: string): any[] | null;
  attachSteamIdPasteGuard(
    inputEl: HTMLElement | null,
    callbacks: { onJsonPaste?: (text: string) => void; onOversizedPaste?: (text: string) => void }
  ): void;
  isInAppWebview(ua?: string): boolean;
  track?(eventName: string, props?: Record<string, unknown>): boolean;
}

interface SteamToolsImportGlobal {
  openImportDialog(options: Record<string, unknown>): void;
  sanitizeEmoteName?(raw: string): string;
  valueInventoryClientSide(
    items: any[],
    appid: string,
    options?: Record<string, unknown>
  ): Promise<{ items: any[]; usedBucketFallback: boolean; bucketsFetched: string[] }>;
  priceServerItemValuePayload(
    items: any[],
    appid: string,
    options?: Record<string, unknown>
  ): Promise<{ items: any[]; usedBucketFallback: boolean; bucketsFetched: string[] }>;
}

interface TurnstileGlobal {
  render(
    container: string | HTMLElement,
    params: {
      sitekey: string;
      action?: string;
      theme?: 'light' | 'dark' | 'auto';
      appearance?: 'always' | 'execute' | 'interaction-only';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    }
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

interface Window {
  STEAMTOOLS_CONFIG?: SteamToolsConfigGlobal;
  SteamToolsConfig?: SteamToolsConfigGlobal;
  SteamToolsImport?: SteamToolsImportGlobal;
  SteamToolsImportWorker?: Record<string, unknown>;
  turnstile?: TurnstileGlobal;
}
