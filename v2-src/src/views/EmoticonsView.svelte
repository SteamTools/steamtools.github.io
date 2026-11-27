<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import DualRangeSlider from '../components/DualRangeSlider.svelte';
  import {
    apiRequestWithFailover,
    getCfg,
    getImporter,
    httpShim,
    loadDataset,
  } from '../lib/bridge.ts';
  import { currencyStore } from '../lib/currency.svelte.ts';
  import {
    buildHashFilter,
    buildSteamMarketUrl,
    EMOTE_ORDER_OPTIONS,
    filterAndSortGallery,
    formatReleaseDate,
    getEmoteFallbackImgUrl,
    normalizeEmoteOwnedKey,
    normalizeGalleryItems,
    parseHashFilter,
    rerollRandomRanks,
    type GalleryItem,
    type GalleryOrderKey,
  } from '../lib/gallery-logic.ts';

  const PAGE_STEP_LG = 160;
  const PAGE_STEP_SM = 320;

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

  let showNames = $state(false);
  let isSmall = $state(false);
  let showDates = $state(false);
  let showSliders = $state(true);

  let ownedSet = $state<Set<string>>(new Set());
  let authSteamId = $state<string | null>(null);
  let importSteamId = $state('');
  let ownedStatus = $state('');
  let fetchingOwned = $state(false);
  let visibleLimit = $state(PAGE_STEP_LG);

  let sentinelEl = $state<HTMLDivElement | null>(null);
  let steamInputEl = $state<HTMLInputElement | null>(null);
  let cdnBase = $state('https://cdn.steam.tools');
  let econBase = $state('https://community.fastly.steamstatic.com/economy');
  let observer: IntersectionObserver | null = null;
  let hashTimer: number | null = null;

  function applyOwnedList(list: unknown[]) {
    const next = new Set<string>();
    for (const raw of list) {
      if (typeof raw === 'string') {
        const k = normalizeEmoteOwnedKey(raw);
        if (k) next.add(k);
      } else if (raw && typeof raw === 'object') {
        const name = (raw as Record<string, unknown>).name;
        if (typeof name === 'string') {
          const k = normalizeEmoteOwnedKey(name);
          if (k) next.add(k);
        }
      }
    }
    ownedSet = next;
    try {
      window.localStorage.setItem('st_owned_emotes_v2', JSON.stringify(Array.from(next)));
    } catch {
      // Ignore quota errors
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
          loadDataset('data/emote_catalog_v3.json'),
          loadDataset('data/emote_prices_v3.json'),
        ]);
      } catch {
        // Fall through to v2
      }

      if (catalogData && pricesData) {
        const unpacked = getCfg().unpackGalleryV3(catalogData, pricesData);
        if (unpacked && Array.isArray(unpacked.items)) {
          allItems = normalizeGalleryItems(unpacked.items, unpacked.dates, 'emoticons');
          isLoading = false;
          return;
        }
      }

      try {
        const [v2Doc, datesDoc] = await Promise.all([
          loadDataset('data/emote_v2.json'),
          loadDataset('data/dates.json').catch(() => ({})),
        ]);
        const items = getCfg().unpackGalleryV2(v2Doc);
        allItems = normalizeGalleryItems(items, datesDoc, 'emoticons');
        isLoading = false;
        return;
      } catch {
        // Fall through to v1
      }

      const [v1Doc, datesDoc] = await Promise.all([
        loadDataset('data/emote.json'),
        loadDataset('data/dates.json').catch(() => ({})),
      ]);
      const rawArr = Array.isArray(v1Doc) ? v1Doc : [];
      allItems = normalizeGalleryItems(rawArr, datesDoc, 'emoticons');
    } catch (err: any) {
      loadError = err?.message || 'Failed to load emoticon catalog.';
    } finally {
      isLoading = false;
    }
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

  function resetPagination() {
    visibleLimit = isSmall ? PAGE_STEP_SM : PAGE_STEP_LG;
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
        // Ignore history restrictions
      }
    }
  }

  function openSteamImport(initialJson?: unknown) {
    const imp = getImporter();
    if (!imp) return;
    imp.openImportDialog({
      mode: 'emotes',
      appid: '753',
      contextid: '6',
      steamId: importSteamId.trim() || authSteamId || '',
      initialJson: typeof initialJson === 'string' ? initialJson : undefined,
      title: 'Import Steam Emoticons',
      subtitle: 'Filter owned emoticons locally in your browser in two quick steps.',
      onImport: (res: any) => {
        const list = Array.isArray(res?.emoticons)
          ? res.emoticons
          : (Array.isArray(res?.emotes)
            ? res.emotes
            : (Array.isArray(res?.owned) ? res.owned : (Array.isArray(res?.items) ? res.items : [])));
        applyOwnedList(list);
        if (res?.steamid64) {
          authSteamId = String(res.steamid64);
          if (!importSteamId.trim()) importSteamId = String(res.steamid64);
        }
        if (ownedSet.size > 0) {
          ownedMode = 'owned';
          ownedStatus = `Imported ${ownedSet.size.toLocaleString()} owned emoticons.`;
        } else {
          ownedStatus = 'No emoticons found in the pasted inventory.';
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
    ownedStatus = 'Fetching owned emoticons...';
    try {
      const resp = await apiRequestWithFailover(`/FetchEmotes?id=${encodeURIComponent(id)}`, {
        method: 'GET',
        withCredentials: true,
      });
      const body = resp?.data || {};
      const list = Array.isArray(body.owned)
        ? body.owned
        : (Array.isArray(body.emotes) ? body.emotes : (Array.isArray(body.items) ? body.items : []));
      applyOwnedList(list);
      if (ownedSet.size > 0) {
        ownedMode = 'owned';
        ownedStatus = `Loaded ${ownedSet.size.toLocaleString()} owned emoticons.`;
      } else {
        ownedStatus = 'No owned emoticons returned — try Import from Steam.';
      }
    } catch {
      ownedStatus = 'Could not fetch automatically — opening or try Import from Steam.';
    } finally {
      fetchingOwned = false;
    }
  }

  function clearOwned() {
    ownedSet = new Set();
    ownedMode = 'all';
    ownedStatus = '';
    try {
      window.localStorage.removeItem('st_owned_emotes_v2');
    } catch {
      // Ignore
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
          visibleLimit += isSmall ? PAGE_STEP_SM : PAGE_STEP_LG;
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
      const saved = window.localStorage.getItem('st_owned_emotes_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          ownedSet = new Set(parsed.map((x) => normalizeEmoteOwnedKey(String(x))).filter(Boolean));
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

{#if loadError}
  <div class="st-alert is-danger" role="alert">
    <span>{loadError}</span>
    <button type="button" class="st-btn st-btn-sm" onclick={() => void loadCatalog()}>Retry</button>
  </div>
{/if}

<section class="st-panel" aria-label="Emoticon Filters and Sorting">
  <div class="st-deck-row">
    <div class="st-deck-group">
      <label class="st-visually-hidden" for="st-em-filter">Filter emoticons</label>
      <input
        id="st-em-filter"
        name="filter"
        type="search"
        class="st-input"
        style="width: min(220px, 54vw);"
        placeholder="Filter name, :emote:, or game..."
        bind:value={query}
        oninput={resetPagination}
      />

      <div class="st-seg-group" role="group" aria-label="Sort order">
        {#each EMOTE_ORDER_OPTIONS as opt}
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
          class:is-pressed={showNames && !isSmall}
          aria-pressed={showNames && !isSmall}
          disabled={isSmall}
          title={isSmall ? 'Names are hidden in Small mode' : undefined}
          onclick={() => { showNames = !showNames; }}
        >
          Names
        </button>
        <button
          type="button"
          class="st-btn st-btn-sm"
          class:is-pressed={isSmall}
          aria-pressed={isSmall}
          onclick={() => {
            isSmall = !isSmall;
            if (isSmall && visibleLimit < PAGE_STEP_SM) visibleLimit = PAGE_STEP_SM;
          }}
        >
          Small
        </button>
        <button
          type="button"
          class="st-btn st-btn-sm"
          class:is-pressed={showDates && !isSmall}
          aria-pressed={showDates && !isSmall}
          disabled={isSmall}
          title={isSmall ? 'Dates are hidden in Small mode' : undefined}
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
        id="st-em-hue"
        label="Hue"
        minLimit={0}
        maxLimit={255}
        variant="hue"
        bind:low={hueMin}
        bind:high={hueMax}
      />
      <DualRangeSlider
        id="st-em-bright"
        label="Brightness"
        minLimit={0}
        maxLimit={255}
        variant="brightness"
        bind:low={brightMin}
        bind:high={brightMax}
      />
      <DualRangeSlider
        id="st-em-sat"
        label="Saturation"
        minLimit={0}
        maxLimit={255}
        variant="saturation"
        bind:low={satMin}
        bind:high={satMax}
      />
      <DualRangeSlider
        id="st-em-price"
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

  <div class="st-deck-row">
    <div class="st-deck-group">
      <label class="st-visually-hidden" for="st-em-steamid">Steam ID</label>
      <div class="st-join">
        <input
          id="st-em-steamid"
          name="steamid"
          type="text"
          class="st-input"
          style="width: 190px;"
          placeholder="SteamID64 or Profile URL"
          bind:this={steamInputEl}
          bind:value={importSteamId}
        />
        <button
          type="button"
          class="st-btn st-btn-primary"
          disabled={fetchingOwned}
          onclick={fetchOwnedForUser}
        >
          {fetchingOwned ? 'Loading...' : 'Fetch Owned'}
        </button>
      </div>
      <button type="button" class="st-btn st-btn-sm" onclick={openSteamImport}>
        Manual import
      </button>
      {#if authSteamId}
        <button type="button" class="st-btn st-btn-sm" onclick={handleLogout}>
          Sign out ({authSteamId.slice(-4)})
        </button>
      {:else}
        <a
          class="st-btn st-btn-sm"
          href={getCfg().getLoginUrl(typeof window !== 'undefined' ? window.location.href : '/v2/emoticons/')}
        >
          Sign in with Steam
        </a>
      {/if}

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
          Clear
        </button>
      {/if}
    </div>

    <div class="st-deck-group">
      {#if ownedStatus}
        <span style="font-size: 12px; color: var(--st-text-muted);">{ownedStatus}</span>
      {/if}
      {#if ownedSet.size > 0}
        <span class="st-pill" style="border-color: var(--st-color-cards); color: var(--st-color-cards);">
          {ownedSet.size.toLocaleString()} owned
        </span>
      {/if}
      {#if isLoading}
        <span class="st-pill is-loading">Loading catalog...</span>
      {:else}
        <span class="st-pill">
          {filteredItems.length.toLocaleString()} / {allItems.length.toLocaleString()} emotes
        </span>
      {/if}
    </div>
  </div>
</section>

<div class="st-gallery-stage">
  {#if isLoading && allItems.length === 0}
    <div class="st-empty-well">Loading Steam emoticon spritesheets...</div>
  {:else if visibleItems.length === 0}
    <div class="st-empty-well">
      <span>No emoticons match the current filters.</span>
      <button type="button" class="st-btn st-btn-sm" onclick={clearAllFilters}>Reset filters</button>
    </div>
  {:else if isSmall}
    <div class="st-emote-grid is-small">
      {#each visibleItems as item (item.idx)}
        {@const isOwned = ownedSet.has(item.ownedKey)}
        {@const tip = `${item.name} — ${item.game}${item.priceUsd > 0 ? ` (${currencyStore.formatUsd(item.priceUsd)})` : ''}`}
        <a
          href={buildSteamMarketUrl(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          class="st-emote-small-item"
          class:is-owned={isOwned}
          title={tip}
        >
          {#if item.hasPos}
            <span
              class="st-emote-sprite-sm"
              style:background-image={`url("${cdnBase}/emoticons/${item.sheet}s.webp?v4")`}
              style:background-position={`-${item.col * 20}px -${item.row * 20}px`}
            ></span>
          {:else}
            <img
              src={getEmoteFallbackImgUrl(item, econBase, true)}
              width="20"
              height="20"
              loading="lazy"
              alt={item.name}
              style="width: 20px; height: 20px; object-fit: contain; display: block;"
            />
          {/if}
        </a>
      {/each}
    </div>
  {:else}
    <div class="st-emote-grid" class:is-no-name={!showNames}>
      {#each visibleItems as item (item.idx)}
        {@const isOwned = ownedSet.has(item.ownedKey)}
        {@const priceLabel = item.priceUsd > 0 ? currencyStore.formatUsd(item.priceUsd) : 'N/A'}
        <a
          href={buildSteamMarketUrl(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          class="st-emote-card"
          class:is-owned={isOwned}
          title={`${item.name} — ${item.game} (${priceLabel})`}
        >
          {#if item.hasPos}
            <span
              class="st-emote-sprite-lg"
              style:background-image={`url("${cdnBase}/emoticons/${item.sheet}.webp?v4")`}
              style:background-position={`-${item.col * 64}px -${item.row * 64}px`}
            ></span>
          {:else}
            <img
              src={getEmoteFallbackImgUrl(item, econBase, false)}
              width="64"
              height="64"
              loading="lazy"
              alt={item.name}
              style="width: 64px; height: 64px; object-fit: contain; display: block;"
            />
          {/if}
          {#if showNames}
            <span class="st-emote-name">{item.name}</span>
            <span class="st-gallery-sub">{item.game}</span>
          {/if}
          <span class="st-gallery-sub" style="color: #8fd3ff; font-variant-numeric: tabular-nums;">
            {priceLabel}
          </span>
          {#if showDates}
            <span class="st-gallery-sub">{formatReleaseDate(item.date)}</span>
          {/if}
        </a>
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
        onclick={() => { visibleLimit += isSmall ? PAGE_STEP_SM : PAGE_STEP_LG; }}
      >
        Load more
      </button>
    </div>
  {/if}
</div>
