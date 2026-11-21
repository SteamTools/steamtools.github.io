export type FlagFilterState = 0 | 1 | -1; // 0: off, 1: include, -1: exclude

export interface GameFlagDef {
  key: string;
  label: string;
  short: string;
}

export const GAME_FLAG_DEFS: GameFlagDef[] = [
  { key: 'singleplayer', label: 'Single-player', short: 'SP' },
  { key: 'local_coop', label: 'Local Co-op', short: 'L-Coop' },
  { key: 'coop', label: 'Co-op', short: 'Co-op' },
  { key: 'multiplayer', label: 'Multi-player', short: 'MP' },
  { key: 'controller', label: 'Controller', short: 'Pad' },
  { key: 'windows', label: 'Windows', short: 'Win' },
  { key: 'mac', label: 'Mac', short: 'Mac' },
  { key: 'linux', label: 'Linux', short: 'Linux' },
  { key: 'stc', label: 'Trading Cards', short: 'Cards' },
  { key: 'achievements', label: 'Achievements', short: 'Achv' },
  { key: 'workshop', label: 'Workshop', short: 'Mod' },
  { key: 'free2play', label: 'Free to Play', short: 'F2P' },
];

export interface SteamPlayerProfile {
  steamid: string;
  name: string;
  avatar: string;
  selected: boolean;
  privateProfile: boolean;
  loaded: boolean;
}

export interface GameMetaRecord {
  appid: string;
  name: string;
  flags: string[];
  flagSet: Set<string>;
}

export interface IntersectedGameRow {
  appid: string;
  name: string;
  flags: string[];
  ownerCount: number;
  ownerNames: string[];
  storeUrl: string;
}

export function extractSteamIdentifier(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const profileMatch = s.match(/steamcommunity\.com\/profiles\/(\d{15,20})/i);
  if (profileMatch) return profileMatch[1];
  const vanityMatch = s.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (vanityMatch) return vanityMatch[1];
  return s.replace(/^\/+|\/+$/g, '');
}

