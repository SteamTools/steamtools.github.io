<script lang="ts">
  import { onMount } from 'svelte';
  import {
    apiRequestWithFailover,
    computeShardHex64,
    fetchCdnJson,
    getCfg,
    httpShim,
    loadDataset,
  } from '../lib/bridge.ts';
  import { enhanceModalDialog } from '../lib/dialog.ts';
  import {
    computeIntersectedGames,
    decodeGameDataIntoMap,
    extractSteamIdentifier,
    GAME_FLAG_DEFS,
    parseOwnedAppsPayload,
    type FlagFilterState,
    type GameMetaRecord,
    type SteamPlayerProfile,
  } from '../lib/games-logic.ts';

  const FLAG_SHORT_MAP = new Map(GAME_FLAG_DEFS.map((d) => [d.key, d.short]));

  interface FriendEntry {
    steamid: string;
    name: string;
    avatar: string;
  }

  let userInput = $state('');
  let addingUser = $state(false);
  let loadingShards = $state(false);
  let authSteamId = $state<string | null>(null);
  let statusMsg = $state('');
  let errorMsg = $state('');

  let players = $state<SteamPlayerProfile[]>([]);
  let ownedByPlayer = $state<Map<string, Set<string>>>(new Map());
  let metaMap = $state<Map<string, GameMetaRecord>>(new Map());
  let fallbackNames = $state<Map<string, string>>(new Map());
  const loadedShards = new Set<string>();
  let monolithLoaded = false;

  let query = $state('');
  let minOwnersMode = $state<'all' | 'custom'>('all');
  let customMinOwners = $state(1);
  let flagStates = $state<Record<string, FlagFilterState>>({});
  let sortCol = $state<'name' | 'appid' | 'owners'>('name');
  let sortDir = $state<'asc' | 'desc'>('asc');

  let friendsDialogEl = $state<HTMLDialogElement | null>(null);
  let friendsDialogOpen = $state(false);
  let friendsLoading = $state(false);
  let friendsError = $state('');
  let friendsOwnerName = $state('');
  let friendsFilter = $state('');
  let friendsList = $state<FriendEntry[]>([]);

  $effect(() => {
    if (!friendsDialogEl) return;
    if (friendsDialogOpen && !friendsDialogEl.open) {
      friendsDialogEl.returnValue = '';
      friendsDialogEl.showModal();
    } else if (!friendsDialogOpen && friendsDialogEl.open) {
      friendsDialogEl.close();
    }
  });

  function persistPlayers() {
    try {
      const ids = players.map((p) => p.steamid);
      const usersObj: Record<string, { name: string; avatar: string; selected: boolean }> = {};
      const privates: Record<string, boolean> = {};
      for (const p of players) {
        usersObj[p.steamid] = { name: p.name, avatar: p.avatar, selected: p.selected };
        if (p.privateProfile) privates[p.steamid] = true;
      }
      window.localStorage.setItem('ids', JSON.stringify(ids));
      window.localStorage.setItem('users', JSON.stringify(usersObj));
      window.localStorage.setItem('privates', JSON.stringify(privates));
    } catch {
      // Ignore storage quota errors
    }
  }

  async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
  ) {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const idx = cursor;
        cursor += 1;
        await worker(items[idx]);
      }
    });
    await Promise.all(runners);
  }

  async function ensureMetadataForAppIds(appIds: string[]) {
    if (monolithLoaded || appIds.length === 0) return;
    const neededShards: string[] = [];
    const seen = new Set<string>();
    for (const id of appIds) {
      if (metaMap.has(id)) continue;
      const sh = computeShardHex64(id);
      if (!loadedShards.has(sh) && !seen.has(sh)) {
        seen.add(sh);
        neededShards.push(sh);
      }
    }
    if (neededShards.length === 0) return;

    loadingShards = true;
    const workingMap = new Map(metaMap);
    let failedShards = 0;

    try {
      await runWithConcurrency(neededShards, 4, async (sh) => {
        try {
          const shardDoc = await fetchCdnJson(`data/game_data/${sh}.json`);
          decodeGameDataIntoMap(shardDoc, workingMap);
          loadedShards.add(sh);
        } catch {
          failedShards += 1;
        }
      });

      if (failedShards > 0 && failedShards === neededShards.length && !monolithLoaded) {
        try {
          const monolith = await loadDataset('data/game_data.json');
          decodeGameDataIntoMap(monolith, workingMap);
          monolithLoaded = true;
        } catch {
          // Keep partial names
        }
      }
      metaMap = workingMap;
    } finally {
      loadingShards = false;
    }
  }

  async function fetchOwnedForPlayer(steamid: string) {
    const cfg = getCfg();
    const resp = await apiRequestWithFailover(
      '/info',
      { method: 'GET', params: { owned: steamid } },
      { preferredBase: cfg.GAMES_API_BASE },
    );
    const parsed = parseOwnedAppsPayload(resp?.data);

    const nextOwned = new Map(ownedByPlayer);
    nextOwned.set(steamid, new Set(parsed.appIds));
    ownedByPlayer = nextOwned;

    if (parsed.fallbackNames.size > 0) {
      const nextNames = new Map(fallbackNames);
      for (const [k, v] of parsed.fallbackNames) nextNames.set(k, v);
      fallbackNames = nextNames;
    }

    players = players.map((p) =>
      p.steamid === steamid
        ? { ...p, privateProfile: parsed.isPrivate, loaded: true }
        : p,
    );
    persistPlayers();
    await ensureMetadataForAppIds(parsed.appIds);
  }

  async function addPlayerByInput(rawId?: string) {
    const identifier = extractSteamIdentifier(rawId ?? userInput);
    if (!identifier) {
      errorMsg = 'Enter a SteamID64, custom URL name, or profile link.';
      return;
    }
    errorMsg = '';
    statusMsg = `Resolving ${identifier}...`;
    addingUser = true;
    try {
      const cfg = getCfg();
      const userResp = await apiRequestWithFailover(
        '/info',
        { method: 'GET', params: { user: identifier } },
        { preferredBase: cfg.GAMES_API_BASE },
      );
      const playerObj =
        userResp?.data?.response?.players?.[0] ||
        userResp?.data?.players?.[0] ||
        userResp?.data;

      const steamid = String(playerObj?.steamid || (/^\d{15,20}$/.test(identifier) ? identifier : ''));
      if (!steamid) {
        errorMsg = `Could not resolve Steam profile for "${identifier}".`;
        statusMsg = '';
        return;
      }

      const nextProfile: SteamPlayerProfile = {
        steamid,
        name: String(playerObj?.personaname || playerObj?.name || steamid),
        avatar: String(playerObj?.avatarmedium || playerObj?.avatar || ''),
        selected: true,
        privateProfile: false,
        loaded: false,
      };

      const existingIdx = players.findIndex((p) => p.steamid === steamid);
      if (existingIdx >= 0) {
        players = players.map((p, i) => (i === existingIdx ? { ...nextProfile, selected: true } : p));
      } else {
        players = [...players, nextProfile];
      }
      if (!rawId) userInput = '';
      persistPlayers();

      statusMsg = `Loading game library for ${nextProfile.name}...`;
      await fetchOwnedForPlayer(steamid);
      statusMsg = '';
    } catch (err: any) {
      errorMsg = err?.data?.error || err?.message || `Failed to load Steam user "${identifier}".`;
      statusMsg = '';
    } finally {
      addingUser = false;
    }
  }

  async function openFriendsFor(player: SteamPlayerProfile) {
    friendsOwnerName = player.name;
    friendsFilter = '';
    friendsError = '';
    friendsList = [];
    friendsDialogOpen = true;
    friendsLoading = true;
    try {
      const cfg = getCfg();
      const resp = await apiRequestWithFailover(
        '/info',
        { method: 'GET', params: { friends: player.steamid } },
        { preferredBase: cfg.GAMES_API_BASE },
      );
      const data = resp?.data || {};
      if (data.private) {
        friendsError = `${player.name}'s friend list is private on Steam.`;
        return;
      }
      const rawList = Array.isArray(data.friends)
        ? data.friends
        : (Array.isArray(data.response?.players)
          ? data.response.players
          : (Array.isArray(data.players) ? data.players : []));
      friendsList = rawList
        .map((f: any) => ({
          steamid: String(f.steamid || f.id || ''),
          name: String(f.personaname || f.name || f.steamid || ''),
          avatar: String(f.avatarmedium || f.avatar || ''),
        }))
        .filter((f: FriendEntry) => Boolean(f.steamid))
        .sort((a: FriendEntry, b: FriendEntry) => a.name.localeCompare(b.name));
      if (friendsList.length === 0) {
        friendsError = 'No public friends found for this account.';
      }
    } catch {
      friendsError = 'Failed to fetch friends list from Steam.';
    } finally {
      friendsLoading = false;
    }
  }

  function togglePlayerSelection(steamid: string) {
    players = players.map((p) => (p.steamid === steamid ? { ...p, selected: !p.selected } : p));
    persistPlayers();
  }

  function removePlayer(steamid: string) {
    players = players.filter((p) => p.steamid !== steamid);
    const nextOwned = new Map(ownedByPlayer);
    nextOwned.delete(steamid);
    ownedByPlayer = nextOwned;
    persistPlayers();
  }

  function clearAllPlayers() {
    players = [];
    ownedByPlayer = new Map();
    persistPlayers();
  }

  function cycleFlag(key: string) {
    const cur = flagStates[key] || 0;
    const next: FlagFilterState = cur === 0 ? 1 : (cur === 1 ? -1 : 0);
    flagStates = { ...flagStates, [key]: next };
  }

  function toggleSort(col: 'name' | 'appid' | 'owners') {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = col === 'owners' ? 'desc' : 'asc';
    }
  }

  function exportFilteredGames() {
    const text = filteredGames
      .map((g) => `${g.appid}\t${g.name}\t${g.storeUrl}`)
      .join('\n');
    getCfg().openTextExportDialog({
      title: `Export Filtered Games (${filteredGames.length})`,
      filename: 'steam-games-filter.txt',
      text,
    });
  }

  let selectedPlayers = $derived(players.filter((p) => p.selected && !p.privateProfile));
  let filteredGames = $derived.by(() =>
    computeIntersectedGames({
      selectedPlayers: players,
      ownedByPlayer,
      metaMap,
      fallbackNames,
      minOwners: minOwnersMode === 'all' ? selectedPlayers.length : customMinOwners,
      query,
      flagStates,
      sortCol,
      sortDir,
    }),
  );

  let visibleFriends = $derived.by(() => {
    const q = friendsFilter.trim().toLowerCase();
    if (!q) return friendsList;
    return friendsList.filter(
      (f) => f.name.toLowerCase().includes(q) || f.steamid.includes(q),
    );
  });

  async function resolvePlayerProfile(steamid: string) {
    try {
      const cfg = getCfg();
      const userResp = await apiRequestWithFailover(
        '/info',
        { method: 'GET', params: { user: steamid } },
        { preferredBase: cfg.GAMES_API_BASE },
      );
      const playerObj =
        userResp?.data?.response?.players?.[0] ||
        userResp?.data?.players?.[0] ||
        userResp?.data;
      const resolvedName = String(playerObj?.personaname || playerObj?.name || '').trim();
      const resolvedAvatar = String(playerObj?.avatarmedium || playerObj?.avatar || '').trim();
      if (!resolvedName && !resolvedAvatar) return;
      players = players.map((p) =>
        p.steamid === steamid
          ? {
              ...p,
              name: resolvedName || p.name,
              avatar: resolvedAvatar || p.avatar,
            }
          : p,
      );
      persistPlayers();
    } catch {
      // Keep steamid fallback if Steam profile resolution fails
    }
  }

  onMount(() => {
    try {
      const savedIds = JSON.parse(window.localStorage.getItem('ids') || '[]');
      const savedUsers = JSON.parse(window.localStorage.getItem('users') || '{}');
      const savedPrivates = JSON.parse(window.localStorage.getItem('privates') || '{}');
      if (Array.isArray(savedIds) && savedIds.length > 0) {
        const restored: SteamPlayerProfile[] = [];
        for (const id of savedIds) {
          const sid = String(id || '');
          if (!sid) continue;
          const u = savedUsers?.[sid] || {};
          restored.push({
            steamid: sid,
            name: String(u.name || u.personaname || sid),
            avatar: String(u.avatar || u.avatarmedium || ''),
            selected: u.selected !== false,
            privateProfile: Boolean(savedPrivates?.[sid]),
            loaded: false,
          });
        }
        players = restored;
        void Promise.all(
          restored.map(async (p) => {
            const jobs: Promise<unknown>[] = [];
            if (!p.avatar || p.name === p.steamid) {
              jobs.push(resolvePlayerProfile(p.steamid));
            }
            if (!p.privateProfile) {
              jobs.push(fetchOwnedForPlayer(p.steamid));
            }
            await Promise.all(jobs);
          }),
        );
      }
    } catch {
      // Ignore malformed storage
    }

    void getCfg()
      .checkAuthSession(httpShim)
      .then((res) => {
        if (res?.authenticated && res.steamid) {
          authSteamId = res.steamid;
        }
      })
      .catch(() => {});
  });
