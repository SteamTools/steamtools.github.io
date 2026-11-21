export type GalleryOrderKey =
  | 'hue'
  | 'brightness'
  | 'saturation'
  | 'name'
  | 'game'
  | 'date'
  | 'price'
  | 'length'
  | 'random';

export type GalleryKind = 'emoticons' | 'backgrounds';

export interface GalleryItem {
  idx: number;
  name: string;
  nameLower: string;
  ownedKey: string;
  game: string;
  gameLower: string;
  url: string;
  appid: string;
  priceUsd: number;
  hue: number;
  brightness: number;
  saturation: number;
  hasPos: boolean;
  sheet: number;
  col: number;
  row: number;
  date: number;
  randomRank: number;
  img: string;
}

export interface GalleryFilterState {
  query: string;
  hueMin: number;
  hueMax: number;
  brightMin: number;
  brightMax: number;
  satMin: number;
  satMax: number;
  priceCentsMin: number;
  priceCentsMax: number;
  ownedMode: 'all' | 'owned' | 'unowned';
  ownedSet: Set<string>;
  order: GalleryOrderKey;
  reversed: boolean;
}

export const EMOTE_ORDER_OPTIONS: Array<{ key: GalleryOrderKey; label: string }> = [
  { key: 'hue', label: 'Hue' },
  { key: 'brightness', label: 'Brightness' },
  { key: 'saturation', label: 'Saturation' },
  { key: 'name', label: 'Name' },
  { key: 'game', label: 'Game' },
  { key: 'date', label: 'Date' },
  { key: 'price', label: 'Price' },
  { key: 'length', label: 'Name Length' },
  { key: 'random', label: 'Random' },
];

export const BG_ORDER_OPTIONS: Array<{ key: GalleryOrderKey; label: string }> =
  EMOTE_ORDER_OPTIONS.filter((opt) => opt.key !== 'length');

export function extractAppIdFromMarketUrl(url: string): string {
  const s = String(url || '');
  const parts = s.split('/');
  const slug = parts.length > 1 ? parts[1] : parts[0];
  const dash = slug.indexOf('-');
  if (dash > 0) {
    const candidate = slug.slice(0, dash);
    if (/^\d+$/.test(candidate)) return candidate;
  }
  return '';
}

export function normalizeEmoteOwnedKey(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^:+|:+$/g, '')
    .toLowerCase();
}

