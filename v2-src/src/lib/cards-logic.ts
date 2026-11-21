import { formatIsoDate, normalizeForSearch } from './normalize.ts';

export interface RawSetSide {
  count: number;
  price: string | number;
  avg: string | number;
  std?: string | number;
  quantity: number;
}

export interface RawCardSetEntry {
  appid: string;
  game: string;
  true_count: number;
  added: number;
  f2p: boolean;
  discount: string | number;
  bprice: string | number | null;
  emotes_avg: string | number;
  bgs_avg: string | number;
  emotes_count?: number;
  bgs_count?: number;
  normal: RawSetSide | null;
  foil: RawSetSide | null;
}

export interface RawSetDataDoc {
  time?: number;
  data_median_age?: number;
  game_count?: number;
  card_count?: number;
  emote_count?: number;
  bg_count?: number;
  sets: RawSetSetLike[];
}

type RawSetSetLike = RawCardSetEntry;

export interface CardSetRow {
  id: string;
  appid: string;
  appidNum: number;
  game: string;
  baseGame: string;
  clean_game: string;
  count: number;
  price_set: number;
  price_avg: number;
  booster_avg: number;
  booster_eff: number;
  booster_url: string;
  emotes_avg: number;
  bgs_avg: number;
  qty_avg: number;
  discount: number;
  added: number;
  foil: boolean;
  f2p: boolean;
  game_owned: boolean;
  badge_lvl: number;
  cards_owned: number;
  unique_owned: number;
  price_diff: number;
}

export interface CardSetBuildResult {
  rows: CardSetRow[];
  nameToAppid: Record<string, string>;
  appidToSet: Record<string, RawCardSetEntry>;
  meta: {
    time: number;
    data_median_age: number;
    game_count: number;
    card_count: number;
    emote_count: number;
    bg_count: number;
  };
}

export type CardColumnKey =
  | 'game'
  | 'links'
  | 'cards_owned'
  | 'unique_owned'
  | 'count'
  | 'badge_lvl'
  | 'price_set'
  | 'price_diff'
  | 'price_avg'
  | 'booster_avg'
  | 'booster_eff'
  | 'emotes_avg'
  | 'bgs_avg'
  | 'qty_avg'
  | 'discount'
  | 'added'
  | 'appid';

export interface CardColumnDef {
  key: CardColumnKey;
  title: string;
  hint: string;
  type: 'text' | 'number' | 'none';
  defaultSortDir: 'asc' | 'desc';
  defaultVisible: boolean;
  requiresUser: boolean;
  width: number;
  align: 'left' | 'right' | 'center';
}

