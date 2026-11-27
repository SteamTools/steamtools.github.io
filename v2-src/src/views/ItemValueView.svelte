<script lang="ts">
  import { onMount } from 'svelte';
  import {
    apiRequestWithFailover,
    getCfg,
    getImporter,
    loadTurnstileApi,
    trackEvent,
  } from '../lib/bridge.ts';
  import { currencyStore } from '../lib/currency.svelte.ts';
  import {
    APP_NAME_MAP,
    buildInventoryCsv,
    filterAndSortItems,
    getAppIconUrl,
    getDisplayRowUsd,
    ITEM_SUBTYPES_753,
    normalizeInventoryItems,
    TOP_6_APPS_META,
    VIS_COLS_BY_APP,
    type ItemColumnKey,
    type ItemSubtype753,
    type NormalizedInventoryItem,
    type RawInventoryItem,
  } from '../lib/itemvalue-logic.ts';
  import { themeStore } from '../lib/theme.svelte.ts';

  const MAX_AUTO_RETRIES = 2;
  const GRID_CHUNK_SIZE = 120;

  let userIdInput = $state('');
  let selectedAppid = $state('753');
  let appidLoaded = $state('0');

  let items = $state.raw<NormalizedInventoryItem[]>([]);
  let isLoading = $state(false);
  let isStaleData = $state(false);
  let showImportCta = $state(false);
  let statusMsg = $state('Enter a SteamID above or click Manual import');
  let helpMode = $state<0 | 1 | 2 | 'profile'>(0);
  let profileName = $state('');

  // Filters & view state
  let subtype = $state<ItemSubtype753>('all');
  let useFee = $state(false);
  let dupesOnly = $state(false);
  let useStackPrice = $state(false);
  let searchQuery = $state('');
  let useTable = $state(true);
  let forceTableOnly = $state(false);

  // Table sort & pagination
  let sortKey = $state<Exclude<ItemColumnKey, 'image'>>('price');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let sortAnnouncement = $state('');
  let pageSize = $state<number>(50);
  let currentPage = $state<number>(1);
  let gridExpanded = $state(false);

  // Turnstile & session pass state
  let turnstileConfigured = $state(true);
  let turnstileToken = $state('');
  let turnstileWidgetId: string | null = null;
  let turnstileRenderedTheme: 'light' | 'dark' | null = null;
  let turnstileNeedsRefresh = false;
  let pendingFetchAfterTurnstile = $state(false);
  let passKey = $state('');
  let passTs = $state('');
  let passExpiresAt = $state(0);

  // Floating 360px preview
  let hoverPreviewUrl = $state('');
  let hoverPreviewName = $state('');
  let hoverPreviewPos = $state({ left: 0, top: 0 });

  // DOM refs & timers
  let steamIdInputEl: HTMLInputElement | undefined = $state();
  let turnstileContainerEl: HTMLDivElement | undefined = $state();
  let retryTimer: number | undefined;
  let retries = 0;

  let hasValidPass = $derived(
    Boolean(passKey && passTs && Date.now() < passExpiresAt),
  );

  let visibleColumns = $derived<readonly ItemColumnKey[]>(
    (VIS_COLS_BY_APP[appidLoaded] || VIS_COLS_BY_APP['753']).filter((col) => {
      if (col === 'image' && forceTableOnly) return false;
      return true;
    }),
  );

  let filteredSummary = $derived(
    filterAndSortItems(items, {
      appidLoaded,
      subtype,
      dupesOnly,
      useFee,
      useStackPrice,
      query: searchQuery,
      sortKey,
      sortDir,
    }),
  );

  let totalPages = $derived(
    pageSize <= 0
      ? 1
      : Math.max(1, Math.ceil(filteredSummary.filtered.length / pageSize)),
  );

  let safePage = $derived(Math.min(currentPage, totalPages));

  let pagedTableItems = $derived(
    pageSize <= 0
      ? filteredSummary.filtered
      : filteredSummary.filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
  );

  let gridDisplayItems = $derived(
    gridExpanded ? filteredSummary.filtered : filteredSummary.filtered.slice(0, 480),
  );

  let gridChunks = $derived.by(() => {
    const src = gridDisplayItems;
    const chunks: NormalizedInventoryItem[][] = [];
    for (let i = 0; i < src.length; i += GRID_CHUNK_SIZE) {
      chunks.push(src.slice(i, i + GRID_CHUNK_SIZE));
    }
    return chunks;
  });

  function cancelPendingRetry() {
    if (retryTimer !== undefined) {
      window.clearTimeout(retryTimer);
      retryTimer = undefined;
    }
  }

  function resetTurnstileWidget() {
    turnstileToken = '';
    turnstileNeedsRefresh = false;
    if (window.turnstile && turnstileWidgetId !== null) {
      try {
        window.turnstile.reset(turnstileWidgetId);
      } catch {
        // Ignore teardown race
      }
    }
  }

  async function mountTurnstile(desiredTheme: 'light' | 'dark') {
    if (!turnstileConfigured || !turnstileContainerEl) return;
    const cfg = getCfg();
    const api = await loadTurnstileApi();
    if (!api || !turnstileContainerEl) {
      pendingFetchAfterTurnstile = false;
      statusMsg = 'Anti-bot check failed to load — click Manual import (no captcha) to load your items.';
      showImportCta = true;
      trackEvent('turnstile_err', { app: 'itemvalue', a: 'script_load' });
      return;
    }
    if (turnstileWidgetId !== null) {
      try {
        api.remove(turnstileWidgetId);
      } catch {
        // Ignore
      }
      turnstileWidgetId = null;
    }
    turnstileRenderedTheme = desiredTheme;
    turnstileWidgetId = api.render(turnstileContainerEl, {
      sitekey: cfg.TURNSTILE_SITEKEY,
      action: 'item_value',
      theme: desiredTheme,
      appearance: 'interaction-only',
      callback: (token: string) => {
        turnstileToken = token || '';
        turnstileNeedsRefresh = false;
        if (pendingFetchAfterTurnstile && turnstileToken && !isLoading) {
          pendingFetchAfterTurnstile = false;
          startFetchSubmit();
        }
      },
      'expired-callback': () => {
        turnstileToken = '';
        trackEvent('turnstile_err', { app: 'itemvalue', a: 'expired' });
        if (hasValidPass) return;
        if (typeof document !== 'undefined' && document.hidden) {
          turnstileNeedsRefresh = true;
        } else {
          resetTurnstileWidget();
        }
      },
      'error-callback': () => {
        turnstileToken = '';
        pendingFetchAfterTurnstile = false;
        statusMsg = 'Anti-bot check failed — click Manual import (no captcha) or reload.';
        showImportCta = true;
        trackEvent('turnstile_err', { app: 'itemvalue', a: 'widget_err' });
      },
    });
  }

  $effect(() => {
    const scheme = themeStore.effectiveScheme;
    if (
      typeof window !== 'undefined' &&
      turnstileConfigured &&
      !hasValidPass &&
      turnstileContainerEl &&
      turnstileRenderedTheme !== null &&
      turnstileRenderedTheme !== scheme &&
      !turnstileToken
    ) {
      void mountTurnstile(scheme);
    }
  });

  function applyValuedItems(
    rawItems: RawInventoryItem[],
    targetAppid: string,
    opts: { statusMessage?: string; profileName?: string; stale?: boolean } = {},
  ) {
    const normalized = normalizeInventoryItems(Array.isArray(rawItems) ? rawItems : []);
    subtype = 'all';
    appidLoaded = String(targetAppid);
    isStaleData = Boolean(opts.stale);
    items = normalized;
    currentPage = 1;
    gridExpanded = false;

    if (normalized.length > 0) {
      const hasIcons = normalized.some((i) => Boolean(i.icon));
      forceTableOnly = !hasIcons;
      if (forceTableOnly) {
        useTable = true;
      }
      statusMsg = opts.statusMessage || '';
      if (opts.profileName) {
        profileName = opts.profileName;
        helpMode = 'profile';
      } else {
        profileName = '';
        helpMode = 0;
      }
    } else {
      const appLabel = APP_NAME_MAP[selectedAppid] || 'game';
      statusMsg = `No ${appLabel} items found.`;
      profileName = '';
      helpMode = 0;
    }
  }

  function startFetchSubmit() {
    if (isLoading) return;
    const cleanId = userIdInput.trim();
    if (!cleanId) {
      statusMsg = 'Enter your SteamID64, custom URL name, or Steam profile link first, or click Manual import.';
      steamIdInputEl?.focus();
      return;
    }
    if (!hasValidPass && !turnstileToken) {
      if (turnstileConfigured) {
        pendingFetchAfterTurnstile = true;
        statusMsg = 'Waiting for anti-bot check to finish (or click Manual import)...';
        showImportCta = true;
        if (turnstileWidgetId === null) {
          void mountTurnstile(themeStore.effectiveScheme);
        } else if (turnstileNeedsRefresh) {
          resetTurnstileWidget();
        }
      } else {
        statusMsg = 'Anti-bot sitekey is not configured — use Manual import instead.';
        showImportCta = true;
      }
      return;
    }

    pendingFetchAfterTurnstile = false;
    cancelPendingRetry();
    items = [];
    showImportCta = false;
    try {
      window.localStorage.setItem('lastUser', cleanId);
      window.localStorage.setItem('lastAppid', selectedAppid);
    } catch {
      // Ignore
    }
    retries = 0;
    void fetchItems(cleanId, selectedAppid, false, false);
  }

  async function fetchItems(
    user: string,
    appid: string,
    huge: boolean,
    skipClientPrice: boolean,
  ): Promise<void> {
    const cfg = getCfg();
    const imp = getImporter();
    isLoading = true;
    statusMsg = 'Loading...';
    helpMode = 0;

    let path = `/ItemValue?i=1&v=2&id=${encodeURIComponent(user)}&app=${encodeURIComponent(appid)}`;
    if (huge) path += '&huge=1';
    const canClientPrice = Boolean(!skipClientPrice && imp?.priceServerItemValuePayload);
    if (canClientPrice) path += '&client_price=1';

    let usedTurnstile = false;
    const reqHeaders: Record<string, string> = {};
    if (hasValidPass) {
      path += `&ts=${encodeURIComponent(passTs)}&key=${encodeURIComponent(passKey)}`;
    } else if (turnstileToken) {
      reqHeaders['X-Turnstile-Token'] = turnstileToken;
      usedTurnstile = true;
      resetTurnstileWidget();
    } else {
      isLoading = false;
      showImportCta = true;
      statusMsg = 'Verification required, or use Import from Steam.';
      return;
    }

    try {
      const response = await apiRequestWithFailover(path, {
        method: 'GET',
        headers: reqHeaders,
        withCredentials: true,
      });
      isLoading = false;
      const data = response?.data;
      if (!data) return;

      if (data.help === 1 || data.help === 2) {
        helpMode = data.help;
      }
      if (data.key && data.ts) {
        passKey = String(data.key);
        passTs = String(data.ts);
        passExpiresAt = Date.now() + 9 * 60 * 1000;
      } else if (usedTurnstile) {
        passKey = '';
        passTs = '';
        passExpiresAt = 0;
      }

      if (data.success === false) {
        const errCode = String(data.error || '');
        const isRateLimited = errCode === 'rate_limited' || /rate|429/i.test(data.reason || '');
        const isPrivate = errCode === 'private_or_unavailable' || data.help === 1 || /private/i.test(data.reason || '');
        const isHuge = errCode === 'huge_inventory' || Boolean(data.huge);
        if (isRateLimited || isPrivate || isHuge) {
          showImportCta = true;
        }
        const retryAfterSec = typeof data.retry_after === 'number' && data.retry_after > 0
          ? data.retry_after
          : null;
        if (data.retry && retries < MAX_AUTO_RETRIES && hasValidPass && (!retryAfterSec || retryAfterSec <= 15)) {
          const attempt = retries;
          retries += 1;
          const baseSec = retryAfterSec || Math.pow(2, attempt);
          const delayMs = Math.min(30000, Math.round(baseSec * 1000 + Math.random() * 400));
          statusMsg = `Steam temporary error — retrying in ${Math.ceil(delayMs / 1000)}s (${retries}/${MAX_AUTO_RETRIES})... Or click Import from Steam.`;
          retryTimer = window.setTimeout(() => void fetchItems(user, appid, huge, skipClientPrice), delayMs);
          return;
        }
        statusMsg = `Failed: ${data.reason || errCode || 'Request could not complete.'}`;
        if (retryAfterSec) {
          statusMsg += ` Retry after ${retryAfterSec}s, or use Import from Steam.`;
        }
        trackEvent('fetch_err', { app: 'itemvalue', a: appid, b: errCode || 'api_fail' });
        try {
          window.localStorage.removeItem('lastUser');
        } catch {
          // Ignore
        }
        return;
      }

      if (data.name) {
        document.location.hash = `/${encodeURIComponent(String(data.name))}-${appid}`;
      }
      if (!Array.isArray(data.items) && data.items_v2) {
        data.items = cfg.unpackItemValueV2(data.items_v2, appid);
      }
      if (data.unpriced && imp?.priceServerItemValuePayload) {
        isLoading = true;
        const count = Array.isArray(data.items) ? data.items.length : 0;
        statusMsg = `Pricing ${count} item(s) from SteamTools CDN...`;
        try {
          const valued = await imp.priceServerItemValuePayload(data.items, appid, { config: cfg });
          isLoading = false;
          trackEvent('fetch_ok', {
            app: 'itemvalue',
            a: appid,
            n: Array.isArray(valued.items) ? valued.items.length : 0,
          });
          applyValuedItems(valued.items, appid, {
            profileName: data.name,
            stale: Boolean(data.stale),
          });
        } catch {
          if (!skipClientPrice && hasValidPass) {
            void fetchItems(user, appid, huge, true);
            return;
          }
          isLoading = false;
          showImportCta = true;
          statusMsg = 'Failed to load prices from CDN — try Import from Steam.';
          trackEvent('fetch_err', { app: 'itemvalue', a: appid, b: 'cdn_price_err' });
        }
        return;
      }

      trackEvent('fetch_ok', {
        app: 'itemvalue',
        a: appid,
        n: Array.isArray(data.items) ? data.items.length : 0,
      });
      applyValuedItems(data.items, appid, {
        profileName: data.name,
        stale: Boolean(data.stale),
      });
    } catch (response: any) {
      isLoading = false;
      const body = response?.data;
      const status = response?.status;
      const detailObj = body?.detail && typeof body.detail === 'object' ? body.detail : null;
      const errCode = String(body?.error || detailObj?.error || '');
      const errReason =
        body?.reason ||
        body?.message ||
        detailObj?.reason ||
        detailObj?.message ||
        detailObj?.detail ||
        (typeof body?.detail === 'string' ? body.detail : '');
      const helpCode = body?.help === 1 || body?.help === 2
        ? body.help
        : (detailObj?.help === 1 || detailObj?.help === 2 ? detailObj.help : 0);

      const retryHeader = typeof response?.headers === 'function'
        ? Number.parseInt(String(response.headers('Retry-After') || ''), 10)
        : Number.NaN;
      const retryAfterSec = typeof body?.retry_after === 'number'
        ? body.retry_after
        : (typeof detailObj?.retry_after === 'number'
          ? detailObj.retry_after
          : (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : null));

      const isCaptchaOrPassError =
        errCode === 'captcha_failed' ||
        errCode === 'captcha_required' ||
        errCode === 'invalid_pass' ||
        (!errCode && status === 403 && /turnstile|captcha|pass/i.test(String(errReason)));

      if (isCaptchaOrPassError) {
        passKey = '';
        passTs = '';
        passExpiresAt = 0;
        if (!usedTurnstile) {
          resetTurnstileWidget();
        }
        statusMsg = 'Verification expired or failed. Complete Turnstile again or use Import from Steam.';
        showImportCta = true;
        trackEvent('fetch_err', { app: 'itemvalue', a: appid, b: errCode || 'captcha_fail' });
        return;
      }

      if (body?.key && body?.ts) {
        passKey = String(body.key);
        passTs = String(body.ts);
        passExpiresAt = Date.now() + 9 * 60 * 1000;
      }
      if (helpCode === 1 || helpCode === 2) {
        helpMode = helpCode;
      }

      if (status === 413 || errCode === 'huge_inventory') {
        showImportCta = true;
        statusMsg = errReason
          ? String(errReason)
          : 'This inventory has over 20,000 items — use Import from Steam to load and price it locally.';
        trackEvent('fetch_err', { app: 'itemvalue', a: appid, b: 'huge_inventory' });
        return;
      }

      if (errCode === 'private_or_unavailable' || (status === 403 && helpCode === 1)) {
        if (!helpCode) helpMode = 1;
        showImportCta = true;
        statusMsg = errReason
          ? String(errReason)
          : 'Steam inventory is private or unavailable — check privacy settings or use Import from Steam.';
        trackEvent('fetch_err', { app: 'itemvalue', a: appid, b: 'private' });
        try {
          window.localStorage.removeItem('lastUser');
        } catch {
          // Ignore
        }
        return;
      }

      if (status === 429 || errCode === 'rate_limited') {
        showImportCta = true;
        if (retries < MAX_AUTO_RETRIES && hasValidPass && (!retryAfterSec || retryAfterSec <= 15)) {
          const attempt = retries;
          retries += 1;
          const baseSec = retryAfterSec || Math.pow(2, attempt);
          const delayMs = Math.min(30000, Math.round(baseSec * 1000 + Math.random() * 400));
          statusMsg = `Rate limited by Steam — retrying in ${Math.ceil(delayMs / 1000)}s (${retries}/${MAX_AUTO_RETRIES})... Or click Import from Steam.`;
          retryTimer = window.setTimeout(() => void fetchItems(user, appid, huge, skipClientPrice), delayMs);
          return;
        }
        statusMsg = `Rate limited by Steam${retryAfterSec ? ` (retry after ${retryAfterSec}s)` : ''} — use Import from Steam for instant results.`;
        trackEvent('fetch_err', { app: 'itemvalue', a: appid, b: 'rate_limited' });
        return;
      }

      if (body?.retry && retries < MAX_AUTO_RETRIES && hasValidPass && (!retryAfterSec || retryAfterSec <= 15)) {
        const attempt = retries;
        retries += 1;
        const baseSec = retryAfterSec || Math.pow(2, attempt);
        const delayMs = Math.min(30000, Math.round(baseSec * 1000 + Math.random() * 400));
        statusMsg = `Steam temporary error — retrying in ${Math.ceil(delayMs / 1000)}s (${retries}/${MAX_AUTO_RETRIES})... Or click Import from Steam.`;
        retryTimer = window.setTimeout(() => void fetchItems(user, appid, huge, skipClientPrice), delayMs);
        return;
      }

      showImportCta = true;
      statusMsg = errReason
        ? String(errReason)
        : 'Something went wrong — try again later or use Manual import.';
      trackEvent('fetch_err', {
        app: 'itemvalue',
        a: appid,
        b: errCode || (status ? `http_${status}` : 'net_err'),
      });
      if (!hasValidPass && !usedTurnstile) {
        resetTurnstileWidget();
      }
    }
  }

  function openImportModal(initialJson?: string) {
    const imp = getImporter();
    const cfg = getCfg();
    if (!imp) return;
    pendingFetchAfterTurnstile = false;
    cancelPendingRetry();
    imp.openImportDialog({
      mode: 'itemvalue',
      appid: selectedAppid,
      lockApp: false,
      steamId: userIdInput.trim(),
      initialJson: typeof initialJson === 'string' ? initialJson : undefined,
      title: `Import Inventory for ${APP_NAME_MAP[selectedAppid] || 'Steam'}`,
      subtitle: 'Load and price your Steam items locally in your browser — no captchas or rate limits.',
      onImport: (parsed: any) => {
        const targetApp = TOP_6_APPS_META.some((a) => a.appid === parsed.detected_appid)
          ? String(parsed.detected_appid)
          : selectedAppid;
        if (parsed?.steamid64 && !userIdInput.trim()) {
          userIdInput = String(parsed.steamid64);
        }
        selectedAppid = targetApp;
        isLoading = true;
        showImportCta = false;
        statusMsg = `Pricing ${Array.isArray(parsed?.items) ? parsed.items.length : 0} unique item(s) from SteamTools CDN...`;
        helpMode = 0;

        void imp
          .valueInventoryClientSide(parsed.items, targetApp, { config: cfg })
          .then((valued) => {
            isLoading = false;
            const msg = `Imported ${valued.items.length} unique market item(s) across ${parsed.page_count} page(s).`;
            applyValuedItems(valued.items, targetApp, { statusMessage: msg });
          })
          .catch((err: any) => {
            isLoading = false;
            statusMsg = `CDN pricing failed: ${err?.message || 'Network error'}`;
          });
      },
    });
  }

  function exportCsv() {
    const cfg = getCfg();
    trackEvent('export', { app: 'itemvalue', a: 'csv' });
    const text = buildInventoryCsv(filteredSummary.filtered, useFee, cfg.escapeCsvFormula);
    cfg.openTextExportDialog({
      title: `Export Inventory CSV (${filteredSummary.filtered.length} items)`,
      label: 'CSV data (formula-safe)',
      text,
      filename: `steam-inventory-${appidLoaded || selectedAppid}.csv`,
      mimeType: 'text/csv;charset=utf-8',
    });
  }

  function selectApp(appid: string) {
    selectedAppid = appid;
    try {
      window.localStorage.setItem('appid', appid);
    } catch {
      // Ignore
    }
  }

  function setViewMode(tableMode: boolean) {
    useTable = tableMode;
    if (!forceTableOnly) {
      try {
        window.localStorage.setItem('useTable', JSON.stringify(tableMode));
      } catch {
        // Ignore
      }
    }
  }

  function toggleSort(col: Exclude<ItemColumnKey, 'image'>) {
    if (sortKey === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = col;
      sortDir = col === 'name' || col === 'game' || col === 'type' ? 'asc' : 'desc';
    }
    currentPage = 1;
    sortAnnouncement = `Sorted by ${col}, ${sortDir === 'asc' ? 'ascending' : 'descending'}`;
  }

  function showPreview(item: NormalizedInventoryItem, ev: MouseEvent | FocusEvent) {
    const cfg = getCfg();
    if (!item.icon) return;
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const size = 280;
    const left = Math.min(window.innerWidth - size - 12, Math.max(8, rect.right + 10));
    const top = Math.min(window.innerHeight - size - 12, Math.max(8, rect.top - 40));
    hoverPreviewPos = { left, top };
    hoverPreviewName = item.name;
    hoverPreviewUrl = `${cfg.STEAM_ECON_BASE}/image/${item.icon}/360fx360f`;
  }

  function hidePreview() {
    hoverPreviewUrl = '';
  }

  function getProfileInventoryUrl(name: string, app: string): string {
    const base = /^\d{17}$/.test(name) ? `profiles/${name}` : `id/${encodeURIComponent(name)}`;
    return `https://steamcommunity.com/${base}/inventory/#${encodeURIComponent(app || '753')}`;
  }

  const colHeaders: Record<ItemColumnKey, { label: string; align: 'left' | 'right' | 'center' }> = {
    image: { label: 'Icon', align: 'center' },
    name: { label: 'Item Name', align: 'left' },
    game: { label: 'Game', align: 'left' },
    type: { label: 'Type', align: 'center' },
    quality: { label: 'Quality', align: 'center' },
    rarity: { label: 'Rarity', align: 'center' },
    count: { label: 'Count', align: 'right' },
    price: { label: 'Price', align: 'right' },
  };

  onMount(() => {
    const cfg = getCfg();
    turnstileConfigured = cfg.isTurnstileConfigured();

    try {
      const savedUser = window.localStorage.getItem('lastUser');
      if (savedUser && savedUser !== 'undefined') userIdInput = savedUser;

      const savedApp = window.localStorage.getItem('appid') || window.localStorage.getItem('lastAppid');
      if (savedApp && TOP_6_APPS_META.some((a) => a.appid === savedApp)) {
        selectedAppid = savedApp;
      }

      const savedUseTable = window.localStorage.getItem('useTable');
      if (savedUseTable !== null) {
        useTable = JSON.parse(savedUseTable) !== false;
      }
    } catch {
      // Ignore storage errors
    }

    const rawHash = window.location.hash.slice(1).replace(/^\//, '');
    if (rawHash.trim()) {
      const dashPos = rawHash.lastIndexOf('-');
      if (dashPos >= 0) {
        let name = rawHash.slice(0, dashPos);
        try {
          name = decodeURIComponent(name);
        } catch {
          // Ignore decode errors
        }
        const appPart = rawHash.slice(dashPos + 1);
        if (TOP_6_APPS_META.some((a) => a.appid === appPart)) {
          userIdInput = name;
          selectedAppid = appPart;
          statusMsg = `Click Fetch to load ${name}, or click Manual import.`;
        }
      }
    }

    if (steamIdInputEl) {
      cfg.attachSteamIdPasteGuard(steamIdInputEl, {
        onJsonPaste: (text) => openImportModal(text),
        onOversizedPaste: () => {
          statusMsg = 'Pasted text is too long for a SteamID — click Manual import to paste JSON.';
          showImportCta = true;
        },
      });
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && turnstileNeedsRefresh && !hasValidPass && !turnstileToken) {
        resetTurnstileWidget();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (!hasValidPass && turnstileConfigured) {
      void mountTurnstile(themeStore.effectiveScheme);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelPendingRetry();
      if (window.turnstile && turnstileWidgetId !== null) {
        try {
          window.turnstile.remove(turnstileWidgetId);
        } catch {
          // Ignore
        }
      }
    };
  });
</script>

<section class="st-panel" aria-label="Inventory Controls, Games, and Filters">
  <!-- Row 1: SteamID Fetch + Manual import + Verified pass + Profile links -->
  <div class="st-deck-row">
    <form
      class="st-deck-group"
      onsubmit={(e) => {
        e.preventDefault();
        startFetchSubmit();
      }}
    >
      <label for="st-iv-steamid" style="font-weight: 600;">SteamID:</label>
      <div class="st-join">
        <input
          id="st-iv-steamid"
          bind:this={steamIdInputEl}
          bind:value={userIdInput}
          type="text"
          maxlength="256"
          class="st-input"
          style="width: min(240px, 56vw);"
          placeholder="SteamID64, custom URL, or profile link"
          autocorrect="off"
          autocapitalize="none"
          spellcheck="false"
        />
        <button type="submit" class="st-btn st-btn-primary" disabled={isLoading}>
          Fetch
        </button>
      </div>
      <button type="button" class="st-btn" onclick={() => openImportModal()}>
        Manual import
      </button>
      {#if hasValidPass}
        <span
          class="st-pass-badge"
          title="Verification pass active — no captcha needed for follow-up fetches."
        >
          <span class="st-pass-dot" aria-hidden="true"></span>
          Verified pass
        </span>
      {/if}
    </form>

    {#if profileName}
      <div class="st-profile-links">
        <a href={getProfileInventoryUrl(profileName, appidLoaded)} target="_blank" rel="noopener noreferrer">
          Steam Inventory ↗
        </a>
        <span style="color: var(--st-text-muted);">&middot;</span>
        <a href={`https://steamdb.info/calculator/?player=${encodeURIComponent(profileName)}`} target="_blank" rel="noopener noreferrer">
          SteamDB ↗
        </a>
        <span style="color: var(--st-text-muted);">&middot;</span>
        <a href={`https://rep.tf/${encodeURIComponent(profileName)}`} target="_blank" rel="noopener noreferrer">
          Rep.tf ↗
        </a>
      </div>
    {/if}
  </div>

  {#if !hasValidPass}
    <div style="margin-top: 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;">
      <div bind:this={turnstileContainerEl}></div>
      {#if !turnstileConfigured}
        <span style="font-size: 12px; color: var(--st-text-muted);">
          Anti-bot check unavailable — use <strong>Manual import</strong> (no captcha).
        </span>
      {/if}
    </div>
  {/if}

  <!-- Row 2: Compact 10-game selector -->
  <div class="st-deck-row">
    <div class="st-game-picker" role="group" aria-label="Select game">
      {#each TOP_6_APPS_META as app}
        <button
          type="button"
          class="st-app-btn"
          class:is-active={selectedAppid === app.appid}
          aria-pressed={selectedAppid === app.appid}
          title={app.name}
          onclick={() => selectApp(app.appid)}
        >
          <img src={getAppIconUrl(app.appid)} alt="" width="17" height="17" />
          <span>{app.shortName}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Row 3: Unified summary, valuation toggles, filter, CSV, and view mode -->
  {#if items.length > 0}
    <div class="st-deck-row">
      <div class="st-deck-group">
        <span class="st-iv-summary">
          <strong>Total:</strong>
          <span class="st-stat-val">{currencyStore.formatUsd(filteredSummary.totalUsd)}</span>
          <span class="st-iv-summary-meta">
            ({filteredSummary.totalCount.toLocaleString()} items &middot; {filteredSummary.filtered.length.toLocaleString()} unique)
          </span>
        </span>
        {#if isStaleData}
          <span class="st-pill is-loading">Cached snapshot (Steam throttled)</span>
        {/if}

        <div class="st-seg-group" role="group" aria-label="Valuation options">
          <button
            type="button"
            class="st-btn st-btn-sm"
            class:is-pressed={useFee}
            aria-pressed={useFee}
            title="Include Steam's ~15% selling fee"
            onclick={() => { useFee = !useFee; }}
          >
            Fees
          </button>
          <button
            type="button"
            class="st-btn st-btn-sm"
            class:is-pressed={dupesOnly}
            aria-pressed={dupesOnly}
            title="Only show duplicate items (count > 1)"
            onclick={() => { dupesOnly = !dupesOnly; currentPage = 1; }}
          >
            Dupes
          </button>
          <button
            type="button"
            class="st-btn st-btn-sm"
            class:is-pressed={useStackPrice}
            aria-pressed={useStackPrice}
            title="Show total price of stacks instead of unit price"
            onclick={() => { useStackPrice = !useStackPrice; }}
          >
            Stack Price
          </button>
        </div>

        {#if appidLoaded === '753'}
          <div class="st-seg-group" role="group" aria-label="Steam item subtype">
            {#each ITEM_SUBTYPES_753 as st}
              <button
                type="button"
                class="st-btn st-btn-sm"
                class:is-pressed={subtype === st}
                aria-pressed={subtype === st}
                onclick={() => { subtype = st; currentPage = 1; }}
              >
                {st === 'all' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="st-deck-group">
        <label for="st-iv-filter" class="st-visually-hidden">Filter items</label>
        <input
          id="st-iv-filter"
          type="search"
          class="st-input"
          style="width: min(190px, 50vw);"
          placeholder="Filter item, game, rarity..."
          bind:value={searchQuery}
          oninput={() => { currentPage = 1; }}
          autocorrect="off"
          autocapitalize="none"
          spellcheck="false"
        />
        <button type="button" class="st-btn st-btn-sm" onclick={exportCsv} title="Export filtered items to CSV">
          CSV
        </button>
        <div class="st-seg-group" role="group" aria-label="Display mode">
          <button
            type="button"
            class="st-btn st-btn-sm"
            class:is-pressed={useTable}
            aria-pressed={useTable}
            onclick={() => setViewMode(true)}
          >
            Table
          </button>
          <button
            type="button"
            class="st-btn st-btn-sm"
            class:is-pressed={!useTable}
            aria-pressed={!useTable}
            disabled={forceTableOnly}
            onclick={() => setViewMode(false)}
          >
            Grid
          </button>
        </div>
      </div>
    </div>
  {/if}
</section>

{#if statusMsg || helpMode === 1 || helpMode === 2 || showImportCta}
  <div class="st-alert" class:is-warn={showImportCta} role="status" aria-live="polite">
    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
      {#if statusMsg}
        <span>{statusMsg}</span>
      {/if}
      {#if helpMode === 1}
        <span>
          Make sure your
          <a href="https://steamcommunity.com/my/edit/settings" target="_blank" rel="noopener noreferrer">
            inventory privacy
          </a>
          is set to public, or click Manual import.
        </span>
      {:else if helpMode === 2}
        <span>
          Try pasting the
          <a href="https://steamcommunity.com/my/" target="_blank" rel="noopener noreferrer">
            Steam profile URL
          </a>.
        </span>
      {/if}
    </div>
    {#if showImportCta}
      <button type="button" class="st-btn st-btn-sm st-btn-primary" onclick={() => openImportModal()}>
        Manual import (No Captcha)
      </button>
    {/if}
  </div>
{/if}

{#if items.length > 0}

  {#if useTable}
    <div role="status" aria-live="polite" class="st-visually-hidden">{sortAnnouncement}</div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="st-table-region"
      role="region"
      aria-labelledby="st-iv-table-caption"
      tabindex="0"
      style="max-height: clamp(360px, 64dvh, 720px);"
    >
      <table class="st-table" class:is-empty={pagedTableItems.length === 0}>
        <caption id="st-iv-table-caption" class="st-visually-hidden">
          Steam Inventory Items Valued by Market Price
        </caption>
        <thead>
          <tr>
            {#each visibleColumns as col}
              {@const h = colHeaders[col]}
              <th
                scope="col"
                class:is-sticky-col={col === 'name'}
                class:is-left={h.align === 'left'}
                class:is-right={h.align === 'right'}
                aria-sort={col !== 'image' && sortKey === col
                  ? (sortDir === 'asc' ? 'ascending' : 'descending')
                  : undefined}
              >
                {#if col === 'image'}
                  <span>{h.label}</span>
                {:else}
                  <button
                    type="button"
                    class="st-sort-btn"
                    onclick={() => toggleSort(col)}
                  >
                    <span>
                      {col === 'price' && useStackPrice ? 'Stack Price' : h.label}
                    </span>
                    <span class="st-sort-icon" aria-hidden="true"></span>
                  </button>
                {/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#if pagedTableItems.length === 0}
            <tr>
              <td colspan={visibleColumns.length} class="st-cell-center" style="padding: 28px 16px; color: var(--st-text-muted);">
                No items match the current filter.
                {#if searchQuery.trim() || subtype !== 'all' || dupesOnly}
                  <button
                    type="button"
                    class="st-btn st-btn-sm"
                    style="margin-left: 8px;"
                    onclick={() => {
                      searchQuery = '';
                      subtype = 'all';
                      dupesOnly = false;
                      currentPage = 1;
                    }}
                  >
                    Clear filters
                  </button>
                {/if}
              </td>
            </tr>
          {:else}
            {#each pagedTableItems as item (item.id)}
              <tr>
                {#each visibleColumns as col}
                  {#if col === 'image'}
                    <td class="st-cell-center" style="width: 44px;">
                      {#if item.icon}
                        <button
                          type="button"
                          class="st-btn st-btn-sm"
                          style="padding: 2px; height: 24px;"
                          aria-label={`Preview ${item.name}`}
                          onmouseenter={(e) => showPreview(item, e)}
                          onmouseleave={hidePreview}
                          onfocus={(e) => showPreview(item, e)}
                          onblur={hidePreview}
                        >
                          <img
                            src={`${getCfg().STEAM_ECON_BASE}/image/${item.icon}/32fx32f`}
                            alt=""
                            width="20"
                            height="20"
                            loading="lazy"
                          />
                        </button>
                      {/if}
                    </td>
                  {:else if col === 'name'}
                    <td class="st-cell-left is-sticky-col" title={item.name}>
                      <a
                        href={item.marketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="st-item-color-pill"
                        style:--item-color={`#${item.color}`}
                      >
                        <span class="st-game-text" style="display: inline-block; max-width: 240px; vertical-align: bottom;">
                          {item.name}
                        </span>
                      </a>
                    </td>
                  {:else if col === 'game'}
                    <td class="st-cell-left" title={item.game}>
                      <span class="st-game-text" style="display: inline-block; max-width: 200px;">{item.game}</span>
                    </td>
                  {:else if col === 'type'}
                    <td class="st-cell-center">{item.type || '—'}</td>
                  {:else if col === 'quality'}
                    <td class="st-cell-center">
                      {#if item.quality}
                        <span class="st-item-color-pill is-badge" style:--item-color={`#${item.qcolor}`}>{item.quality}</span>
                      {:else}
                        —
                      {/if}
                    </td>
                  {:else if col === 'rarity'}
                    <td class="st-cell-center">
                      {#if item.rarity}
                        <span class="st-item-color-pill is-badge" style:--item-color={`#${item.rcolor}`}>{item.rarity}</span>
                      {:else}
                        —
                      {/if}
                    </td>
                  {:else if col === 'count'}
                    <td class="st-cell-right">{item.count}</td>
                  {:else if col === 'price'}
                    {@const rowUsd = getDisplayRowUsd(item, useFee, useStackPrice)}
                    <td class="st-cell-right">
                      {rowUsd > 0 ? currencyStore.formatUsd(rowUsd) : 'N/A'}
                    </td>
                  {/if}
                {/each}
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <div class="st-deck-row" style="margin-top: 8px;">
      <div class="st-deck-group">
        <label for="st-iv-pagesize">Rows per page:</label>
        <select
          id="st-iv-pagesize"
          name="pageSize"
          class="st-select"
          style="min-width: 68px;"
          bind:value={pageSize}
          onchange={() => { currentPage = 1; }}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={250}>250</option>
          <option value={500}>500</option>
          <option value={0}>All</option>
        </select>
      </div>

      {#if pageSize > 0 && totalPages > 1}
        <div class="st-deck-group">
          <button
            type="button"
            class="st-btn st-btn-sm"
            disabled={safePage <= 1}
            onclick={() => { currentPage = Math.max(1, safePage - 1); }}
          >
            Prev
          </button>
          <span style="font-size: 12px; font-variant-numeric: tabular-nums;">
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            class="st-btn st-btn-sm"
            disabled={safePage >= totalPages}
            onclick={() => { currentPage = Math.min(totalPages, safePage + 1); }}
          >
            Next
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="st-item-grid-well">
      {#if filteredSummary.filtered.length === 0}
        <div class="st-empty-well">
          <span>No items match the current filter.</span>
          {#if searchQuery.trim() || subtype !== 'all' || dupesOnly}
            <button
              type="button"
              class="st-btn st-btn-sm"
              onclick={() => {
                searchQuery = '';
                subtype = 'all';
                dupesOnly = false;
                currentPage = 1;
              }}
            >
              Clear filters
            </button>
          {/if}
        </div>
      {/if}
      {#each gridChunks as chunk, chunkIdx}
        <div class="st-item-chunk" class:st-deferred-chunk={chunkIdx > 0}>
          {#each chunk as item (item.id)}
            {@const rowUsd = getDisplayRowUsd(item, useFee, useStackPrice)}
            <a
              class="st-item-tile"
              href={item.marketUrl}
              target="_blank"
              rel="noopener noreferrer"
              style:border={`2px solid #${item.color}`}
              style:background-color={`#${item.bg}`}
              title={item.name}
            >
              {#if item.count !== 1}
                <span class="st-tile-count">x{item.count}</span>
              {/if}
              {#if item.rarity || item.rcolor}
                <span
                  class="st-tile-rarity"
                  style:background-color={`#${item.rcolor}`}
                  title={item.rarity}
                ></span>
              {/if}
              {#if item.icon}
                <img
                  src={`${getCfg().STEAM_ECON_BASE}/image/${item.icon}/62fx62f`}
                  width="62"
                  height="62"
                  loading="lazy"
                  alt={item.name}
                />
              {:else}
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 62px; height: 62px; font-size: 11px; color: #bbb;">
                  No icon
                </span>
              {/if}
              <span class="st-tile-price">
                {rowUsd > 0 ? currencyStore.formatUsd(rowUsd) : 'N/A'}
              </span>
            </a>
          {/each}
        </div>
      {/each}

      {#if !gridExpanded && filteredSummary.filtered.length > 480}
        <div style="text-align: center; margin-top: 10px;">
          <button type="button" class="st-btn st-btn-sm" onclick={() => { gridExpanded = true; }}>
            Show all ({filteredSummary.filtered.length.toLocaleString()} items)
          </button>
        </div>
      {/if}
    </div>
  {/if}
{/if}

{#if hoverPreviewUrl}
  <div
    class="st-item-preview"
    style:left={`${hoverPreviewPos.left}px`}
    style:top={`${hoverPreviewPos.top}px`}
    role="presentation"
  >
    <img src={hoverPreviewUrl} alt={hoverPreviewName} width="266" height="266" style="display: block;" />
  </div>
{/if}