export function normalizeBgOwnedKey(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    return decodeURIComponent(s).toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

export function normalizeGalleryItems(
  rawItems: unknown[],
  datesMap: Record<string, number> | null | undefined,
  kind: GalleryKind,
): GalleryItem[] {
  const list = Array.isArray(rawItems) ? rawItems : [];
  const dates = datesMap && typeof datesMap === 'object' ? datesMap : {};
  const out: GalleryItem[] = new Array(list.length);

  for (let i = 0; i < list.length; i += 1) {
    const raw = (list[i] || {}) as Record<string, any>;
    const name = String(raw.name || '');
    const game = String(raw.game || '');
    const url = String(raw.url || '');
    const appid = String(raw.appid || '') || extractAppIdFromMarketUrl(url);
    const hls = Array.isArray(raw.hls) ? raw.hls : [raw.hue ?? 0, raw.b ?? 0, raw.sat ?? 0];
    const hasPos = Array.isArray(raw.pos) && raw.pos.length >= 3;
    const pos = hasPos ? raw.pos : [0, 0, 0];
    const priceUsd = Number.parseFloat(String(raw.price ?? 0)) || 0;
    const dateVal = Number(raw.date || (appid ? dates[appid] : 0) || 0) || 0;
    const hashSeed = ((i + 1) * 2654435761) >>> 0;

    out[i] = {
      idx: i,
      name,
      nameLower: name.toLowerCase(),
      ownedKey: kind === 'emoticons' ? normalizeEmoteOwnedKey(name) : normalizeBgOwnedKey(url),
      game,
      gameLower: game.toLowerCase(),
      url,
      appid,
      priceUsd,
      hue: Number(hls[0]) || 0,
      brightness: Number(hls[1]) || 0,
      saturation: Number(hls[2]) || 0,
      hasPos,
      sheet: hasPos ? (Number(pos[0]) || 0) : 0,
      col: hasPos ? (Number(pos[1]) || 0) : 0,
      row: hasPos ? (Number(pos[2]) || 0) : 0,
      date: dateVal,
      randomRank: hashSeed,
      img: String(raw.img || ''),
    };
  }

  return out;
}

export function rerollRandomRanks(items: GalleryItem[]): void {
  for (let i = 0; i < items.length; i += 1) {
    items[i].randomRank = Math.random();
  }
}

export function filterAndSortGallery(
  items: GalleryItem[],
  state: GalleryFilterState,
): GalleryItem[] {
  const q = state.query.trim().toLowerCase();
  const checkHue = state.hueMin > 0 || state.hueMax < 255;
  const checkBright = state.brightMin > 0 || state.brightMax < 255;
  const checkSat = state.satMin > 0 || state.satMax < 255;
  const checkPrice = state.priceCentsMin > 0 || state.priceCentsMax < 5000;
  const minUsd = state.priceCentsMin / 100;
  const maxUsd = state.priceCentsMax >= 5000 ? Number.POSITIVE_INFINITY : state.priceCentsMax / 100;
  const hasOwned = state.ownedSet.size > 0;

  const filtered: GalleryItem[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (q && !it.nameLower.includes(q) && !it.gameLower.includes(q) && it.appid !== q) {
      continue;
    }
    if (checkHue && (it.hue < state.hueMin || it.hue > state.hueMax)) continue;
    if (checkBright && (it.brightness < state.brightMin || it.brightness > state.brightMax)) continue;
    if (checkSat && (it.saturation < state.satMin || it.saturation > state.satMax)) continue;
    if (checkPrice && (it.priceUsd < minUsd || it.priceUsd > maxUsd)) continue;
    if (hasOwned && state.ownedMode !== 'all') {
      const isOwned = state.ownedSet.has(it.ownedKey) || state.ownedSet.has(it.nameLower);
      if (state.ownedMode === 'owned' && !isOwned) continue;
      if (state.ownedMode === 'unowned' && isOwned) continue;
    }
    filtered.push(it);
  }

  const dir = state.reversed ? -1 : 1;
  filtered.sort((a, b) => {
    let cmp = 0;
    switch (state.order) {
      case 'hue':
        cmp = a.hue - b.hue;
        break;
      case 'brightness':
        cmp = a.brightness - b.brightness;
        break;
      case 'saturation':
        cmp = a.saturation - b.saturation;
        break;
      case 'name':
        cmp = a.nameLower < b.nameLower ? -1 : (a.nameLower > b.nameLower ? 1 : 0);
        break;
      case 'game':
        cmp = a.gameLower < b.gameLower ? -1 : (a.gameLower > b.gameLower ? 1 : 0);
        break;
      case 'date':
        cmp = a.date - b.date;
        break;
      case 'price':
        cmp = a.priceUsd - b.priceUsd;
        break;
      case 'length':
        cmp = a.name.length - b.name.length;
        break;
      case 'random':
        cmp = a.randomRank - b.randomRank;
        break;
    }
    if (cmp !== 0) return cmp * dir;
    return a.idx - b.idx;
  });

  return filtered;
}

export function formatReleaseDate(epochSec: number): string {
  if (!epochSec || !Number.isFinite(epochSec)) return '—';
  const d = new Date(epochSec * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseHashFilter(hash: string): string {
  const h = String(hash || '');
  if (!h.startsWith('#/')) return '';
  try {
    return decodeURIComponent(h.slice(2));
  } catch {
    return h.slice(2);
  }
}

export function buildHashFilter(query: string): string {
  const q = query.trim();
  return q ? `#/${encodeURIComponent(q)}` : '#/';
}

export function buildSteamMarketUrl(marketUrlSlug: string): string {
  const slug = String(marketUrlSlug || '').replace(/^\/+/, '');
  return `https://steamcommunity.com/market/listings/${slug}`;
}

export function resolveBgLightboxImageUrl(
  rawValue: string,
  econBase: string,
  normalizeUrl: (u: string) => string,
): string {
  const val = String(rawValue || '').trim();
  if (!val) return '';
  if (val.startsWith('//')) {
    return normalizeUrl(`https:${val}`);
  }
  if (/^https?:\/\//i.test(val)) {
    return normalizeUrl(val);
  }
  return `${String(econBase || '').replace(/\/+$/, '')}/image/${val.replace(/^\/+/, '')}`;
}

export function getEmoteFallbackImgUrl(item: GalleryItem, econBase: string, small: boolean): string {
  const base = String(econBase || '').replace(/\/+$/, '');
  if (item.img) {
    return `${base}/image/${item.img.replace(/^\/+/, '')}/${small ? '18fx18f' : '64fx64f'}`;
  }
  const clean = normalizeEmoteOwnedKey(item.name);
  const rawName = String(item.name || '').trim().replace(/^:+|:+$/g, '') || clean;
  return `${base}/emoticon/${encodeURIComponent(rawName)}`;
}

export function getBgFallbackImgUrl(item: GalleryItem, econBase: string): string {
  if (!item.img) return '';
  const base = String(econBase || '').replace(/\/+$/, '');
  return `${base}/image/${item.img.replace(/^\/+/, '')}/256fx160f`;
}