export const CARD_COLUMNS: readonly CardColumnDef[] = [
  { key: 'game', title: 'Game', hint: "Name of the set's game", type: 'text', defaultSortDir: 'asc', defaultVisible: true, requiresUser: false, width: 250, align: 'left' },
  { key: 'links', title: 'Links', hint: 'Useful links for the set ([B]adge, [S]tore, [M]arket, [E]xchange)', type: 'none', defaultSortDir: 'asc', defaultVisible: true, requiresUser: false, width: 108, align: 'center' },
  { key: 'cards_owned', title: '# Owned', hint: 'Number of cards you own for the set', type: 'number', defaultSortDir: 'desc', defaultVisible: false, requiresUser: true, width: 76, align: 'right' },
  { key: 'unique_owned', title: '# Unique', hint: 'Number of unique cards you own for the set', type: 'number', defaultSortDir: 'desc', defaultVisible: false, requiresUser: true, width: 76, align: 'right' },
  { key: 'count', title: '# Cards', hint: 'Number of cards in the set', type: 'number', defaultSortDir: 'desc', defaultVisible: true, requiresUser: false, width: 68, align: 'right' },
  { key: 'badge_lvl', title: 'Badge Lvl', hint: 'The level of your badge for the set', type: 'number', defaultSortDir: 'desc', defaultVisible: false, requiresUser: true, width: 80, align: 'right' },
  { key: 'price_set', title: 'Set Price', hint: 'The total price of all the cards for the set', type: 'number', defaultSortDir: 'asc', defaultVisible: true, requiresUser: false, width: 86, align: 'right' },
  { key: 'price_diff', title: 'Price Diff', hint: 'Difference between price of set and the cards you already own for it', type: 'number', defaultSortDir: 'asc', defaultVisible: false, requiresUser: true, width: 88, align: 'right' },
  { key: 'price_avg', title: 'Card Avg', hint: 'The average price of a card in the set', type: 'number', defaultSortDir: 'asc', defaultVisible: true, requiresUser: false, width: 84, align: 'right' },
  { key: 'booster_avg', title: 'Booster Avg', hint: "The average price of a card from the set's booster", type: 'number', defaultSortDir: 'asc', defaultVisible: false, requiresUser: false, width: 92, align: 'right' },
  { key: 'booster_eff', title: 'Booster %', hint: 'How many percent cheaper average booster cards are for the set', type: 'number', defaultSortDir: 'desc', defaultVisible: true, requiresUser: false, width: 88, align: 'right' },
  { key: 'emotes_avg', title: 'Emote Avg', hint: "The average price of the set's emoticons", type: 'number', defaultSortDir: 'asc', defaultVisible: false, requiresUser: false, width: 88, align: 'right' },
  { key: 'bgs_avg', title: 'BG Avg', hint: "The average price of the set's backgrounds", type: 'number', defaultSortDir: 'asc', defaultVisible: false, requiresUser: false, width: 84, align: 'right' },
  { key: 'qty_avg', title: 'Avg Qty', hint: 'The average quantity of items on the market', type: 'number', defaultSortDir: 'desc', defaultVisible: false, requiresUser: false, width: 78, align: 'right' },
  { key: 'discount', title: 'Discount', hint: 'The money you would make by selling all your drops for that game', type: 'number', defaultSortDir: 'asc', defaultVisible: true, requiresUser: false, width: 84, align: 'right' },
  { key: 'added', title: 'Added', hint: 'The date the set was added', type: 'number', defaultSortDir: 'desc', defaultVisible: true, requiresUser: false, width: 108, align: 'right' },
  { key: 'appid', title: 'AppId', hint: 'Steam Application ID', type: 'number', defaultSortDir: 'asc', defaultVisible: false, requiresUser: false, width: 78, align: 'right' },
];

export const DEFAULT_VISIBLE_COLS: Record<CardColumnKey, boolean> = Object.fromEntries(
  CARD_COLUMNS.map((c) => [c.key, c.defaultVisible]),
) as Record<CardColumnKey, boolean>;

