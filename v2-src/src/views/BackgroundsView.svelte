<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import DualRangeSlider from '../components/DualRangeSlider.svelte';
  import {
    apiRequestWithFailover,
    computeShardHex64,
    fetchCdnJson,
    getCfg,
    getImporter,
    httpShim,
    loadDataset,
    normalizeAssetUrl,
  } from '../lib/bridge.ts';
  import { currencyStore } from '../lib/currency.svelte.ts';
  import { enhanceModalDialog } from '../lib/dialog.ts';
  import {
    BG_ORDER_OPTIONS,
    buildHashFilter,
    buildSteamMarketUrl,
    filterAndSortGallery,
    formatReleaseDate,
    getBgFallbackImgUrl,
    normalizeBgOwnedKey,
    normalizeGalleryItems,
    parseHashFilter,
    rerollRandomRanks,
    resolveBgLightboxImageUrl,
    type GalleryItem,
    type GalleryOrderKey,
  } from '../lib/gallery-logic.ts';

  const PAGE_STEP = 80;

  let allItems = $state<GalleryItem[]>([]);
  let isLoading = $state(true);
  let loadError = $state('');

  let query = $state('');
  let hueMin = $state(0);
  let hueMax = $state(255);
  let brightMin = $state(0);
  let brightMax = $state(255);
  let satMin = $state(0);
  let satMax = $state(255);
  let priceCentsMin = $state(0);
  let priceCentsMax = $state(5000);
  let order = $state<GalleryOrderKey>('date');
  let reversed = $state(true);
  let ownedMode = $state<'all' | 'owned' | 'unowned'>('all');

  let showNames = $state(true);
  let showDates = $state(false);
  let showSliders = $state(true);

  let ownedSet = $state<Set<string>>(new Set());
  let authSteamId = $state<string | null>(null);
  let importSteamId = $state('');
  let ownedStatus = $state('');
  let fetchingOwned = $state(false);
  let visibleLimit = $state(PAGE_STEP);

  let lightboxItem = $state<GalleryItem | null>(null);
  let lightboxImgUrl = $state('');
  let lightboxLoading = $state(false);
  let lightboxError = $state('');
  let lightboxDialogEl = $state<HTMLDialogElement | null>(null);

  let sentinelEl = $state<HTMLDivElement | null>(null);
  let steamInputEl = $state<HTMLInputElement | null>(null);
  let cdnBase = $state('https://cdn.steam.tools');
  let econBase = $state('https://community.fastly.steamstatic.com/economy');
  let observer: IntersectionObserver | null = null;
  let hashTimer: number | null = null;
  const bgShardCache = new Map<string, Record<string, string>>();

  function applyOwnedList(list: unknown[]) {
    const next = new Set<string>();
    for (const raw of list) {
      if (typeof raw === 'string') {
        const k = normalizeBgOwnedKey(raw);
        if (k) next.add(k);
      } else if (raw && typeof raw === 'object') {
        const u = (raw as Record<string, unknown>).url;
        if (typeof u === 'string') {
          const k = normalizeBgOwnedKey(u);
          if (k) next.add(k);
        }
      }
    }
    ownedSet = next;
    try {
      window.localStorage.setItem('st_owned_bgs_v2', JSON.stringify(Array.from(next)));
    } catch {
      // Ignore quota
    }
  }

  async function loadCatalog() {
    isLoading = true;
    loadError = '';
    try {
      const cfg = getCfg();
      cdnBase = cfg.CDN_BASE || 'https://cdn.steam.tools';
      econBase = cfg.STEAM_ECON_BASE || 'https://community.fastly.steamstatic.com/economy';
      let catalogData: unknown = null;
      let pricesData: unknown = null;
      try {
        [catalogData, pricesData] = await Promise.all([
          loadDataset('data/bg_catalog_v3.json'),
          loadDataset('data/bg_prices_v3.json'),
        ]);
      } catch {
        // Fall through to v2
      }

      if (catalogData && pricesData) {
        const unpacked = getCfg().unpackGalleryV3(catalogData, pricesData);
        if (unpacked && Array.isArray(unpacked.items)) {
          allItems = normalizeGalleryItems(unpacked.items, unpacked.dates, 'backgrounds');
          isLoading = false;
          return;
        }
      }

      try {
        const [v2Doc, datesDoc] = await Promise.all([
          loadDataset('data/bg_v2.json'),
          loadDataset('data/dates.json').catch(() => ({})),
        ]);
        const items = getCfg().unpackGalleryV2(v2Doc);
        allItems = normalizeGalleryItems(items, datesDoc, 'backgrounds');
        isLoading = false;
        return;
      } catch {
        // Fall through to v1
      }

      const [v1Doc, datesDoc] = await Promise.all([
        loadDataset('data/bg.json'),
        loadDataset('data/dates.json').catch(() => ({})),
      ]);
      const rawArr = Array.isArray(v1Doc) ? v1Doc : [];
      allItems = normalizeGalleryItems(rawArr, datesDoc, 'backgrounds');
    } catch (err: any) {
      loadError = err?.message || 'Failed to load backgrounds catalog.';
    } finally {
      isLoading = false;
    }
  }

  function resetPagination() {
    visibleLimit = PAGE_STEP;
  }

  function handleSelectOrder(key: GalleryOrderKey) {
    if (key === 'random') {
      rerollRandomRanks(allItems);
      order = 'random';
      reversed = false;
      resetPagination();
      return;
    }
    if (order === key) {
      reversed = !reversed;
    } else {
      order = key;
      reversed = key === 'date';
    }
    resetPagination();
  }

  function resetSliders() {
    hueMin = 0;
    hueMax = 255;
    brightMin = 0;
    brightMax = 255;
    satMin = 0;
    satMax = 255;
    priceCentsMin = 0;
    priceCentsMax = 5000;
    resetPagination();
  }

  function clearAllFilters() {
    query = '';
    ownedMode = 'all';
    resetSliders();
    syncHashNow('');
  }

  function syncHashNow(q: string) {
    if (typeof window === 'undefined') return;
    const nextHash = buildHashFilter(q);
    if (window.location.hash !== nextHash) {
      try {
        window.history.replaceState(null, '', nextHash);
      } catch {
        // Ignore
      }
    }
  }

  function openSteamImport(initialJson?: unknown) {
    const imp = getImporter();
    if (!imp) return;
    imp.openImportDialog({
      mode: 'backgrounds',
      appid: '753',
      contextid: '6',
      steamId: importSteamId.trim() || authSteamId || '',
      initialJson: typeof initialJson === 'string' ? initialJson : undefined,
      title: 'Import Steam Profile Backgrounds',
      subtitle: 'Filter owned backgrounds locally in your browser — nothing is sent to our servers.',
      onImport: (res: any) => {
        const urlList = Array.isArray(res?.background_urls) && res.background_urls.length > 0
          ? res.background_urls
          : null;
        const list = urlList
          || (Array.isArray(res?.backgrounds)
            ? res.backgrounds
            : (Array.isArray(res?.urls) ? res.urls : (Array.isArray(res?.items) ? res.items : [])));
        applyOwnedList(list);
        if (res?.steamid64) {
          authSteamId = String(res.steamid64);
          if (!importSteamId.trim()) importSteamId = String(res.steamid64);
        }
        if (ownedSet.size > 0) {
          ownedMode = 'owned';
          ownedStatus = `Imported ${ownedSet.size.toLocaleString()} owned backgrounds.`;
        } else {
          ownedStatus = 'No backgrounds found in the pasted inventory.';
        }
      },
    });
  }

  async function fetchOwnedForUser() {
    const id = importSteamId.trim() || authSteamId || '';
    if (!id) {
      openSteamImport();
      return;
    }
    fetchingOwned = true;
    ownedStatus = 'Fetching owned backgrounds...';
    try {
      const resp = await apiRequestWithFailover(`/FetchBackgrounds?id=${encodeURIComponent(id)}`, {
        method: 'GET',
        withCredentials: true,
      });
      const body = resp?.data || {};
      const list = Array.isArray(body.urls)
        ? body.urls
        : (Array.isArray(body.items) ? body.items : []);
      applyOwnedList(list);
      if (ownedSet.size > 0) {
        ownedMode = 'owned';
        ownedStatus = `Loaded ${ownedSet.size.toLocaleString()} owned backgrounds.`;
      } else {
        ownedStatus = 'No owned backgrounds returned — try Import from Steam.';
      }
    } catch {
      ownedStatus = 'Could not fetch automatically — try Import from Steam.';
    } finally {
      fetchingOwned = false;
    }
  }

  function clearOwned() {
    ownedSet = new Set();
    ownedMode = 'all';
    ownedStatus = '';
    try {
      window.localStorage.removeItem('st_owned_bgs_v2');
    } catch {
      // Ignore
    }
  }

  async function openLightbox(item: GalleryItem) {
    lightboxItem = item;
    lightboxImgUrl = '';
    lightboxError = '';
    lightboxLoading = true;
    if (lightboxDialogEl && !lightboxDialogEl.open) {
      lightboxDialogEl.returnValue = '';
      lightboxDialogEl.showModal();
    }

    const econBase = getCfg().STEAM_ECON_BASE;
    if (item.img) {
      lightboxImgUrl = resolveBgLightboxImageUrl(item.img, econBase, normalizeAssetUrl);
      lightboxLoading = false;
      return;
    }

    const shard = computeShardHex64(item.url);
    try {
      let shardMap = bgShardCache.get(shard);
      if (!shardMap) {
        shardMap = await fetchCdnJson<Record<string, string>>(`data/bg_images/${shard}.json`);
        bgShardCache.set(shard, shardMap || {});
      }
      const rawHash = shardMap?.[item.url];
      if (rawHash) {
        lightboxImgUrl = resolveBgLightboxImageUrl(rawHash, econBase, normalizeAssetUrl);
        lightboxLoading = false;
        return;
      }
    } catch {
      // Fall back to API endpoint
    }

    try {
      const resp = await apiRequestWithFailover(
        `/FetchBackgroundImage?url=${encodeURIComponent(item.url)}`,
        { method: 'GET' },
      );
      const val = typeof resp?.data === 'string'
        ? resp.data
        : (resp?.data?.img || resp?.data?.url || resp?.data?.image || '');
      if (val) {
        lightboxImgUrl = resolveBgLightboxImageUrl(String(val), econBase, normalizeAssetUrl);
      } else {
        lightboxError = 'Full-resolution preview unavailable for this background.';
      }
    } catch {
      lightboxError = 'Could not load full-resolution background image.';
    } finally {
      lightboxLoading = false;
    }
  }

  async function handleLogout() {
    try {
      await getCfg().performLogout(httpShim);
    } catch {
      // Ignore
    }
    authSteamId = null;
  }

  let filteredItems = $derived.by(() =>
    filterAndSortGallery(allItems, {
      query,
      hueMin,
      hueMax,
      brightMin,
      brightMax,
      satMin,
      satMax,
      priceCentsMin,
      priceCentsMax,
      ownedMode,
      ownedSet,
      order,
      reversed,
    }),
  );

  let visibleItems = $derived(filteredItems.slice(0, visibleLimit));

  let hasCustomSliders = $derived(
    hueMin > 0 ||
    hueMax < 255 ||
    brightMin > 0 ||
    brightMax < 255 ||
    satMin > 0 ||
    satMax < 255 ||
    priceCentsMin > 0 ||
    priceCentsMax < 5000,
  );

  $effect(() => {
    const q = query;
    if (typeof window === 'undefined') return;
    if (hashTimer !== null) window.clearTimeout(hashTimer);
    hashTimer = window.setTimeout(() => syncHashNow(q), 180);
  });

  $effect(() => {
    const el = sentinelEl;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && visibleLimit < filteredItems.length) {
          visibleLimit += PAGE_STEP;
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer?.disconnect();
  });

  onMount(() => {
    const fromHash = parseHashFilter(window.location.hash);
    if (fromHash) query = fromHash;

    try {
      const saved = window.localStorage.getItem('st_owned_bgs_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          ownedSet = new Set(parsed.map((x) => normalizeBgOwnedKey(String(x))).filter(Boolean));
        }
      }
      const savedUser = window.localStorage.getItem('lastUser');
      if (savedUser) importSteamId = savedUser;
    } catch {
      // Ignore
    }

    if (steamInputEl) {
      getCfg().attachSteamIdPasteGuard(steamInputEl, {
        onJsonPaste: (text) => openSteamImport(text),
      });
    }

    void getCfg()
      .checkAuthSession(httpShim)
      .then((res) => {
        if (res?.authenticated && res.steamid) {
          authSteamId = res.steamid;
          if (!importSteamId) importSteamId = res.steamid;
        }
      })
      .catch(() => {});

    const onHash = () => {
      const next = parseHashFilter(window.location.hash);
      if (next !== query) {
        query = next;
        resetPagination();
      }
    };
    window.addEventListener('hashchange', onHash);
    void loadCatalog();

    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  });

  onDestroy(() => {
    observer?.disconnect();
    if (hashTimer !== null) window.clearTimeout(hashTimer);
  });