</script>

<section class="st-panel" aria-label="Players and Game Filters">
  <!-- Row 1: Players -->
  <form
    class="st-deck-row"
    onsubmit={(e) => {
      e.preventDefault();
      void addPlayerByInput();
    }}
  >
    <div class="st-deck-group">
      <label for="st-games-user" style="font-weight: 600;">Player:</label>
      <div class="st-join">
        <input
          id="st-games-user"
          name="steamUser"
          type="text"
          class="st-input"
          style="width: min(230px, 52vw);"
          placeholder="SteamID64, vanity ID, or profile URL"
          bind:value={userInput}
        />
        <button type="submit" class="st-btn st-btn-primary" disabled={addingUser}>
          {addingUser ? 'Adding...' : 'Add'}
        </button>
      </div>

      {#if authSteamId}
        <button
          type="button"
          class="st-btn st-btn-sm"
          disabled={addingUser}
          onclick={() => void addPlayerByInput(authSteamId || '')}
        >
          Add My Account
        </button>
      {:else}
        <a
          class="st-btn st-btn-sm"
          href={getCfg().getLoginUrl(typeof window !== 'undefined' ? window.location.href : '/games/')}
        >
          Sign in with Steam
        </a>
      {/if}

      {#if players.length > 0}
        <button type="button" class="st-btn st-btn-sm" onclick={clearAllPlayers}>
          Clear
        </button>
      {/if}
    </div>

    <div class="st-deck-group">
      {#if statusMsg}
        <span style="font-size: 12px; color: var(--st-text-muted);">{statusMsg}</span>
      {/if}
      {#if loadingShards}
        <span class="st-pill is-loading">Loading metadata...</span>
      {/if}
      <span class="st-pill">
        {filteredGames.length.toLocaleString()} {filteredGames.length === 1 ? 'game' : 'games'}
      </span>
      {#if filteredGames.length > 0}
        <button type="button" class="st-btn st-btn-sm" onclick={exportFilteredGames}>
          Export List
        </button>
      {/if}
    </div>
  </form>

  {#if errorMsg}
    <div class="st-alert is-danger" role="alert" style="margin-top: 8px; margin-bottom: 0;">
      <span>{errorMsg}</span>
      <button
        type="button"
        class="st-btn st-btn-sm"
        aria-label="Dismiss error"
        onclick={() => { errorMsg = ''; }}
      >
        &times;
      </button>
    </div>
  {/if}

  {#if players.length > 0}
    <div class="st-player-list" style="margin-top: 8px;">
      {#each players as player (player.steamid)}
        {@const count = ownedByPlayer.get(player.steamid)?.size ?? 0}
        <div
          class="st-player-chip"
          class:is-selected={player.selected}
          class:is-private={player.privateProfile}
        >
          <input
            type="checkbox"
            checked={player.selected}
            aria-label={`Include ${player.name}`}
            onchange={() => togglePlayerSelection(player.steamid)}
          />
          {#if player.avatar}
            <img src={player.avatar} alt="" width="22" height="22" />
          {/if}
          <span>
            <strong>{player.name}</strong>
            <span style="color: var(--st-text-muted); font-size: 11px;">
              {#if player.privateProfile}
                (Private)
              {:else if player.loaded}
                ({count.toLocaleString()})
              {:else}
                (Loading...)
              {/if}
            </span>
          </span>
          <button
            type="button"
            class="st-btn st-btn-sm"
            style="height: 22px; padding: 0 6px; font-size: 11px;"
            title={`Browse ${player.name}'s Steam friends`}
            onclick={() => void openFriendsFor(player)}
          >
            Friends
          </button>
          <button
            type="button"
            class="st-btn st-btn-sm"
            style="height: 22px; padding: 0 6px; font-size: 11px;"
            aria-label={`Remove ${player.name}`}
            onclick={() => removePlayer(player.steamid)}
          >
            &times;
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Row 2: Search + Match + Category Flags -->
  <div class="st-deck-row">
    <div class="st-deck-group">
      <label class="st-visually-hidden" for="st-games-search">Filter games</label>
      <input
        id="st-games-search"
        name="gameSearch"
        type="search"
        class="st-input"
        style="width: min(220px, 52vw);"
        placeholder="Filter game title or AppID..."
        bind:value={query}
      />

      {#if selectedPlayers.length > 1}
        <label for="st-games-owners">Match:</label>
        <select
          id="st-games-owners"
          name="minOwnersMode"
          class="st-select"
          bind:value={minOwnersMode}
        >
          <option value="all">Owned by all ({selectedPlayers.length})</option>
          <option value="custom">At least K players</option>
        </select>
        {#if minOwnersMode === 'custom'}
          <input
            type="number"
            class="st-input"
            style="width: 62px;"
            min="1"
            max={selectedPlayers.length}
            aria-label="Minimum owners count"
            bind:value={customMinOwners}
          />
        {/if}
      {/if}
    </div>

    <span style="font-size: 11.5px; color: var(--st-text-muted);">
      Flags: <strong>+</strong> require &middot; <strong>&minus;</strong> exclude &middot; 3rd click clears
    </span>
  </div>

  <div class="st-flag-grid" style="margin-top: 8px;" role="group" aria-label="Steam category filters (click once to include, twice to exclude)">
    {#each GAME_FLAG_DEFS as def}
      {@const st = flagStates[def.key] || 0}
      <button
        type="button"
        class="st-flag-btn"
        class:is-include={st === 1}
        class:is-exclude={st === -1}
        title="Click to require (+), click again to exclude (-), third click clears"
        onclick={() => cycleFlag(def.key)}
      >
        {#if st === 1}<span style="margin-right: 4px;">+</span>{/if}{#if st === -1}<span style="margin-right: 4px;">&minus;</span>{/if}{def.label}
      </button>
    {/each}
  </div>
</section>

<div class="st-panel" style="padding: 0;">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="st-table-region" role="region" aria-label="Shared Games Table" tabindex="0">
    <table class="st-table" class:is-empty={filteredGames.length === 0}>
      <thead>
        <tr>
          <th class="st-cell-right" style="width: 90px;" aria-sort={sortCol === 'appid' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
            <button type="button" class="st-sort-btn" onclick={() => toggleSort('appid')}>
              <span>AppID</span>
              <span class="st-sort-icon" aria-hidden="true"></span>
            </button>
          </th>
          <th class="st-cell-left" aria-sort={sortCol === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
            <button type="button" class="st-sort-btn" onclick={() => toggleSort('name')}>
              <span>Game</span>
              <span class="st-sort-icon" aria-hidden="true"></span>
            </button>
          </th>
          <th class="st-cell-left">Features</th>
          <th class="st-cell-center" style="width: 95px;" aria-sort={sortCol === 'owners' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
            <button type="button" class="st-sort-btn" onclick={() => toggleSort('owners')}>
              <span>Owners</span>
              <span class="st-sort-icon" aria-hidden="true"></span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {#if filteredGames.length === 0}
          <tr>
            <td colspan="4" class="st-cell-center" style="padding: 28px 16px; color: var(--st-text-muted);">
              {players.length === 0
                ? 'No players added yet.'
                : 'No games match the selected intersection and feature filters.'}
            </td>
          </tr>
        {:else}
          {#each filteredGames as game (game.appid)}
            <tr>
              <td class="st-cell-right" style="color: var(--st-text-muted);">{game.appid}</td>
              <td class="st-cell-left">
                <a href={game.storeUrl} target="_blank" rel="noopener noreferrer">
                  {game.name}
                </a>
              </td>
              <td class="st-cell-left">
                {#each game.flags as flag}
                  <span
                    class="st-pill"
                    style="padding: 1px 6px; font-size: 11px; margin-right: 4px;"
                    title={flag}
                  >
                    {FLAG_SHORT_MAP.get(flag) || flag}
                  </span>
                {/each}
              </td>
              <td class="st-cell-center" title={game.ownerNames.join(', ')}>
                {game.ownerCount}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

<dialog
  class="st-dialog"
  closedby="any"
  bind:this={friendsDialogEl}
  use:enhanceModalDialog
  onclose={() => { friendsDialogOpen = false; }}
>
  <div class="st-dialog-head">
    <h2 class="st-dialog-title">{friendsOwnerName}'s Steam Friends</h2>
    <button type="button" class="st-btn st-btn-sm" onclick={() => { friendsDialogOpen = false; }} aria-label="Close">
      &times;
    </button>
  </div>
  <div class="st-dialog-body">
    <div style="margin-bottom: 10px;">
      <label class="st-visually-hidden" for="st-friend-search">Search friends</label>
      <input
        id="st-friend-search"
        type="search"
        class="st-input"
        style="width: 100%;"
        placeholder="Filter friends..."
        bind:value={friendsFilter}
      />
    </div>
    {#if friendsLoading}
      <p style="color: var(--st-text-muted);">Loading friends list...</p>
    {:else if friendsError}
      <p style="color: var(--st-danger);">{friendsError}</p>
    {:else}
      <div class="st-friend-grid">
        {#each visibleFriends as friend (friend.steamid)}
          {@const alreadyAdded = players.some((p) => p.steamid === friend.steamid)}
          <button
            type="button"
            class="st-friend-btn"
            onclick={() => {
              void addPlayerByInput(friend.steamid);
              friendsDialogOpen = false;
            }}
          >
            {#if friend.avatar}
              <img src={friend.avatar} alt="" width="24" height="24" style="border-radius: 3px;" />
            {/if}
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
              {friend.name}
            </span>
            {#if alreadyAdded}
              <span class="st-pill" style="font-size: 10.5px;">Added</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</dialog>