export function buildBoosterUrl(baseGame: string, appid: string): string {
  const enc = encodeURIComponent(baseGame).replace(/'/g, '%27');
  return `https://steamcommunity.com/market/listings/753/${encodeURIComponent(appid)}-${enc}%20Booster%20Pack`;
}

export function buildCardSetRows(doc: RawSetDataDoc): CardSetBuildResult {
  const sets = Array.isArray(doc?.sets) ? doc.sets : [];
  const rows: CardSetRow[] = [];
  const nameToAppid: Record<string, string> = Object.create(null);
  const appidToSet: Record<string, RawCardSetEntry> = Object.create(null);

  const pushSide = (s: RawCardSetEntry, baseClean: string, isFoil: boolean) => {
    const side = isFoil ? s.foil : s.normal;
    if (!side) return;
    const priceSet = Number(side.price);
    const priceAvg = Number(side.avg);
    const boosterAvg = s.bprice === null || s.bprice === undefined ? Number.NaN : Number(s.bprice);
    const hasBooster = Number.isFinite(boosterAvg);
    const boosterEff = hasBooster && Number.isFinite(priceAvg)
      ? (priceAvg > 0 ? (priceAvg - boosterAvg) / priceAvg : 0)
      : Number.NaN;
    const trueCount = Math.max(1, Number(s.true_count) || Number(side.count) || 1);
    const appid = String(s.appid);

    rows.push({
      id: `${appid}:${isFoil ? '1' : '0'}`,
      appid,
      appidNum: Number(appid) || 0,
      game: isFoil ? `${s.game} (Foil)` : s.game,
      baseGame: s.game,
      clean_game: isFoil ? `${baseClean} foil` : baseClean,
      count: Number(s.true_count) || Number(side.count) || 0,
      price_set: priceSet,
      price_avg: priceAvg,
      booster_avg: boosterAvg,
      booster_eff: boosterEff,
      booster_url: hasBooster ? buildBoosterUrl(s.game, appid) : '',
      emotes_avg: Number(s.emotes_avg),
      bgs_avg: Number(s.bgs_avg),
      qty_avg: Math.ceil((Number(side.quantity) || 0) / trueCount),
      discount: Number(s.discount),
      added: Number(s.added) || 0,
      foil: isFoil,
      f2p: Boolean(s.f2p),
      game_owned: false,
      badge_lvl: 0,
      cards_owned: 0,
      unique_owned: 0,
      price_diff: priceSet,
    });
  };

  for (let i = 0; i < sets.length; i += 1) {
    const s = sets[i];
    if (!s || s.appid === undefined || s.appid === null) continue;
    const appid = String(s.appid);
    const baseClean = normalizeForSearch(s.game || '');
    nameToAppid[baseClean] = appid;
    appidToSet[appid] = s;
    if (s.normal !== null) pushSide(s, baseClean, false);
    if (s.foil !== null) pushSide(s, baseClean, true);
  }

  return {
    rows,
    nameToAppid,
    appidToSet,
    meta: {
      time: Number(doc?.time) || 0,
      data_median_age: Number(doc?.data_median_age) || 0,
      game_count: Number(doc?.game_count) || 0,
      card_count: Number(doc?.card_count) || 0,
      emote_count: Number(doc?.emote_count) || 0,
      bg_count: Number(doc?.bg_count) || 0,
    },
  };
}

export interface UserCardSummary {
  game_count: number;
  game_worth: number;
  card_count: number;
  card_worth: number;
  badge_count: number;
  badge_worth: number;
  badge_unique: number;
  hasCompleteBadges: boolean;
}

export function applyUserToCardRows(
  rows: CardSetRow[],
  userGames: Record<string, boolean>,
  userBadges: Record<string, [number, number]>,
  userCards: Record<string, [number, number, number, number]>,
): UserCardSummary {
  let game_count = 0;
  let game_worth = 0;
  let card_count = 0;
  let card_worth = 0;
  let badge_count = 0;
  let badge_worth = 0;
  let badge_unique = 0;
  let hasCompleteBadges = false;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const appid = row.appid;

    if (userGames[appid] === true) {
      row.game_owned = true;
      if (!row.foil) {
        game_count += 1;
        if (Number.isFinite(row.discount)) {
          game_worth += row.discount;
        }
      }
    } else {
      row.game_owned = false;
    }

    if (Object.prototype.hasOwnProperty.call(userBadges, appid)) {
      const ind = row.foil ? 1 : 0;
      row.badge_lvl = Number(userBadges[appid][ind]) || 0;
      if (row.badge_lvl === 5 || (row.foil && row.badge_lvl > 0)) {
        hasCompleteBadges = true;
      }
      badge_count += row.badge_lvl;
      if (row.badge_lvl > 0) badge_unique += 1;
      if (Number.isFinite(row.price_set)) {
        badge_worth += row.price_set * row.badge_lvl;
      }
    } else {
      row.badge_lvl = 0;
    }

    if (Object.prototype.hasOwnProperty.call(userCards, appid)) {
      const ind = row.foil ? 2 : 0;
      row.cards_owned = Number(userCards[appid][ind]) || 0;
      row.unique_owned = Number(userCards[appid][ind + 1]) || 0;
      card_count += row.cards_owned;
      const safeSet = Number.isFinite(row.price_set) ? row.price_set : 0;
      const safeAvg = Number.isFinite(row.price_avg) ? row.price_avg : 0;
      row.price_diff = Math.max(safeSet - safeAvg * row.unique_owned, 0);
      card_worth += safeAvg * row.cards_owned;
    } else {
      row.cards_owned = 0;
      row.unique_owned = 0;
      row.price_diff = row.price_set;
    }
  }

  return {
    game_count,
    game_worth,
    card_count,
    card_worth: card_worth / 1.15,
    badge_count,
    badge_worth,
    badge_unique,
    hasCompleteBadges,
  };
}

export function clearUserFromCardRows(rows: CardSetRow[]): void {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    row.game_owned = false;
    row.badge_lvl = 0;
    row.cards_owned = 0;
    row.unique_owned = 0;
    row.price_diff = row.price_set;
  }
}

export interface SetTypeFilter {
  standard: boolean;
  foil: boolean;
}

export interface CardFilters {
  own_game: boolean;
  not_own_game: boolean;
  own_cards: boolean;
  hide_completed: boolean;
  hide_incompleted: boolean;
  hide_f2p: boolean;
  hide_nonf2p: boolean;
}

export interface UserDataAvailability {
  games: number;
  cards: number;
  badges: number;
}

export interface CardFilterSortOptions {
  setType: SetTypeFilter;
  filters: CardFilters;
  userLoaded: boolean;
  userData: UserDataAvailability;
  query: string;
  sortKey: CardColumnKey;
  sortDir: 'asc' | 'desc';
}

