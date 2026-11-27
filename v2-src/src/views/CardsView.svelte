<script lang="ts">
  import { onMount } from 'svelte';
  import GameListDialog from '../components/GameListDialog.svelte';
  import LevelCalcDialog from '../components/LevelCalcDialog.svelte';
  import {
    apiRequestWithFailover,
    getCfg,
    getImporter,
    httpShim,
    loadDataset,
    trackEvent,
  } from '../lib/bridge.ts';
  import {
    applyUserToCardRows,
    buildCardSetRows,
    buildCardsExportText,
    CARD_COLUMNS,
    clearUserFromCardRows,
    DEFAULT_VISIBLE_COLS,
    filterAndSortCardRows,
    generateSetLinks,
    type CardColumnDef,
    type CardColumnKey,
    type CardFilters,
    type CardSetRow,
    type RawCardSetEntry,
    type RawSetDataDoc,
    type SetTypeFilter,
    type UserCardSummary,
    type UserDataAvailability,
  } from '../lib/cards-logic.ts';
  import { currencyStore } from '../lib/currency.svelte.ts';
  import { formatDurationAge, formatRelativeTime, formatShortDate } from '../lib/normalize.ts';

  const ROW_HEIGHT = 29;
  const OVERSCAN = 12;

  let allRows = $state.raw<CardSetRow[]>([]);
  let nameToAppid = $state.raw<Record<string, string>>(Object.create(null));
  let appidToSet = $state.raw<Record<string, RawCardSetEntry>>(Object.create(null));
  let dataLoaded = $state(false);
  let dataError = $state('');
  let dataVersion = $state(0);

  let meta = $state({
    time: 0,
    data_median_age: 0,
    game_count: 0,
    card_count: 0,
    emote_count: 0,
    bg_count: 0,
  });

  // Search, Filters & Sort
  let searchQuery = $state('');
  let setType = $state<SetTypeFilter>({ standard: true, foil: false });
  let filters = $state<CardFilters>({
    own_game: false,
    not_own_game: false,
    own_cards: false,
    hide_completed: false,
    hide_incompleted: false,
    hide_f2p: false,
    hide_nonf2p: false,
  });
  let sortKey = $state<CardColumnKey>('added');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let sortAnnouncement = $state('');

  // Columns visibility
  let visibleCols = $state<Record<CardColumnKey, boolean>>({ ...DEFAULT_VISIBLE_COLS });

  // User profile state
  let userIdInput = $state('');
  let userLoaded = $state(false);
  let userStale = $state(false);
  let userMoreItems = $state(false);
  let userNextPage = $state(2);
  let userStatus = $state('');
  let userData = $state<UserDataAvailability>({ games: 1, cards: 1, badges: 1 });
  let userProfile = $state<{
    steamid64: string;
    level: number;
    xp: number;
    emote_count: number;
    bg_count: number;
  }>({
    steamid64: '',
    level: 0,
    xp: 0,
    emote_count: 0,
    bg_count: 0,
  });
  let userSummary = $state<UserCardSummary>({
    game_count: 0,
    game_worth: 0,
    card_count: 0,
    card_worth: 0,
    badge_count: 0,
    badge_worth: 0,
    badge_unique: 0,
    hasCompleteBadges: false,
  });
  let userGamesMap: Record<string, boolean> = Object.create(null);
  let userBadgesMap: Record<string, [number, number]> = Object.create(null);
  let userCardsMap: Record<string, [number, number, number, number]> = Object.create(null);

  // Virtual Scroll & Refs
  let tableScrollEl: HTMLDivElement | undefined = $state();
  let steamIdInputEl: HTMLInputElement | undefined = $state();
  let gameListDlg: GameListDialog | undefined = $state();
  let levelCalcDlg: LevelCalcDialog | undefined = $state();
  let scrollTop = $state(0);
  let viewportHeight = $state(540);
  let copyFeedback = $state('');
  let copyTimer: number | undefined;

  let filteredRows = $derived.by(() => {
    void dataVersion;
    return filterAndSortCardRows(allRows, {
      setType,
      filters,
      userLoaded,
      userData,
      query: searchQuery,
      sortKey,
      sortDir,
    });
  });

  let activeColumns = $derived(
    CARD_COLUMNS.filter((c) => {
      if (!visibleCols[c.key]) return false;
      if (c.requiresUser && !userLoaded) return false;
      return true;
    }),
  );

  let availableColumns = $derived(
    CARD_COLUMNS.filter((c) => !c.requiresUser || userLoaded),
  );

  let startIdx = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
  let visibleCount = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2);
  let endIdx = $derived(Math.min(filteredRows.length, startIdx + visibleCount));
  let windowRows = $derived(filteredRows.slice(startIdx, endIdx));
  let topSpacerPx = $derived(startIdx * ROW_HEIGHT);
  let bottomSpacerPx = $derived(Math.max(0, (filteredRows.length - endIdx) * ROW_HEIGHT));

  let steamLoginUrl = $derived.by(() => {
    try {
      return getCfg().getLoginUrl(typeof window !== 'undefined' ? window.location.href : undefined);
    } catch {
      return 'https://api.steam.tools/auth/steam/login';
    }
  });

  function statusPillClass(code: number): string {
    if (code === 3) return 'is-ok';
    if (code === 2) return 'is-loading';
    if (code === 0) return 'is-missing';
    return '';
  }

  function saveFilterPrefs() {
    try {
      window.localStorage.setItem('setTypeConfig', JSON.stringify(setType));
      window.localStorage.setItem('filtersConfig', JSON.stringify(filters));
    } catch {
      // Ignore storage error
    }
  }

  function toggleSetType(key: 'standard' | 'foil') {
    setType[key] = !setType[key];
    saveFilterPrefs();
    if (tableScrollEl) tableScrollEl.scrollTop = 0;
  }

  function toggleFilter(key: keyof CardFilters) {
    const next = !filters[key];
    filters[key] = next;
    // Keep mutually-exclusive pairs intuitive
    if (next) {
      if (key === 'hide_f2p') filters.hide_nonf2p = false;
      if (key === 'hide_nonf2p') filters.hide_f2p = false;
      if (key === 'own_game') filters.not_own_game = false;
      if (key === 'not_own_game') filters.own_game = false;
      if (key === 'hide_completed') filters.hide_incompleted = false;
      if (key === 'hide_incompleted') filters.hide_completed = false;
    }
    saveFilterPrefs();
    if (tableScrollEl) tableScrollEl.scrollTop = 0;
  }

  function toggleSort(col: CardColumnDef) {
    if (col.type === 'none') return;
    if (sortKey === col.key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = col.key;
      sortDir = col.defaultSortDir;
    }
    if (tableScrollEl) tableScrollEl.scrollTop = 0;
    sortAnnouncement = `Sorted by ${col.title}, ${sortDir === 'asc' ? 'ascending' : 'descending'}, ${filteredRows.length} sets`;
  }

  function applyColumnPreset(preset: 'default' | 'crafting' | 'boosters' | 'all') {
    if (preset === 'all') {
      for (const c of CARD_COLUMNS) visibleCols[c.key] = true;
      return;
    }
    for (const c of CARD_COLUMNS) visibleCols[c.key] = c.defaultVisible;
    if (userLoaded) {
      visibleCols.cards_owned = true;
      visibleCols.badge_lvl = true;
      visibleCols.price_diff = true;
    }
    if (preset === 'crafting') {
      visibleCols.unique_owned = true;
      visibleCols.price_diff = true;
      visibleCols.booster_eff = false;
    } else if (preset === 'boosters') {
      visibleCols.booster_avg = true;
      visibleCols.booster_eff = true;
      visibleCols.qty_avg = true;
    }
  }

  function recomputeUserBindings() {
    if (!dataLoaded || (!userLoaded && userData.games !== 3 && userData.cards !== 3 && userData.badges !== 3)) {
      return;
    }
    userSummary = applyUserToCardRows(allRows, userGamesMap, userBadgesMap, userCardsMap);
    if (userData.cards === 3) visibleCols.cards_owned = true;
    if (userData.badges === 3) visibleCols.badge_lvl = true;
    if (userData.cards === 3) visibleCols.price_diff = true;
    userLoaded = true;
    dataVersion += 1;
  }

  async function fetchUserProfile(rawId: string) {
    const clean = rawId.trim();
    if (!clean || clean === 'undefined') return;
    userData = { games: 2, cards: 2, badges: 2 };
    userStatus = '';
    userMoreItems = false;

    const path = `/UserInfo?id=${encodeURIComponent(clean)}&slim=1`;
    try {
      const resp = await apiRequestWithFailover(path, { method: 'GET', withCredentials: true });
      const data = resp?.data;
      if (!data || !data.success) {
        const sMsg = data?.reason ? String(data.reason) : 'Unable to load profile.';
        const extra = data?.help === 2 ? ' Try pasting your full Steam profile URL.' : '';
        userStatus = `${sMsg}${extra} Or use Import from Steam.`;
        userData = { games: 1, cards: 1, badges: 1 };
        return;
      }

      document.location.hash = `/${encodeURIComponent(userIdInput.trim() || data.steamid64 || '')}`;
      try {
        window.localStorage.setItem('lastUser', userIdInput.trim() || String(data.steamid64 || ''));
      } catch {
        // Ignore storage error
      }

      userStale = Boolean(data.stale);
      userGamesMap = Object.create(null);
      if (Array.isArray(data.games)) {
        for (let i = 0; i < data.games.length; i += 1) {
          userGamesMap[String(data.games[i])] = true;
        }
      }
      userBadgesMap = data.badges && typeof data.badges === 'object' ? data.badges : Object.create(null);
      userCardsMap = data.cards && typeof data.cards === 'object' ? data.cards : Object.create(null);

      userData = {
        games: data.games !== null ? 3 : 0,
        cards: data.cards !== null ? 3 : 0,
        badges: data.badges !== null ? 3 : 0,
      };
      userProfile = {
        steamid64: String(data.steamid64 || ''),
        level: Math.max(0, Math.floor(Number(data.level) || 0)),
        xp: Math.max(0, Math.floor(Number(data.xp) || 0)),
        emote_count: Number(data.emote_count) || 0,
        bg_count: Number(data.bg_count) || 0,
      };

      if (data.cards === null) {
        userStatus = data.huge
          ? 'Inventory has >20,000 items (games & badges loaded) — use Import from Steam for cards.'
          : 'Inventory unavailable/private — use Import from Steam.';
      }

      userLoaded = true;
      recomputeUserBindings();
    } catch (err: any) {
      const errData = err?.data;
      let msg = errData?.reason ? String(errData.reason) : 'Could not load Steam profile.';
      if (errData?.help === 2) {
        msg += ' Try pasting your full Steam profile URL.';
      }
      userStatus = `${msg} Or use Import from Steam.`;
      userData = { games: 0, cards: 0, badges: 0 };
    }
  }

  function applyImportedGameList(appids: string[]) {
    userGamesMap = Object.create(null);
    for (const id of appids) {
      userGamesMap[String(id)] = true;
    }
    userData = {
      games: 3,
      cards: userLoaded && userData.cards === 3 ? 3 : 0,
      badges: userLoaded && userData.badges === 3 ? 3 : 0,
    };
    userLoaded = true;
    recomputeUserBindings();
  }

  function openInventoryImporter(initialJson?: string) {
    const imp = getImporter();
    if (!imp) return;
    const idHint = userProfile.steamid64 || userIdInput.trim();
    imp.openImportDialog({
      mode: 'cards',
      appid: '753',
      contextid: '6',
      steamId: idHint,
      initialJson: typeof initialJson === 'string' ? initialJson : undefined,
      title: 'Import Steam Trading Cards',
      subtitle: 'Load your card sets, foil cards, emotes, and backgrounds directly from Steam.',
      onImport: (parsed: any) => {
        const cardsMap = parsed?.cards && typeof parsed.cards === 'object' ? parsed.cards : {};
        const importedSid = parsed && /^\d{17}$/.test(String(parsed.steamid64 || ''))
          ? String(parsed.steamid64)
          : '';
        const sid =
          importedSid ||
          (/^\d{17}$/.test(userProfile.steamid64) ? userProfile.steamid64 : '') ||
          (/^\d{17}$/.test(userIdInput.trim()) ? userIdInput.trim() : '');
        if (sid && !userIdInput.trim()) {
          userIdInput = sid;
        }
        userCardsMap = cardsMap;
        userProfile = {
          steamid64: sid,
          level: userProfile.level,
          xp: userProfile.xp,
          emote_count: Number(parsed?.emote_count) || 0,
          bg_count: Number(parsed?.bg_count) || 0,
        };
        userData = {
          games: userData.games === 3 ? 3 : 0,
          cards: 3,
          badges: userData.badges === 3 ? 3 : 0,
        };
        userMoreItems = Boolean(parsed?.more_items);
        userNextPage = (Number(parsed?.page_count) || 1) + 1;
        userStatus = `Local inventory: ${Object.keys(cardsMap).length} card set(s), ${userProfile.emote_count} emote(s), ${userProfile.bg_count} bg(s).`;
        userLoaded = true;
        recomputeUserBindings();
      },
    });
  }

  function handleLogout() {
    void getCfg().performLogout(httpShim);
    userStatus = '';
    userMoreItems = false;
    userLoaded = false;
    userStale = false;
    userIdInput = '';
    userGamesMap = Object.create(null);
    userBadgesMap = Object.create(null);
    userCardsMap = Object.create(null);
    userProfile = { steamid64: '', level: 0, xp: 0, emote_count: 0, bg_count: 0 };
    userData = { games: 1, cards: 1, badges: 1 };
    userSummary = {
      game_count: 0,
      game_worth: 0,
      card_count: 0,
      card_worth: 0,
      badge_count: 0,
      badge_worth: 0,
      badge_unique: 0,
      hasCompleteBadges: false,
    };
    visibleCols.cards_owned = false;
    visibleCols.unique_owned = false;
    visibleCols.badge_lvl = false;
    visibleCols.price_diff = false;
    clearUserFromCardRows(allRows);
    dataVersion += 1;
    try {
      window.localStorage.removeItem('lastUser');
    } catch {
      // Ignore
    }
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function formatCellPrice(val: number): string {
    return Number.isFinite(val) ? currencyStore.formatUsd(val) : 'N/A';
  }

  function exportCsv() {
    const cfg = getCfg();
    trackEvent('export', { app: 'cards', a: 'csv' });
    const text = buildCardsExportText(
      filteredRows,
      visibleCols,
      (usd) => currencyStore.formatUsd(usd, { noCurrency: true }),
      'csv',
      cfg.escapeCsvFormula,
    );
    cfg.openTextExportDialog({
      title: `Export Set Data CSV (${filteredRows.length.toLocaleString()} sets)`,
      label: 'CSV data (formula-safe)',
      text,
      filename: 'STC_set_data.csv',
      mimeType: 'text/csv;charset=utf-8',
    });
  }

  async function copyVisibleTsv() {
    const cfg = getCfg();
    const tsv = buildCardsExportText(
      filteredRows,
      visibleCols,
      (usd) => currencyStore.formatUsd(usd, { noCurrency: true }),
      'tsv',
      cfg.escapeCsvFormula,
    );
    try {
      await navigator.clipboard.writeText(tsv);
      copyFeedback = 'Copied';
      if (copyTimer) window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => {
        copyFeedback = '';
      }, 2200);
    } catch {
      cfg.openTextExportDialog({
        title: `Copy Set Table (${filteredRows.length.toLocaleString()} sets)`,
        label: 'Tab-separated rows (ready to paste into spreadsheets)',
        text: tsv,
        filename: 'STC_set_data.tsv',
        mimeType: 'text/tab-separated-values;charset=utf-8',
      });
    }
  }

  async function loadSetData() {
    const cfg = getCfg();
    dataError = '';
    try {
      let rawDoc: RawSetDataDoc | null = null;
      try {
        const v2 = await loadDataset('data/set_data_v2.json');
        const unpacked = cfg.unpackSetDataV2(v2);
        if (unpacked && Array.isArray(unpacked.sets)) {
          rawDoc = unpacked as RawSetDataDoc;
        }
      } catch {
        rawDoc = null;
      }
      if (!rawDoc) {
        const legacy = await loadDataset('data/set_data.json');
        if (legacy && Array.isArray(legacy.sets)) {
          rawDoc = legacy as RawSetDataDoc;
        }
      }
      if (!rawDoc) {
        throw new Error('Invalid set dataset');
      }
      const built = buildCardSetRows(rawDoc);
      allRows = built.rows;
      nameToAppid = built.nameToAppid;
      appidToSet = built.appidToSet;
      meta = built.meta;
      dataLoaded = true;
      dataVersion += 1;
      if (userLoaded) {
        recomputeUserBindings();
      }
    } catch {
      dataError = 'Could not load trading card set data from CDN. Try refreshing or checking connection.';
    }
  }

  onMount(() => {
    // Restore saved filter prefs
    try {
      const savedSet = window.localStorage.getItem('setTypeConfig');
      if (savedSet) {
        const parsed = JSON.parse(savedSet);
        if (parsed && typeof parsed === 'object') {
          setType = { standard: Boolean(parsed.standard), foil: Boolean(parsed.foil) };
        }
      }
      const savedFilters = window.localStorage.getItem('filtersConfig');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        if (parsed && typeof parsed === 'object') {
          filters = { ...filters, ...parsed };
        }
      }
    } catch {
      // Ignore corrupt localStorage
    }

    if (steamIdInputEl) {
      try {
        getCfg().attachSteamIdPasteGuard(steamIdInputEl, {
          onJsonPaste: (text) => openInventoryImporter(text),
          onOversizedPaste: () => {
            userStatus = 'Pasted text is too long for a SteamID — use Import from Steam instead.';
          },
        });
      } catch {
        // Ignore
      }
    }

    let ro: ResizeObserver | undefined;
    if (tableScrollEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          viewportHeight = Math.max(260, entry.contentRect.height);
        }
      });
      ro.observe(tableScrollEl);
    }

    void loadSetData();

    // Auto-restore profile from hash -> OpenID session -> lastUser
    const rawHash = window.location.hash.slice(1).replace(/^\//, '');
    if (rawHash.trim()) {
      try {
        userIdInput = decodeURIComponent(rawHash);
      } catch {
        userIdInput = rawHash;
      }
      void fetchUserProfile(userIdInput);
    } else {
      void getCfg()
        .checkAuthSession(httpShim)
        .then((auth) => {
          if (auth && auth.authenticated && auth.steamid) {
            userIdInput = auth.steamid;
            void fetchUserProfile(auth.steamid);
          } else {
            try {
              const last = window.localStorage.getItem('lastUser');
              if (last && last !== 'undefined') {
                userIdInput = last;
                void fetchUserProfile(last);
              }
            } catch {
              // Ignore
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      ro?.disconnect();
      if (copyTimer) window.clearTimeout(copyTimer);
    };
  });
</script>

<!-- Control Deck -->
<section class="st-panel" aria-label="Profile and Table Controls">
  <div class="st-deck-row">
    <div class="st-deck-group">
      {#if !userLoaded}
        <a href={steamLoginUrl} title="Sign in through Steam OpenID" style="display: inline-flex;">
          <img src="/img/steam_openid.png" alt="Sign in through Steam" width="114" height="43" style="height: 29px; width: auto;" />
        </a>
        <form
          class="st-join"
          onsubmit={(e) => {
            e.preventDefault();
            void fetchUserProfile(userIdInput);
          }}
        >
          <label for="st-cards-steamid" class="st-visually-hidden">SteamID or profile URL</label>
          <input
            id="st-cards-steamid"
            bind:this={steamIdInputEl}
            bind:value={userIdInput}
            type="text"
            maxlength="256"
            class="st-input"
            style="width: min(210px, 52vw);"
            placeholder="SteamID64, custom URL, or link"
            autocorrect="off"
            autocapitalize="none"
            spellcheck="false"
          />
          <button type="submit" class="st-btn st-btn-primary">Fetch</button>
        </form>
      {:else}
        {#if userProfile.steamid64}
          <a
            class="st-btn st-btn-sm"
            href={`https://steamcommunity.com/profiles/${userProfile.steamid64}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Steam Profile ↗
          </a>
          <button
            type="button"
            class="st-btn st-btn-sm st-btn-primary"
            onclick={() => void fetchUserProfile(userProfile.steamid64)}
          >
            Reload
          </button>
        {/if}
        <button type="button" class="st-btn st-btn-sm st-btn-danger" onclick={handleLogout}>
          Logout
        </button>
      {/if}

      {#if userLoaded || userData.games > 0 || userData.cards > 0 || userData.badges > 0}
        <div class="st-status-pills" aria-label="Loaded user data status">
          <span class="st-pill {statusPillClass(userData.games)}">Games</span>
          <span class="st-pill {statusPillClass(userData.cards)}">Cards</span>
          <span class="st-pill {statusPillClass(userData.badges)}">Badges</span>
        </div>
      {/if}
    </div>

    <div class="st-deck-group">
      {#if !userLoaded}
        <button type="button" class="st-btn st-btn-sm" onclick={() => gameListDlg?.open()}>
          Paste Game List
        </button>
      {/if}
      <button type="button" class="st-btn st-btn-sm" onclick={() => openInventoryImporter()}>
        {userLoaded ? (userMoreItems ? `Add Inventory Page ${userNextPage}` : 'Update Inventory') : 'Manual import'}
      </button>
      <button type="button" class="st-btn st-btn-sm" onclick={() => levelCalcDlg?.open()}>
        Level Calculator
      </button>
    </div>
  </div>

  {#if userStatus}
    <div class="st-alert is-warn" role="status" aria-live="polite" style="margin-top: 8px; margin-bottom: 0;">
      <span>{userStatus}</span>
    </div>
  {/if}

  <div class="st-deck-row">
    <div class="st-deck-group">
      <label for="st-cards-search" class="st-visually-hidden">Search card sets by title or AppID</label>
      <input
        id="st-cards-search"
        type="search"
        class="st-input"
        style="width: min(210px, 54vw);"
        placeholder="Search game or AppID..."
        bind:value={searchQuery}
        oninput={() => { if (tableScrollEl) tableScrollEl.scrollTop = 0; }}
        autocorrect="off"
        autocapitalize="none"
        spellcheck="false"
      />

      <div class="st-seg-group" role="group" aria-label="Set types">
        <button
          type="button"
          class="st-btn st-btn-sm"
          class:is-pressed={setType.standard}
          aria-pressed={setType.standard}
          onclick={() => toggleSetType('standard')}
        >
          Standard
        </button>
        <button
          type="button"
          class="st-btn st-btn-sm"
          class:is-pressed={setType.foil}
          aria-pressed={setType.foil}
          onclick={() => toggleSetType('foil')}
        >
          Foil
        </button>
      </div>

      <button
        type="button"
        class="st-chip"
        class:is-active={filters.hide_f2p}
        aria-pressed={filters.hide_f2p}
        title="Hide Free-To-Play games"
        onclick={() => toggleFilter('hide_f2p')}
      >
        Hide F2P
      </button>
      <button
        type="button"
        class="st-chip"
        class:is-active={filters.hide_nonf2p}
        aria-pressed={filters.hide_nonf2p}
        title="Only show Free-To-Play games"
        onclick={() => toggleFilter('hide_nonf2p')}
      >
        Only F2P
      </button>

      {#if userLoaded}
        <button
          type="button"
          class="st-chip"
          class:is-active={filters.own_game}
          aria-pressed={filters.own_game}
          disabled={userData.games < 3}
          onclick={() => toggleFilter('own_game')}
        >
          Owned Games
        </button>
        <button
          type="button"
          class="st-chip"
          class:is-active={filters.not_own_game}
          aria-pressed={filters.not_own_game}
          disabled={userData.games < 3}
          onclick={() => toggleFilter('not_own_game')}
        >
          Not Owned
        </button>
        <button
          type="button"
          class="st-chip"
          class:is-active={filters.own_cards}
          aria-pressed={filters.own_cards}
          disabled={userData.cards < 3}
          onclick={() => toggleFilter('own_cards')}
        >
          Owned Cards
        </button>
        {#if userSummary.hasCompleteBadges}
          <button
            type="button"
            class="st-chip"
            class:is-active={filters.hide_completed}
            aria-pressed={filters.hide_completed}
            disabled={userData.badges < 3}
            onclick={() => toggleFilter('hide_completed')}
          >
            Incomplete Badges
          </button>
          <button
            type="button"
            class="st-chip"
            class:is-active={filters.hide_incompleted}
            aria-pressed={filters.hide_incompleted}
            disabled={userData.badges < 3}
            onclick={() => toggleFilter('hide_incompleted')}
          >
            Complete Badges
          </button>
        {/if}
      {/if}
    </div>

    <div class="st-deck-group">
      <button
        type="button"
        class="st-btn st-btn-sm"
        style="anchor-name: --st-cols-trigger;"
        popovertarget="st-cards-cols-popover"
      >
        Columns ({activeColumns.length}/{availableColumns.length})
      </button>
      <button type="button" class="st-btn st-btn-sm" onclick={() => void copyVisibleTsv()} disabled={!dataLoaded}>
        {copyFeedback || 'Copy TSV'}
      </button>
      <button type="button" class="st-btn st-btn-sm" onclick={exportCsv} disabled={!dataLoaded}>
        CSV
      </button>
    </div>
  </div>

  {#if dataLoaded}
    <div class="st-deck-row st-panel-stats" aria-label="Catalog and Profile Summary">
      <div class="st-stats-items">
        <span>Synced <strong>{formatRelativeTime(meta.time)}</strong></span>
        {#if meta.data_median_age}
          <span>Median age <strong class="st-stat-val">{formatDurationAge(meta.data_median_age)}</strong></span>
        {/if}
        <span><strong class="st-stat-val">{meta.game_count.toLocaleString()}</strong> games</span>
        <span><strong class="st-stat-val">{meta.card_count.toLocaleString()}</strong> cards</span>
        <span><strong class="st-stat-val">{meta.bg_count.toLocaleString()}</strong> bgs</span>
        <span><strong class="st-stat-val">{meta.emote_count.toLocaleString()}</strong> emotes</span>
      </div>
      <div class="st-stats-items">
        <span>Showing <strong class="st-stat-val">{filteredRows.length.toLocaleString()}</strong> / {allRows.length.toLocaleString()} sets</span>
      </div>
    </div>
  {/if}

  {#if userLoaded}
    <div class="st-deck-row st-panel-stats" aria-label="User Profile Stats">
      <div class="st-stats-items">
        {#if userStale}
          <span class="st-pill is-loading">Cached snapshot (Steam rate-limited)</span>
        {/if}
        {#if userData.badges > 2}
          <span>Level <strong class="st-stat-val">{userProfile.level}</strong> ({userProfile.xp.toLocaleString()} XP)</span>
          <span>
            <strong class="st-stat-val">{userSummary.badge_count.toLocaleString()}</strong> badges
            (cost ~<strong class="st-stat-val">{currencyStore.formatUsd(userSummary.badge_worth)}</strong>)
          </span>
        {/if}
        {#if userData.games > 2}
          <span>
            <strong class="st-stat-val">{userSummary.game_count.toLocaleString()}</strong> STC games
            (drops ~<strong class="st-stat-val">{currencyStore.formatUsd(userSummary.game_worth)}</strong>)
          </span>
        {/if}
        {#if userData.cards > 2}
          <span>
            <strong class="st-stat-val">{userSummary.card_count.toLocaleString()}</strong> cards
            (worth ~<strong class="st-stat-val">{currencyStore.formatUsd(userSummary.card_worth)}</strong>)
          </span>
          <span><strong class="st-stat-val">{userProfile.bg_count.toLocaleString()}</strong> bgs</span>
          <span><strong class="st-stat-val">{userProfile.emote_count.toLocaleString()}</strong> emotes</span>
        {/if}
      </div>
    </div>
  {/if}
</section>

{#if dataError}
  <div class="st-alert is-error" role="alert">
    <span>{dataError}</span>
    <button type="button" class="st-btn st-btn-sm" onclick={() => void loadSetData()}>Retry</button>
  </div>
{/if}

<!-- Columns Native Popover -->
<div id="st-cards-cols-popover" popover="auto" class="st-popover" aria-label="Choose table columns">
  <div class="st-deck-row" style="margin-bottom: 6px;">
    <strong>Visible Columns</strong>
    <button type="button" class="st-btn st-btn-sm" popovertarget="st-cards-cols-popover" popovertargetaction="hide">
      Done
    </button>
  </div>
  <div class="st-deck-group" style="margin-bottom: 8px;">
    <button type="button" class="st-btn st-btn-sm" onclick={() => applyColumnPreset('default')}>Default</button>
    <button type="button" class="st-btn st-btn-sm" onclick={() => applyColumnPreset('crafting')}>Crafting</button>
    <button type="button" class="st-btn st-btn-sm" onclick={() => applyColumnPreset('boosters')}>Boosters</button>
    <button type="button" class="st-btn st-btn-sm" onclick={() => applyColumnPreset('all')}>All</button>
  </div>
  <div class="st-popover-grid">
    {#each availableColumns as col}
      <label class="st-check-label" title={col.hint}>
        <input type="checkbox" bind:checked={visibleCols[col.key]} />
        <span>{col.title}</span>
      </label>
    {/each}
  </div>
</div>

<!-- Virtualized Semantic Data Table -->
<div role="status" aria-live="polite" class="st-visually-hidden">{sortAnnouncement}</div>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={tableScrollEl}
  class="st-table-region is-cards-scroll"
  role="region"
  aria-labelledby="st-cards-table-caption"
  tabindex="0"
  onscroll={(e) => {
    scrollTop = e.currentTarget.scrollTop;
  }}
>
  <table class="st-table" class:is-empty={filteredRows.length === 0}>
    <caption id="st-cards-table-caption" class="st-visually-hidden">
      Steam Trading Card Set Prices
    </caption>
    <thead>
      <tr>
        {#each activeColumns as col (col.key)}
          <th
            scope="col"
            class:is-sticky-col={col.key === 'game'}
            class:is-left={col.align === 'left'}
            class:is-right={col.align === 'right'}
            style:min-width={`${col.width}px`}
            aria-sort={sortKey === col.key
              ? (sortDir === 'asc' ? 'ascending' : 'descending')
              : undefined}
            title={col.hint}
          >
            {#if col.type === 'none'}
              <span>{col.title}</span>
            {:else}
              <button type="button" class="st-sort-btn" onclick={() => toggleSort(col)}>
                <span>{col.title}</span>
                <span class="st-sort-icon" aria-hidden="true"></span>
              </button>
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if !dataLoaded && !dataError}
        <tr>
          <td colspan={activeColumns.length} class="st-cell-center" style="padding: 24px; color: var(--st-text-muted);">
            Loading Steam trading card set data...
          </td>
        </tr>
      {:else if filteredRows.length === 0}
        <tr>
          <td colspan={activeColumns.length} class="st-cell-center" style="padding: 24px; color: var(--st-text-muted);">
            No matching card sets found.
          </td>
        </tr>
      {:else}
        {#if topSpacerPx > 0}
          <tr class="is-spacer" aria-hidden="true">
            <td colspan={activeColumns.length} style:height={`${topSpacerPx}px`}></td>
          </tr>
        {/if}

        {#each windowRows as row (row.id)}
          {@const links = generateSetLinks(row.appid, row.foil, userProfile.steamid64)}
          <tr>
            {#each activeColumns as col (col.key)}
              {#if col.key === 'game'}
                <td class="st-cell-left is-sticky-col" title={row.game}>
                  <span class="st-game-name">
                    <span class="st-game-text">{row.baseGame}</span>
                    {#if row.foil}
                      <span class="st-tag">Foil</span>
                    {/if}
                    {#if row.f2p}
                      <span class="st-tag">F2P</span>
                    {/if}
                  </span>
                </td>
              {:else if col.key === 'links'}
                <td class="st-cell-center">
                  <span class="st-links-cell">
                    <a href={links.badge} target="_blank" rel="noopener noreferrer" title="Badge page">[B]</a>
                    <a href={links.store} target="_blank" rel="noopener noreferrer" title="Steam Store">[S]</a>
                    <a href={links.market} target="_blank" rel="noopener noreferrer" title="Community Market">[M]</a>
                    <a href={links.exchange} target="_blank" rel="noopener noreferrer" title="SteamCardExchange">[E]</a>
                  </span>
                </td>
              {:else if col.key === 'cards_owned'}
                <td class="st-cell-right">{row.cards_owned}</td>
              {:else if col.key === 'unique_owned'}
                <td class="st-cell-right">{row.unique_owned}</td>
              {:else if col.key === 'count'}
                <td class="st-cell-right">{row.count}</td>
              {:else if col.key === 'badge_lvl'}
                <td class="st-cell-right">{row.badge_lvl}</td>
              {:else if col.key === 'price_set'}
                <td class="st-cell-right">{formatCellPrice(row.price_set)}</td>
              {:else if col.key === 'price_diff'}
                <td class="st-cell-right">{formatCellPrice(row.price_diff)}</td>
              {:else if col.key === 'price_avg'}
                <td class="st-cell-right">{formatCellPrice(row.price_avg)}</td>
              {:else if col.key === 'booster_avg'}
                <td class="st-cell-right">{formatCellPrice(row.booster_avg)}</td>
              {:else if col.key === 'booster_eff'}
                <td class="st-cell-right">
                  {#if Number.isFinite(row.booster_eff)}
                    <a href={row.booster_url} target="_blank" rel="noopener noreferrer">
                      {(row.booster_eff * 100).toFixed(1)}%
                    </a>
                  {:else}
                    <span style="color: var(--st-text-muted);">&mdash;</span>
                  {/if}
                </td>
              {:else if col.key === 'emotes_avg'}
                <td class="st-cell-right">{formatCellPrice(row.emotes_avg)}</td>
              {:else if col.key === 'bgs_avg'}
                <td class="st-cell-right">{formatCellPrice(row.bgs_avg)}</td>
              {:else if col.key === 'qty_avg'}
                <td class="st-cell-right">{row.qty_avg.toLocaleString()}</td>
              {:else if col.key === 'discount'}
                <td class="st-cell-right">{formatCellPrice(row.discount)}</td>
              {:else if col.key === 'added'}
                <td class="st-cell-right">{formatShortDate(row.added)}</td>
              {:else if col.key === 'appid'}
                <td class="st-cell-right">{row.appid}</td>
              {/if}
            {/each}
          </tr>
        {/each}

        {#if bottomSpacerPx > 0}
          <tr class="is-spacer" aria-hidden="true">
            <td colspan={activeColumns.length} style:height={`${bottomSpacerPx}px`}></td>
          </tr>
        {/if}
      {/if}
    </tbody>
  </table>
</div>

<GameListDialog
  bind:this={gameListDlg}
  {dataLoaded}
  {nameToAppid}
  {appidToSet}
  onApply={applyImportedGameList}
/>

<LevelCalcDialog
  bind:this={levelCalcDlg}
  rows={allRows}
  {userLoaded}
  hasBadges={userData.badges > 2}
  userLevel={userProfile.level}
  userXp={userProfile.xp}
  badgeCount={userSummary.badge_count}
  badgeUnique={userSummary.badge_unique}
/>