export function decodeGameDataIntoMap(
  doc: unknown,
  out: Map<string, GameMetaRecord>,
): number {
  if (!doc || typeof doc !== 'object') return 0;
  const obj = doc as Record<string, any>;
  let added = 0;

  // V2 bitmask shard format: { v: 2, flags: string[], apps: { [appid]: [name, mask] } }
  if (obj.v === 2 && Array.isArray(obj.flags) && obj.apps && typeof obj.apps === 'object') {
    const flagNames: string[] = obj.flags.map((f: unknown) => String(f || ''));
    for (const [appid, tuple] of Object.entries(obj.apps)) {
      if (!Array.isArray(tuple)) continue;
      const name = String(tuple[0] || `App ${appid}`);
      const mask = Number(tuple[1]) || 0;
      const flags: string[] = [];
      for (let bit = 0; bit < flagNames.length; bit += 1) {
        if ((mask & (1 << bit)) !== 0 && flagNames[bit]) {
          flags.push(flagNames[bit]);
        }
      }
      out.set(appid, { appid, name, flags, flagSet: new Set(flags) });
      added += 1;
    }
    return added;
  }

  // V1 monolith format: { [appid]: { name, flags, release } }
  for (const [appid, entry] of Object.entries(obj)) {
    if (!/^\d+$/.test(appid) || !entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const flags = Array.isArray(rec.flags) ? rec.flags.map((f) => String(f)) : [];
    const name = String(rec.name || `App ${appid}`);
    out.set(appid, { appid, name, flags, flagSet: new Set(flags) });
    added += 1;
  }
  return added;
}

export function parseOwnedAppsPayload(
  payload: any,
): { appIds: string[]; fallbackNames: Map<string, string>; isPrivate: boolean } {
  const isPrivate = Boolean(payload?.private || payload?.response?.private);
  const fallbackNames = new Map<string, string>();
  const appIdSet = new Set<string>();

  const gamesArr = Array.isArray(payload?.games)
    ? payload.games
    : (Array.isArray(payload?.response?.games) ? payload.response.games : []);
  for (const entry of gamesArr) {
    if (entry && typeof entry === 'object') {
      const id = String(entry.appid ?? entry.id ?? '');
      if (/^\d+$/.test(id)) {
        appIdSet.add(id);
        if (typeof entry.name === 'string' && entry.name) {
          fallbackNames.set(id, entry.name);
        }
      }
    } else {
      const id = String(entry ?? '');
      if (/^\d+$/.test(id)) appIdSet.add(id);
    }
  }

  const appsObj = payload?.apps || payload?.response?.apps;
  if (appsObj && typeof appsObj === 'object' && !Array.isArray(appsObj)) {
    for (const [appid, info] of Object.entries(appsObj)) {
      if (!/^\d+$/.test(appid)) continue;
      appIdSet.add(appid);
      if (typeof info === 'string' && info) {
        fallbackNames.set(appid, info);
      } else if (info && typeof info === 'object' && typeof (info as any).name === 'string') {
        fallbackNames.set(appid, String((info as any).name));
      }
    }
  }

  return { appIds: Array.from(appIdSet), fallbackNames, isPrivate };
}

export function computeIntersectedGames(opts: {
  selectedPlayers: SteamPlayerProfile[];
  ownedByPlayer: Map<string, Set<string>>;
  metaMap: Map<string, GameMetaRecord>;
  fallbackNames: Map<string, string>;
  minOwners: number;
  query: string;
  flagStates: Record<string, FlagFilterState>;
  sortCol: 'name' | 'appid' | 'owners';
  sortDir: 'asc' | 'desc';
}): IntersectedGameRow[] {
  const {
    selectedPlayers,
    ownedByPlayer,
    metaMap,
    fallbackNames,
    minOwners,
    query,
    flagStates,
    sortCol,
    sortDir,
  } = opts;

  const activePlayers = selectedPlayers.filter(
    (p) => p.selected && !p.privateProfile && ownedByPlayer.has(p.steamid),
  );
  if (activePlayers.length === 0) return [];

  const requiredCount = Math.max(1, Math.min(activePlayers.length, minOwners || activePlayers.length));
  const counts = new Map<string, { count: number; names: string[] }>();

  for (const player of activePlayers) {
    const appSet = ownedByPlayer.get(player.steamid);
    if (!appSet) continue;
    for (const appid of appSet) {
      let bucket = counts.get(appid);
      if (!bucket) {
        bucket = { count: 0, names: [] };
        counts.set(appid, bucket);
      }
      bucket.count += 1;
      bucket.names.push(player.name);
    }
  }

  const q = query.trim().toLowerCase();
  const includes: string[] = [];
  const excludes: string[] = [];
  for (const [flag, st] of Object.entries(flagStates)) {
    if (st === 1) includes.push(flag);
    else if (st === -1) excludes.push(flag);
  }

  const rows: IntersectedGameRow[] = [];
  for (const [appid, bucket] of counts.entries()) {
    if (bucket.count < requiredCount) continue;
    const meta = metaMap.get(appid);
    const name = meta?.name || fallbackNames.get(appid) || `App ${appid}`;
    if (q && !name.toLowerCase().includes(q) && !appid.includes(q)) continue;

    if (includes.length > 0 || excludes.length > 0) {
      if (!meta) {
        if (includes.length > 0) continue;
      } else {
        let ok = true;
        for (const reqFlag of includes) {
          if (!meta.flagSet.has(reqFlag)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        for (const banFlag of excludes) {
          if (meta.flagSet.has(banFlag)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }
    }

    rows.push({
      appid,
      name,
      flags: meta?.flags || [],
      ownerCount: bucket.count,
      ownerNames: bucket.names,
      storeUrl: `https://store.steampowered.com/app/${appid}/`,
    });
  }

  const dir = sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (sortCol === 'appid') {
      return (Number(a.appid) - Number(b.appid)) * dir;
    }
    if (sortCol === 'owners') {
      const diff = (a.ownerCount - b.ownerCount) * dir;
      if (diff !== 0) return diff;
    }
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    if (an !== bn) return (an < bn ? -1 : 1) * dir;
    return Number(a.appid) - Number(b.appid);
  });

  return rows;
}