const collator = typeof Intl !== 'undefined' && Intl.Collator
  ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  : null;

function compareNumbersNaNLast(a: number, b: number, dir: 'asc' | 'desc'): number {
  const aValid = Number.isFinite(a);
  const bValid = Number.isFinite(b);
  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;
  return dir === 'asc' ? a - b : b - a;
}

export function filterAndSortCardRows(rows: CardSetRow[], opts: CardFilterSortOptions): CardSetRow[] {
  const st = opts.setType;
  const f = opts.filters;
  const qNorm = normalizeForSearch(opts.query.trim());
  const out: CardSetRow[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.foil && !st.foil) continue;
    if (!row.foil && !st.standard) continue;
    if (row.f2p && f.hide_f2p) continue;
    if (!row.f2p && f.hide_nonf2p) continue;

    if (opts.userLoaded) {
      if (opts.userData.games === 3 && f.own_game && !row.game_owned) continue;
      if (opts.userData.games === 3 && f.not_own_game && row.game_owned) continue;
      if (opts.userData.cards === 3 && f.own_cards && row.cards_owned === 0) continue;
      if (opts.userData.badges === 3 && f.hide_completed) {
        if (!row.foil && row.badge_lvl === 5) continue;
        if (row.foil && row.badge_lvl > 0) continue;
      }
      if (opts.userData.badges === 3 && f.hide_incompleted) {
        if (!row.foil && row.badge_lvl < 5) continue;
        if (row.foil && row.badge_lvl === 0) continue;
      }
    }

    if (qNorm && row.clean_game.indexOf(qNorm) === -1 && row.appid.indexOf(qNorm) === -1) {
      continue;
    }
    out.push(row);
  }

  const key = opts.sortKey;
  const dir = opts.sortDir;
  if (key === 'links') return out;

  out.sort((a, b) => {
    if (key === 'game') {
      const cmp = collator ? collator.compare(a.game, b.game) : (a.game < b.game ? -1 : a.game > b.game ? 1 : 0);
      return dir === 'asc' ? cmp : -cmp;
    }
    if (key === 'appid') {
      return compareNumbersNaNLast(a.appidNum, b.appidNum, dir);
    }
    const av = a[key] as number;
    const bv = b[key] as number;
    return compareNumbersNaNLast(av, bv, dir);
  });

  return out;
}

export interface SetLinks {
  badge: string;
  store: string;
  market: string;
  exchange: string;
}

export function generateSetLinks(appid: string, isFoil: boolean, steamid64?: string | null): SetLinks {
  const safeApp = encodeURIComponent(String(appid));
  const sid = String(steamid64 || '').trim();
  const profile = /^\d{17}$/.test(sid) ? `profiles/${sid}` : 'my';
  const badge = `https://steamcommunity.com/${profile}/gamecards/${safeApp}${isFoil ? '?border=1' : ''}`;
  const store = `https://store.steampowered.com/app/${safeApp}`;
  const market =
    `https://steamcommunity.com/market/search?category_753_Game%5B%5D=tag_app_${safeApp}` +
    `&category_753_cardborder%5B%5D=tag_cardborder_${isFoil ? 1 : 0}` +
    `&category_753_item_class%5B%5D=tag_item_class_2&appid=753`;
  const exchange = `https://steam.cards/index.php?gamepage-appid-${safeApp}`;
  return { badge, store, market, exchange };
}

export interface LevelPoint {
  level: number;
  cost: number;
  badges: number;
}

export interface LevelCurveResult {
  startLevel: number;
  maxLevel: number;
  points: LevelPoint[];
}

export function computeLevelCurve(rows: CardSetRow[], rawStartLevel: number): LevelCurveResult {
  const startLevel = Number.isFinite(rawStartLevel) ? Math.max(0, Math.floor(rawStartLevel)) : 0;
  const setPrices: number[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const price = Number(row.price_set);
    if (!Number.isFinite(price) || price <= 0) continue;
    const cap = row.foil ? 1 : 5;
    const rem = Math.max(0, cap - (row.badge_lvl || 0));
    for (let j = 0; j < rem; j += 1) {
      setPrices.push(price);
    }
  }

  setPrices.sort((a, b) => b - a);

  const points: LevelPoint[] = [];
  let total = 0;
  let badges = 0;
  let level = startLevel + 1;

  while (true) {
    const needed = Math.ceil(level / 10);
    if (!Number.isFinite(needed) || needed <= 0 || needed > setPrices.length) break;
    for (let i = 0; i < needed; i += 1) {
      total += setPrices.pop() as number;
    }
    badges += needed;
    points.push({
      level,
      cost: Math.max(0.01, Math.round(total * 100) / 100),
      badges,
    });
    level += 1;
  }

  return {
    startLevel,
    maxLevel: points.length > 0 ? points[points.length - 1].level : startLevel,
    points,
  };
}

