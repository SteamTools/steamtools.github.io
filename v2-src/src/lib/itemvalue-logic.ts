export interface AppMeta {
  appid: string;
  name: string;
  contextid: string;
  iconFile: string;
}

export const TOP_6_APPS_META: readonly AppMeta[] = [
  { appid: '753', name: 'Steam', contextid: '6', iconFile: '135dc1ac1cd9763dfc8ad52f4e880d2ac058a36c.jpg' },
  { appid: '730', name: 'Counter-Strike 2', contextid: '2', iconFile: 'd1159d1a4d0e18da4d74f85dbb4934d7a92ace2b.ico' },
  { appid: '440', name: 'Team Fortress 2', contextid: '2', iconFile: '033bdd91842b6aca0633ee1e5f3e6b82f2e8962f.ico' },
  { appid: '570', name: 'Dota 2', contextid: '2', iconFile: 'c0d15684e6c186289b50dfe083f5c562c57e8fb6.ico' },
  { appid: '252490', name: 'Rust', contextid: '2', iconFile: 'acf87ad23570b3c81f8c9cfc19544a07edd8b632.ico' },
  { appid: '322330', name: "Don't Starve Together", contextid: '1', iconFile: '5176d189ff929acc8d29a2e5f0466e18798db436.ico' },
];

export const APP_NAME_MAP: Record<string, string> = Object.fromEntries(
  TOP_6_APPS_META.map((a) => [a.appid, a.name]),
);

export function getAppIconUrl(appid: string): string {
  const meta = TOP_6_APPS_META.find((a) => a.appid === appid);
  if (!meta) return '';
  return `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${meta.appid}/${meta.iconFile}`;
}

export const ITEM_SUBTYPES_753 = ['all', 'emoticon', 'background', 'card', 'booster'] as const;
export type ItemSubtype753 = (typeof ITEM_SUBTYPES_753)[number];

export function netPriceAfterFee(priceUsd: number): number {
  const grossCents = Math.round((Number(priceUsd) || 0) * 100);
  if (grossCents <= 0) return 0;
  const steamFee = Math.max(1, Math.floor(grossCents / 11.5));
  const pubFee = Math.max(1, Math.floor(grossCents / 23));
  return Math.max(0, grossCents - steamFee - pubFee) / 100;
}

export const RARITY_SORT: Record<string, number> = {
  'Base Grade': 10,
  'Consumer Grade': 20,
  'Industrial Grade': 30,
  'Mil-Spec Grade': 40,
  'High Grade': 50,
  Restricted: 60,
  Remarkable: 70,
  Classified: 80,
  Exotic: 85,
  Covert: 90,
  Contraband: 95,
  Extraordinary: 99,
  Common: 10,
  Uncommon: 20,
  Rare: 30,
  Mythical: 40,
  Immortal: 50,
  Legendary: 60,
  Arcana: 70,
};

export const QUALITY_SORT: Record<string, Record<string, number>> = {
  '440': {
    Unique: 10,
    Vintage: 20,
    Strange: 30,
    Genuine: 40,
    Haunted: 50,
    'Decorated Weapon': 60,
    Unusual: 70,
  },
  '570': {
    Base: 5,
    Standard: 10,
    Inscribed: 20,
    Genuine: 30,
    Corrupted: 40,
    Frozen: 50,
    Exalted: 60,
    Heroic: 70,
    Elder: 80,
    Unusual: 90,
    Autographed: 100,
  },
};

export const QUALITY_SORT_ALL: Record<string, number> = {
  Base: 5,
  Standard: 10,
  Unique: 10,
  Vintage: 20,
  Inscribed: 20,
  Strange: 30,
  Genuine: 35,
  Corrupted: 40,
  Haunted: 50,
  Frozen: 50,
  'Decorated Weapon': 60,
  Exalted: 60,
  Heroic: 70,
  Elder: 80,
  Unusual: 85,
  Autographed: 100,
};

export type ItemColumnKey = 'image' | 'name' | 'game' | 'type' | 'quality' | 'rarity' | 'count' | 'price';

export const VIS_COLS_BY_APP: Record<string, readonly ItemColumnKey[]> = {
  '753': ['image', 'name', 'game', 'type', 'rarity', 'count', 'price'],
  '730': ['image', 'name', 'rarity', 'count', 'price'],
  '440': ['image', 'name', 'quality', 'count', 'price'],
  '570': ['image', 'name', 'quality', 'rarity', 'count', 'price'],
  '252490': ['image', 'name', 'count', 'price'],
  '322330': ['image', 'name', 'type', 'rarity', 'count', 'price'],
};

export interface RawInventoryItem {
  name?: string | null;
  market_hash_name?: string | null;
  quoted_key?: string | null;
  url?: string | null;
  icon?: string | null;
  price?: number | string | null;
  count?: number | string | null;
  color?: string | null;
  bg?: string | null;
  rarity?: string | null;
  rcolor?: string | null;
  quality?: string | null;
  qcolor?: string | null;
  game?: string | null;
  type?: string | null;
  marketable?: boolean;
}

export interface NormalizedInventoryItem {
  id: string;
  name: string;
  game: string;
  type: string;
  rarity: string;
  rcolor: string;
  quality: string;
  qcolor: string;
  color: string;
  bg: string;
  count: number;
  price: number;
  icon: string;
  marketUrl: string;
  searchHay: string;
}

export function sanitizeHexColor(color: unknown, fallback = 'D2D2D2'): string {
  if (typeof color === 'string' && /^[0-9A-Fa-f]{3,8}$/.test(color.trim())) {
    return color.trim();
  }
  return fallback;
}

export function sanitizeIconPath(rawIcon: unknown): string {
  return String(rawIcon ?? '').replace(/[^A-Za-z0-9_/.\-]/g, '');
}