</script>

<div class="st-tool-header" style:--tool-accent="var(--st-color-bgs)">
  <h1>Backgrounds Gallery</h1>
  {#if isLoading}
    <span class="st-pill is-loading">Loading catalog...</span>
  {:else}
    <span class="st-pill">
      {filteredItems.length.toLocaleString()} / {allItems.length.toLocaleString()} backgrounds
    </span>
  {/if}
  {#if ownedSet.size > 0}
    <span class="st-pill" style="border-color: var(--st-color-cards); color: var(--st-color-cards);">
      {ownedSet.size.toLocaleString()} owned
    </span>
  {/if}
</div>

{#if loadError}
  <div class="st-alert is-danger" role="alert">
    <span>{loadError}</span>
    <button type="button" class="st-btn st-btn-sm" onclick={() => void loadCatalog()}>Retry</button>
  </div>
{/if}

<section class="st-panel" aria-label="Background Filters and Sorting">
  <div class="st-deck-row">
    <div class="st-deck-group">
      <label class="st-visually-hidden" for="st-bg-filter">Filter backgrounds</label>
      <input
        id="st-bg-filter"
        name="filter"
        type="search"
        class="st-input"
        style="flex: 1 1 200px; max-width: 340px; min-width: 160px;"
        placeholder="Filter name or game..."
        bind:value={query}
        oninput={resetPagination}
      />

      <div class="st-seg-group" role="group" aria-label="Sort order">
        {#each BG_ORDER_OPTIONS as opt}
          <button
            type="button"
            class="st-btn st-btn-sm"
            class:is-pressed={order === opt.key}
            aria-pressed={order === opt.key}
            onclick={() => handleSelectOrder(opt.key)}
          >
            {opt.label}{#if order === opt.key && opt.key !== 'random'} {reversed ? '▼' : '▲'}{/if}
          </button>
        {/each}
      </div>
    </div>

    <div class="st-deck-group">
      <div class="st-seg-group" role="group" aria-label="Display options">
        <button
          type="button"
          class="st-btn st-btn-sm"
          class:is-pressed={showNames}
          aria-pressed={showNames}
          onclick={() => { showNames = !showNames; }}
        >
          Names
        </button>
        <button
          type="button"
          class="st-btn st-btn-sm"
          class:is-pressed={showDates}
          aria-pressed={showDates}
          onclick={() => { showDates = !showDates; }}
        >
          Dates
        </button>
        <button
          type="button"
          class="st-btn st-btn-sm"
          class:is-pressed={showSliders}
          aria-pressed={showSliders}
          onclick={() => { showSliders = !showSliders; }}
        >
          Color &amp; Price
        </button>
      </div>

      {#if query || hasCustomSliders || ownedMode !== 'all'}
        <button type="button" class="st-btn st-btn-sm" onclick={clearAllFilters}>
          Reset
        </button>
      {/if}
    </div>
  </div>

  {#if showSliders}
    <div class="st-sliders-grid" style="margin-top: 8px;">
      <DualRangeSlider
        id="st-bg-hue"
        label="Hue"
        minLimit={0}
        maxLimit={255}
        variant="hue"
        bind:low={hueMin}
        bind:high={hueMax}
      />
      <DualRangeSlider
        id="st-bg-bright"
        label="Brightness"
        minLimit={0}
        maxLimit={255}
        variant="brightness"
        bind:low={brightMin}
        bind:high={brightMax}
      />
      <DualRangeSlider
        id="st-bg-sat"
        label="Saturation"
        minLimit={0}
        maxLimit={255}
        variant="saturation"
        bind:low={satMin}
        bind:high={satMax}
      />
      <DualRangeSlider
        id="st-bg-price"
        label="Price (USD)"
        minLimit={0}
        maxLimit={5000}
        step={5}
        bind:low={priceCentsMin}
        bind:high={priceCentsMax}
        formatValue={(v, upper) => (upper && v >= 5000 ? '$50+' : `$${(v / 100).toFixed(2)}`)}
      />
    </div>
  {/if}

  <div class="st-deck-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--st-border);">
    <div class="st-deck-group">
      <label class="st-visually-hidden" for="st-bg-steamid">Steam ID</label>
      <input
        id="st-bg-steamid"
        name="steamid"
        type="text"
        class="st-input"
        style="width: 195px;"
        placeholder="SteamID64 or Profile URL"
        bind:this={steamInputEl}
        bind:value={importSteamId}
      />
      <button
        type="button"
        class="st-btn st-btn-sm st-btn-primary"
        disabled={fetchingOwned}
        onclick={fetchOwnedForUser}
      >
        {fetchingOwned ? 'Loading...' : 'Fetch Owned'}
      </button>
      <button type="button" class="st-btn st-btn-sm" onclick={openSteamImport}>
        Import from Steam
      </button>
      {#if authSteamId}
        <button type="button" class="st-btn st-btn-sm" onclick={handleLogout}>
          Sign out ({authSteamId.slice(-4)})
        </button>
      {:else}
        <a
          class="st-btn st-btn-sm"
          href={getCfg().getLoginUrl(typeof window !== 'undefined' ? window.location.href : '/v2/backgrounds/')}
        >
          Sign in with Steam
        </a>
      {/if}
    </div>

    {#if ownedSet.size > 0 || ownedStatus}
      <div class="st-deck-group">
        {#if ownedSet.size > 0}
          <div class="st-seg-group" role="group" aria-label="Ownership filter">
            <button
              type="button"
              class="st-btn st-btn-sm"
              class:is-pressed={ownedMode === 'all'}
              onclick={() => { ownedMode = 'all'; resetPagination(); }}
            >
              All
            </button>
            <button
              type="button"
              class="st-btn st-btn-sm"
              class:is-pressed={ownedMode === 'owned'}
              onclick={() => { ownedMode = 'owned'; resetPagination(); }}
            >
              Owned
            </button>
            <button
              type="button"
              class="st-btn st-btn-sm"
              class:is-pressed={ownedMode === 'unowned'}
              onclick={() => { ownedMode = 'unowned'; resetPagination(); }}
            >
              Unowned
            </button>
          </div>
          <button type="button" class="st-btn st-btn-sm" onclick={clearOwned}>
            Clear Owned
          </button>
        {/if}
        {#if ownedStatus}
          <span style="font-size: 12px; color: var(--st-text-muted);">{ownedStatus}</span>
        {/if}
      </div>
    {/if}
  </div>
</section>

<div class="st-gallery-stage">
  {#if isLoading && allItems.length === 0}
    <div class="st-empty-well">Loading Steam background spritesheets...</div>
  {:else if visibleItems.length === 0}
    <div class="st-empty-well">
      <span>No backgrounds match the current filters.</span>
      <button type="button" class="st-btn st-btn-sm" onclick={clearAllFilters}>Reset filters</button>
    </div>
  {:else}
    <div class="st-bg-grid">
      {#each visibleItems as item (item.idx)}
        {@const isOwned = ownedSet.has(item.ownedKey) || ownedSet.has(item.nameLower)}
        {@const priceLabel = item.priceUsd > 0 ? currencyStore.formatUsd(item.priceUsd) : 'N/A'}
        <button
          type="button"
          class="st-bg-card"
          class:is-owned={isOwned}
          title={`${item.name} — ${item.game} (${priceLabel})`}
          onclick={() => void openLightbox(item)}
        >
          {#if item.hasPos}
            <span
              class="st-bg-sprite"
              style:background-image={`url("${cdnBase}/backgrounds/${item.sheet}.webp?v4")`}
              style:background-position={`-${item.col * 256}px -${item.row * 160}px`}
            ></span>
          {:else if item.img}
            <img
              class="st-bg-sprite"
              src={getBgFallbackImgUrl(item, econBase)}
              width="256"
              height="160"
              loading="lazy"
              alt={item.name}
              style="object-fit: cover; display: block;"
            />
          {:else}
            <span class="st-bg-sprite"></span>
          {/if}
          <div class="st-bg-meta">
            {#if showNames}
              <span class="st-emote-name" title={item.name}>{item.name}</span>
            {:else}
              <span class="st-gallery-sub">{item.game}</span>
            {/if}
            <span style="color: #8fd3ff; font-variant-numeric: tabular-nums; flex: none;">
              {priceLabel}
            </span>
          </div>
          {#if showNames || showDates}
            <div class="st-bg-meta" style="padding-top: 0;">
              {#if showNames}
                <span class="st-gallery-sub" title={item.game}>{item.game}</span>
              {:else}
                <span></span>
              {/if}
              {#if showDates}
                <span class="st-gallery-sub" style="flex: none; white-space: nowrap;">{formatReleaseDate(item.date)}</span>
              {/if}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if visibleItems.length < filteredItems.length}
    <div class="st-sentinel" bind:this={sentinelEl}>
      <span>
        Showing {visibleItems.length.toLocaleString()} of {filteredItems.length.toLocaleString()}
      </span>
      <button
        type="button"
        class="st-btn st-btn-sm"
        onclick={() => { visibleLimit += PAGE_STEP; }}
      >
        Load more
      </button>
    </div>
  {/if}
</div>

<dialog
  class="st-dialog is-lightbox"
  closedby="any"
  bind:this={lightboxDialogEl}
  use:enhanceModalDialog
  onclose={() => {
    lightboxItem = null;
    lightboxImgUrl = '';
    lightboxError = '';
  }}
>
  <div class="st-dialog-head">
    <h2 class="st-dialog-title">{lightboxItem ? lightboxItem.name : 'Background Preview'}</h2>
    <button
      type="button"
      class="st-btn st-btn-sm"
      onclick={() => {
        if (lightboxDialogEl?.open) lightboxDialogEl.close();
        lightboxItem = null;
      }}
      aria-label="Close"
    >
      &times;
    </button>
  </div>
  {#if lightboxItem}
    <div class="st-dialog-body">
      <div class="st-lightbox-stage">
        {#if lightboxLoading}
          <span style="color: #aebcca; font-size: 13px;">Loading full background...</span>
        {:else if lightboxImgUrl}
          <img src={lightboxImgUrl} alt={lightboxItem.name} />
        {:else}
          <span style="color: #e49797; font-size: 13px; padding: 16px;">
            {lightboxError || 'Image unavailable'}
          </span>
        {/if}
      </div>
      <div class="st-deck-row" style="margin-top: 10px;">
        <div class="st-deck-group" style="font-size: 12.5px; gap: 6px 12px;">
          <strong>{lightboxItem.game}</strong>
          <span style="font-variant-numeric: tabular-nums;">
            {lightboxItem.priceUsd > 0 ? currencyStore.formatUsd(lightboxItem.priceUsd) : 'N/A'}
          </span>
          {#if lightboxItem.date}
            <span style="color: var(--st-text-muted);">{formatReleaseDate(lightboxItem.date)}</span>
          {/if}
        </div>
        <div class="st-deck-group">
          {#if lightboxImgUrl}
            <a
              class="st-btn st-btn-sm"
              href={lightboxImgUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Full Image
            </a>
          {/if}
          <a
            class="st-btn st-btn-sm st-btn-primary"
            href={buildSteamMarketUrl(lightboxItem.url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Steam Market
          </a>
        </div>
      </div>
    </div>
  {/if}
</dialog>