export function lookupTargetLevel(curve: LevelCurveResult, targetLevel: number): LevelPoint | null {
  if (!Number.isFinite(targetLevel)) return null;
  const target = Math.floor(targetLevel);
  if (target <= curve.startLevel || target > curve.maxLevel) return null;
  const idx = target - (curve.startLevel + 1);
  return curve.points[idx] ?? null;
}

export function matchPastedGames(
  inputText: string,
  nameToAppid: Record<string, string>,
  appidToSet: Record<string, RawCardSetEntry>,
): { appids: string[]; names: string[] } {
  const lines = String(inputText || '').split(/\r?\n/);
  const appids: string[] = [];
  const names: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i += 1) {
    const norm = normalizeForSearch(lines[i].trim());
    if (!norm) continue;
    let matched: string | null = null;
    if (Object.prototype.hasOwnProperty.call(nameToAppid, norm)) {
      matched = nameToAppid[norm];
    } else if (Object.prototype.hasOwnProperty.call(appidToSet, norm)) {
      matched = norm;
    }
    if (matched && !seen.has(matched)) {
      seen.add(matched);
      appids.push(matched);
      names.push(appidToSet[matched].game);
    }
  }

  return { appids, names };
}

function escapeCsvField(str: unknown, escapeFormula?: (s: unknown) => string): string {
  const safe = escapeFormula
    ? escapeFormula(str)
    : (/^[=+\-@\t\r]/.test(String(str ?? '')) ? `'${String(str ?? '')}` : String(str ?? ''));
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

const CSV_EXPORT_COLS: readonly CardColumnKey[] = [
  'game', 'cards_owned', 'unique_owned', 'count', 'badge_lvl',
  'price_set', 'price_diff', 'price_avg', 'booster_avg', 'booster_eff',
  'emotes_avg', 'bgs_avg', 'qty_avg', 'discount', 'added', 'appid',
];

export function buildCardsExportText(
  rows: CardSetRow[],
  visibleCols: Record<CardColumnKey, boolean>,
  formatPriceNoSymbol: (usd: number) => string,
  mode: 'csv' | 'tsv',
  escapeFormula?: (s: unknown) => string,
): string {
  const colKeys: CardColumnKey[] = mode === 'csv'
    ? [...CSV_EXPORT_COLS]
    : CARD_COLUMNS.filter((c) => c.key !== 'links' && visibleCols[c.key]).map((c) => c.key);

  const titleByKey = Object.fromEntries(CARD_COLUMNS.map((c) => [c.key, c.title])) as Record<CardColumnKey, string>;
  const sep = mode === 'csv' ? ',' : '\t';
  const formatCell = (val: string) => (mode === 'csv' ? escapeCsvField(val, escapeFormula) : val.replace(/[\t\r\n]+/g, ' '));

  const lines: string[] = [colKeys.map((k) => formatCell(titleByKey[k])).join(sep)];

  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const cells = colKeys.map((k) => {
      let raw = '';
      switch (k) {
        case 'game':
          raw = r.game;
          break;
        case 'appid':
          raw = r.appid;
          break;
        case 'cards_owned':
          raw = String(r.cards_owned);
          break;
        case 'unique_owned':
          raw = String(r.unique_owned);
          break;
        case 'count':
          raw = String(r.count);
          break;
        case 'badge_lvl':
          raw = String(r.badge_lvl);
          break;
        case 'qty_avg':
          raw = String(r.qty_avg);
          break;
        case 'booster_eff':
          raw = Number.isFinite(r.booster_eff) ? (r.booster_eff * 100).toFixed(1) : 'N/A';
          break;
        case 'added':
          raw = formatIsoDate(r.added);
          break;
        case 'price_set':
        case 'price_diff':
        case 'price_avg':
        case 'booster_avg':
        case 'emotes_avg':
        case 'bgs_avg':
        case 'discount':
          raw = formatPriceNoSymbol(r[k]);
          break;
        default:
          raw = '';
      }
      return formatCell(raw);
    });
    lines.push(cells.join(sep));
  }

  return lines.join('\n');
}