export function buildSafeMarketUrl(rawUrl: unknown): string {
  const path = String(rawUrl ?? '')
    .split('/')
    .map((seg) => {
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join('/');
  return `https://steamcommunity.com/market/listings/${path}`;
}

export function normalizeInventoryItems(rawItems: RawInventoryItem[]): NormalizedInventoryItem[] {
  const out: NormalizedInventoryItem[] = [];
  for (let i = 0; i < rawItems.length; i += 1) {
    const it = rawItems[i];
    if (!it) continue;
    const name = String(it.name ?? '');
    const game = String(it.game ?? '');
    const type = String(it.type ?? '');
    const rarity = String(it.rarity ?? '');
    const quality = String(it.quality ?? '');
    const priceNum = Number.parseFloat(String(it.price ?? 0));
    const countNum = Math.max(0, Number(it.count) || 0);
    const marketUrl = buildSafeMarketUrl(it.url);
    out.push({
      id: `${i}:${it.quoted_key || it.url || name}`,
      name,
      game,
      type,
      rarity,
      rcolor: sanitizeHexColor(it.rcolor, '9CA3AF'),
      quality,
      qcolor: sanitizeHexColor(it.qcolor, 'D2D2D2'),
      color: sanitizeHexColor(it.color, 'D2D2D2'),
      bg: sanitizeHexColor(it.bg, '292929'),
      count: countNum,
      price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : 0,
      icon: sanitizeIconPath(it.icon),
      marketUrl,
      searchHay: `${name}\t${type}\t${game}\t${quality}\t${rarity}`.toLowerCase(),
    });
  }
  return out;
}

export interface ItemFilterSortOptions {
  appidLoaded: string;
  subtype: ItemSubtype753;
  dupesOnly: boolean;
  useFee: boolean;
  useStackPrice: boolean;
  query: string;
  sortKey: Exclude<ItemColumnKey, 'image'>;
  sortDir: 'asc' | 'desc';
}

const collator = typeof Intl !== 'undefined' && Intl.Collator
  ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  : null;

export function getDisplayUnitUsd(item: NormalizedInventoryItem, useFee: boolean): number {
  return useFee ? netPriceAfterFee(item.price) : item.price;
}

export function getDisplayRowUsd(
  item: NormalizedInventoryItem,
  useFee: boolean,
  useStackPrice: boolean,
): number {
  const unit = getDisplayUnitUsd(item, useFee);
  return useStackPrice ? unit * item.count : unit;
}

export function filterAndSortItems(
  items: NormalizedInventoryItem[],
  opts: ItemFilterSortOptions,
): { filtered: NormalizedInventoryItem[]; totalUsd: number; totalCount: number } {
  const qLower = opts.query.trim().toLowerCase();
  const filtered: NormalizedInventoryItem[] = [];
  let totalUsd = 0;
  let totalCount = 0;

  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (opts.dupesOnly && it.count <= 1) continue;
    if (opts.appidLoaded === '753' && opts.subtype !== 'all' && it.type !== opts.subtype) {
      continue;
    }
    if (qLower && it.searchHay.indexOf(qLower) === -1) {
      continue;
    }
    filtered.push(it);
    totalCount += it.count;
    if (it.price > 0 && it.count > 0) {
      totalUsd += getDisplayUnitUsd(it, opts.useFee) * it.count;
    }
  }

  const key = opts.sortKey;
  const mult = opts.sortDir === 'asc' ? 1 : -1;
  const appQualityMap = QUALITY_SORT[opts.appidLoaded] || QUALITY_SORT_ALL;

  filtered.sort((a, b) => {
    switch (key) {
      case 'price': {
        const av = getDisplayRowUsd(a, opts.useFee, opts.useStackPrice);
        const bv = getDisplayRowUsd(b, opts.useFee, opts.useStackPrice);
        return mult * (av - bv);
      }
      case 'count':
        return mult * (a.count - b.count);
      case 'quality': {
        const aq = appQualityMap[a.quality] ?? QUALITY_SORT_ALL[a.quality] ?? 0;
        const bq = appQualityMap[b.quality] ?? QUALITY_SORT_ALL[b.quality] ?? 0;
        if (aq !== bq) return mult * (aq - bq);
        return mult * (collator ? collator.compare(a.quality, b.quality) : 0);
      }
      case 'rarity': {
        const ar = RARITY_SORT[a.rarity] ?? 0;
        const br = RARITY_SORT[b.rarity] ?? 0;
        if (ar !== br) return mult * (ar - br);
        return mult * (collator ? collator.compare(a.rarity, b.rarity) : 0);
      }
      case 'name':
      case 'game':
      case 'type': {
        const cmp = collator
          ? collator.compare(a[key], b[key])
          : (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0);
        return mult * cmp;
      }
      default:
        return 0;
    }
  });

  return { filtered, totalUsd, totalCount };
}

function escapeCsvCell(val: unknown, escapeFormula?: (s: unknown) => string): string {
  const s = escapeFormula
    ? escapeFormula(val)
    : (/^[=+\-@\t\r]/.test(String(val ?? '')) ? `'${String(val ?? '')}` : String(val ?? ''));
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildInventoryCsv(
  items: NormalizedInventoryItem[],
  useFee: boolean,
  escapeFormula?: (s: unknown) => string,
): string {
  const lines = ['Name,Type,Count,Unit USD,Stack USD'];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const unit = getDisplayUnitUsd(it, useFee);
    lines.push([
      escapeCsvCell(it.name, escapeFormula),
      escapeCsvCell(it.type, escapeFormula),
      String(it.count),
      unit.toFixed(2),
      (unit * it.count).toFixed(2),
    ].join(','));
  }
  return lines.join('\n');
}
