'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeNextStoredScheme,
  resolveEffectiveScheme,
  resolveMetaSchemeContent,
} from '../v2-src/src/lib/theme-logic.ts';
import {
  formatDurationAge,
  formatIsoDate,
  normalizeForSearch,
} from '../v2-src/src/lib/normalize.ts';
import {
  applyUserToCardRows,
  buildCardSetRows,
  buildCardsExportText,
  clearUserFromCardRows,
  computeLevelCurve,
  DEFAULT_VISIBLE_COLS,
  filterAndSortCardRows,
  lookupTargetLevel,
  matchPastedGames,
} from '../v2-src/src/lib/cards-logic.ts';
import {
  buildInventoryCsv,
  filterAndSortItems,
  netPriceAfterFee,
  normalizeInventoryItems,
} from '../v2-src/src/lib/itemvalue-logic.ts';
import {
  buildHashFilter,
  filterAndSortGallery,
  getBgFallbackImgUrl,
  getEmoteFallbackImgUrl,
  normalizeGalleryItems,
  parseHashFilter,
  resolveBgLightboxImageUrl,
} from '../v2-src/src/lib/gallery-logic.ts';
import {
  computeIntersectedGames,
  decodeGameDataIntoMap,
  extractSteamIdentifier,
  parseOwnedAppsPayload,
} from '../v2-src/src/lib/games-logic.ts';
import {
  decodeBase64ToBytes42,
  encodeBytes42ToBase64,
  exportMosaicText,
  extractRegionBytes42,
  flipGridHorizontal,
  flipGridVertical,
  floodFillGrid,
  generateMosaicFromRgba,
  paintCircle,
  paintLine,
  paintRect,
  parseImportedMosaic,
  shiftGrid,
} from '../v2-src/src/lib/mosaticon-logic.ts';
import { parseRouteFromPathname } from '../v2-src/src/lib/route-logic.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

test('theme-logic follows dark-mode-toggle pin vs system revert rules', () => {
  // Start with OS = light, no override -> renders light
  assert.equal(resolveEffectiveScheme(null, false), 'light');
  assert.equal(resolveMetaSchemeContent(null), 'light dark');

  // 1. User toggles when OS is light -> pins dark
  const step1 = computeNextStoredScheme(null, false);
  assert.equal(step1, 'dark');
  assert.equal(resolveMetaSchemeContent(step1), 'dark');

  // 2. OS switches to dark while user pinned dark -> stays dark (kept in state)
  assert.equal(resolveEffectiveScheme(step1, true), 'dark');

  // 3. OS switches back to light while still pinned -> stays dark
  assert.equal(resolveEffectiveScheme(step1, false), 'dark');

  // 4. User toggles when OS is light -> target is light, matches OS -> clears override (null)
  const step4 = computeNextStoredScheme(step1, false);
  assert.equal(step4, null);
  assert.equal(resolveMetaSchemeContent(step4), 'light dark');

  // User toggles while OS is dark and stored was null -> pins light
  assert.equal(computeNextStoredScheme(null, true), 'light');
});

test('normalizeForSearch matches cards/normalize.js diacritic folding and date helpers', () => {
  assert.equal(normalizeForSearch('Æther Çč Éêèë Îïí Œ Öóõô Śš Üùú ß Ё'), 'aether cc eeee iii oe oooo ss uuu ss е');
  assert.equal(formatDurationAge(3720), '1h 2m');
  assert.equal(formatDurationAge(45), '45s');
  assert.equal(formatIsoDate(1700000000).length, 10);
});

test('cards-logic builds rows, applies user worth/diff math, sorts NaN last, and computes level curve', () => {
  const built = buildCardSetRows({
    time: 1700000000,
    data_median_age: 3600,
    game_count: 2,
    card_count: 10,
    emote_count: 4,
    bg_count: 4,
    sets: [
      {
        appid: '440',
        game: 'Team Fortress 2',
        true_count: 5,
        added: 1400000000,
        f2p: true,
        discount: '0.10',
        bprice: null,
        emotes_avg: '0.03',
        bgs_avg: '0.04',
        normal: { count: 5, price: '0.50', avg: '0.10', quantity: 100 },
        foil: { count: 5, price: '5.00', avg: '1.00', quantity: 10 },
      },
      {
        appid: '570',
        game: 'Dota 2',
        true_count: 8,
        added: 1450000000,
        f2p: false,
        discount: '0.20',
        bprice: '0.06',
        emotes_avg: '0.02',
        bgs_avg: '0.02',
        normal: { count: 8, price: '0.80', avg: '0.10', quantity: 80 },
        foil: null,
      },
    ],
  });

  assert.equal(built.rows.length, 3);
  assert.equal(built.nameToAppid['team fortress 2'], '440');

  const summary = applyUserToCardRows(
    built.rows,
    { '440': true },
    { '440': [5, 0] },
    { '440': [3, 2, 0, 0] },
  );
  assert.equal(summary.game_count, 1);
  assert.ok(Math.abs(summary.game_worth - 0.1) < 1e-9);
  assert.equal(summary.badge_count, 5);
  assert.ok(Math.abs(summary.badge_worth - 2.5) < 1e-9);
  assert.equal(summary.card_count, 3);
  assert.ok(Math.abs(summary.card_worth - 0.3 / 1.15) < 1e-9);
  assert.equal(summary.hasCompleteBadges, true);

  const tf2Normal = built.rows.find((r) => r.appid === '440' && !r.foil);
  assert.ok(tf2Normal);
  assert.ok(Math.abs(tf2Normal.price_diff - 0.3) < 1e-9);

  // NaN booster_eff / booster_avg sorts last in BOTH ascending and descending order
  const sortedAsc = filterAndSortCardRows(built.rows, {
    setType: { standard: true, foil: false },
    filters: {
      own_game: false, not_own_game: false, own_cards: false,
      hide_completed: false, hide_incompleted: false, hide_f2p: false, hide_nonf2p: false,
    },
    userLoaded: true,
    userData: { games: 3, cards: 3, badges: 3 },
    query: '',
    sortKey: 'booster_avg',
    sortDir: 'asc',
  });
  assert.equal(sortedAsc.map((r) => r.appid).join(','), '570,440');

  const sortedDesc = filterAndSortCardRows(built.rows, {
    setType: { standard: true, foil: false },
    filters: {
      own_game: false, not_own_game: false, own_cards: false,
      hide_completed: false, hide_incompleted: false, hide_f2p: false, hide_nonf2p: false,
    },
    userLoaded: true,
    userData: { games: 3, cards: 3, badges: 3 },
    query: '',
    sortKey: 'booster_avg',
    sortDir: 'desc',
  });
  assert.equal(sortedDesc.map((r) => r.appid).join(','), '570,440');

  // Greedy level curve
  clearUserFromCardRows(built.rows);
  const curve = computeLevelCurve(built.rows, 0);
  assert.ok(curve.maxLevel >= 1);
  const lvl1 = lookupTargetLevel(curve, 1);
  assert.ok(lvl1);
  assert.equal(lvl1.badges, 1);
  assert.ok(Math.abs(lvl1.cost - 0.5) < 1e-9);

  // Game list matcher & formula-safe CSV export
  const matched = matchPastedGames('Team Fortress 2\n570\nunknown', built.nameToAppid, built.appidToSet);
  assert.deepEqual(matched.appids, ['440', '570']);

  const formulaRows = buildCardSetRows({
    sets: [{
      appid: '999',
      game: '=CMD()',
      true_count: 5,
      added: 1700000000,
      f2p: false,
      discount: '0.10',
      bprice: null,
      emotes_avg: '0.01',
      bgs_avg: '0.01',
      normal: { count: 5, price: '0.50', avg: '0.10', quantity: 5 },
      foil: null,
    }],
  }).rows;
  const csv = buildCardsExportText(formulaRows, DEFAULT_VISIBLE_COLS, (n) => (Number.isFinite(n) ? n.toFixed(2) : 'N/A'), 'csv');
  assert.ok(csv.includes("'=CMD()"));
});

test('itemvalue-logic computes fee math, sorts rarity/quality, and escapes CSV formulas', () => {
  // 100 cents: steamFee = floor(100/11.5)=8, pubFee = floor(100/23)=4 -> 88 cents
  assert.equal(netPriceAfterFee(1.0), 0.88);
  // 3 cents minimum 1+1 fee -> 1 cent
  assert.equal(netPriceAfterFee(0.03), 0.01);

  const items = normalizeInventoryItems([
    { name: '=HYPERLINK("bad")', price: '1.00', count: 2, type: 'card', quality: 'Unique', rarity: 'Common', url: '753/1-card' },
    { name: 'Fancy Hat', price: '0.50', count: 1, type: 'hat', quality: 'Unusual', rarity: 'Covert', url: '440/hat' },
    { name: 'Cheap Emote', price: '0.10', count: 3, type: 'emoticon', url: '753/2-emote' },
  ]);

  const dupesFee = filterAndSortItems(items, {
    appidLoaded: '753',
    subtype: 'all',
    dupesOnly: true,
    useFee: true,
    useStackPrice: true,
    query: '',
    sortKey: 'price',
    sortDir: 'desc',
  });
  assert.equal(dupesFee.filtered.length, 2);
  assert.equal(dupesFee.totalCount, 5);

  const sortedQuality = filterAndSortItems(items, {
    appidLoaded: '440',
    subtype: 'all',
    dupesOnly: false,
    useFee: false,
    useStackPrice: false,
    query: '',
    sortKey: 'quality',
    sortDir: 'desc',
  });
  assert.equal(sortedQuality.filtered[0].name, 'Fancy Hat');

  const csv = buildInventoryCsv(dupesFee.filtered, true);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
});

test('router parses all 7 /v2/ subpaths cleanly', () => {
  assert.equal(parseRouteFromPathname('/v2/'), 'hub');
  assert.equal(parseRouteFromPathname('/v2'), 'hub');
  assert.equal(parseRouteFromPathname('/v2/cards/'), 'cards');
  assert.equal(parseRouteFromPathname('/v2/cards'), 'cards');
  assert.equal(parseRouteFromPathname('/v2/emoticons/'), 'emoticons');
  assert.equal(parseRouteFromPathname('/v2/emoticons'), 'emoticons');
  assert.equal(parseRouteFromPathname('/v2/backgrounds/'), 'backgrounds');
  assert.equal(parseRouteFromPathname('/v2/backgrounds/index.html'), 'backgrounds');
  assert.equal(parseRouteFromPathname('/v2/games/'), 'games');
  assert.equal(parseRouteFromPathname('/v2/mosaticon/'), 'mosaticon');
  assert.equal(parseRouteFromPathname('/v2/itemvalue/'), 'itemvalue');
  assert.equal(parseRouteFromPathname('/v2/itemvalue'), 'itemvalue');
});

test('gallery-logic normalizes v3 items, filters HLS/price/owned, and resolves lightbox URLs', () => {
  const items = normalizeGalleryItems(
    [
      { name: ':red:', game: 'Red Game', price: '0.15', url: '753/100-%3Ared%3A', hls: [10, 120, 220], pos: [0, 1, 2] },
      { name: ':blue:', game: 'Blue Game', price: '1.50', url: '753/200-%3Ablue%3A', hls: [170, 80, 190], pos: [1, 0, 0] },
    ],
    { '100': 1500000000, '200': 1700000000 },
    'emoticons',
  );
  assert.equal(items[0].appid, '100');
  assert.equal(items[0].date, 1500000000);
  assert.equal(items[0].ownedKey, 'red');

  const ownedSet = new Set(['blue']);
  const onlyOwned = filterAndSortGallery(items, {
    query: '',
    hueMin: 0,
    hueMax: 255,
    brightMin: 0,
    brightMax: 255,
    satMin: 0,
    satMax: 255,
    priceCentsMin: 0,
    priceCentsMax: 5000,
    ownedMode: 'owned',
    ownedSet,
    order: 'date',
    reversed: true,
  });
  assert.equal(onlyOwned.length, 1);
  assert.equal(onlyOwned[0].name, ':blue:');

  const redHue = filterAndSortGallery(items, {
    query: '',
    hueMin: 0,
    hueMax: 50,
    brightMin: 0,
    brightMax: 255,
    satMin: 0,
    satMax: 255,
    priceCentsMin: 0,
    priceCentsMax: 5000,
    ownedMode: 'all',
    ownedSet: new Set(),
    order: 'price',
    reversed: false,
  });
  assert.equal(redHue.length, 1);
  assert.equal(redHue[0].name, ':red:');

  assert.equal(parseHashFilter(buildHashFilter('space bg')), 'space bg');
  assert.equal(
    resolveBgLightboxImageUrl('abcHash123', 'https://econ.example', (u) => u),
    'https://econ.example/image/abcHash123',
  );

  const unpackedOnly = normalizeGalleryItems(
    [{ name: ':NewEmote:', game: 'New Game', price: '1.00', url: '753/999-%3ANewEmote%3A', hls: [10, 20, 30], img: 'hashImg1' }],
    {},
    'emoticons',
  );
  assert.equal(unpackedOnly[0].hasPos, false);
  assert.equal(getEmoteFallbackImgUrl(unpackedOnly[0], 'https://econ.example', false), 'https://econ.example/image/hashImg1/64fx64f');
  assert.equal(getEmoteFallbackImgUrl(unpackedOnly[0], 'https://econ.example', true), 'https://econ.example/image/hashImg1/18fx18f');
  assert.equal(getBgFallbackImgUrl(unpackedOnly[0], 'https://econ.example'), 'https://econ.example/image/hashImg1/256fx160f');
});

test('games-logic decodes v2 bitmasks, computes intersection, and filters tri-state flags', () => {
  assert.equal(extractSteamIdentifier('https://steamcommunity.com/profiles/76561197960287930/'), '76561197960287930');
  assert.equal(extractSteamIdentifier('https://steamcommunity.com/id/gabelogannewell'), 'gabelogannewell');

  const metaMap = new Map();
  decodeGameDataIntoMap(
    {
      v: 2,
      flags: ['singleplayer', 'multiplayer', 'coop', 'windows'],
      apps: {
        '440': ['Team Fortress 2', 0b1010], // multiplayer + windows
        '620': ['Portal 2', 0b1101], // singleplayer + coop + windows
        '570': ['Dota 2', 0b1010],
      },
    },
    metaMap,
  );
  assert.ok(metaMap.get('620')?.flagSet.has('coop'));

  const ownedA = parseOwnedAppsPayload({ games: ['440', '620'], apps: { '999': 'Extra' } });
  const ownedB = parseOwnedAppsPayload({ games: [{ appid: 620 }, { appid: 570 }] });
  const ownedByPlayer = new Map([
    ['A', new Set(ownedA.appIds)],
    ['B', new Set(ownedB.appIds)],
  ]);
  const players = [
    { steamid: 'A', name: 'Alice', avatar: '', selected: true, privateProfile: false, loaded: true },
    { steamid: 'B', name: 'Bob', avatar: '', selected: true, privateProfile: false, loaded: true },
  ];

  const rows = computeIntersectedGames({
    selectedPlayers: players,
    ownedByPlayer,
    metaMap,
    fallbackNames: new Map(),
    minOwners: 2,
    query: '',
    flagStates: { coop: 1, multiplayer: -1 },
    sortCol: 'name',
    sortDir: 'asc',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].appid, '620');
});

test('mosaticon-logic encodes colors, matches blocks via KdTree, draws, flips, and roundtrips text', () => {
  const redRgba = new Uint8ClampedArray(4 * 4 * 4);
  const blueRgba = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < 16; i += 1) {
    redRgba[i * 4] = 240;
    redRgba[i * 4 + 1] = 20;
    redRgba[i * 4 + 2] = 20;
    redRgba[i * 4 + 3] = 255;

    blueRgba[i * 4] = 20;
    blueRgba[i * 4 + 1] = 40;
    blueRgba[i * 4 + 2] = 240;
    blueRgba[i * 4 + 3] = 255;
  }

  const redBytes = extractRegionBytes42(redRgba, 4, 0, 0, 4, 4);
  const blueBytes = extractRegionBytes42(blueRgba, 4, 0, 0, 4, 4);
  const b64 = encodeBytes42ToBase64(redBytes);
  assert.deepEqual(decodeBase64ToBytes42(b64), redBytes);

  const palette = [
    { name: 'red', displayName: ':red:', bytes: redBytes },
    { name: 'blue', displayName: ':blue:', bytes: blueBytes },
  ];

  const mosaic = generateMosaicFromRgba({
    rgba: blueRgba,
    imgWidth: 4,
    imgHeight: 4,
    cols: 2,
    rows: 2,
    palette,
    quality: 2,
    mode: 'lab',
  });
  assert.deepEqual(mosaic, [':blue:', ':blue:', ':blue:', ':blue:']);

  const lined = paintLine(['', '', '', '', '', '', '', '', ''], 3, 3, 0, 0, 2, 2, ':red:');
  assert.equal(lined[0], ':red:');
  assert.equal(lined[4], ':red:');
  assert.equal(lined[8], ':red:');

  const rected = paintRect(new Array(9).fill(''), 3, 3, 0, 0, 2, 2, ':red:', false);
  assert.equal(rected[4], '');
  const filled = floodFillGrid(rected, 3, 3, 1, 1, ':blue:');
  assert.equal(filled[4], ':blue:');

  const circled = paintCircle(new Array(25).fill(''), 5, 5, 0, 0, 4, 4, ':red:', true);
  assert.equal(circled[12], ':red:');

  const shifted = shiftGrid(['A', '', '', ''], 2, 2, 1, 1);
  assert.deepEqual(shifted, ['', '', '', 'A']);
  assert.deepEqual(flipGridHorizontal(['A', 'B', 'C', 'D'], 2, 2), ['B', 'A', 'D', 'C']);
  assert.deepEqual(flipGridVertical(['A', 'B', 'C', 'D'], 2, 2), ['C', 'D', 'A', 'B']);

  const txt = exportMosaicText([':a:', '', ':b:', ':c:'], 2, 2, ':blank:');
  assert.equal(txt, ':a::blank:\n:b::c:');
  const imported = parseImportedMosaic('ːaːːbː\n:c::d:');
  assert.equal(imported.width, 2);
  assert.equal(imported.height, 2);
  assert.deepEqual(imported.cells, [':a:', ':b:', ':c:', ':d:']);
});

test('built v2 HTML entrypoints & assets preserve theme FOUC guard, noindex, shared UMD bridges, and compact size', () => {
  const routes = [
    ['v2/index.html', 'hub'],
    ['v2/cards/index.html', 'cards'],
    ['v2/emoticons/index.html', 'emoticons'],
    ['v2/backgrounds/index.html', 'backgrounds'],
    ['v2/games/index.html', 'games'],
    ['v2/mosaticon/index.html', 'mosaticon'],
    ['v2/itemvalue/index.html', 'itemvalue'],
  ];

  for (const [relPath, routeName] of routes) {
    const html = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    assert.ok(html.includes('<meta name="color-scheme" content="light dark">'), `${relPath} missing color-scheme meta`);
    assert.ok(html.includes('localStorage.getItem("color-scheme")'), `${relPath} missing FOUC inline script`);
    assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'), `${relPath} missing noindex meta`);
    assert.ok(html.includes(`data-initial-route="${routeName}"`), `${relPath} missing data-initial-route`);
    assert.ok(html.includes('src="/js/steamtools-config.js'), `${relPath} missing shared config script`);
    assert.ok(html.includes('src="/js/import-worker.js'), `${relPath} missing import worker script`);
    assert.ok(html.includes('src="/js/steamtools-import.js'), `${relPath} missing shared import script`);
    assert.ok(html.includes('href="/css/steamtools-import.css'), `${relPath} missing shared import css`);
  }

  const assetDir = path.join(REPO_ROOT, 'v2', 'assets');
  const assets = fs.readdirSync(assetDir);
  const jsBytes = assets
    .filter((f) => f.endsWith('.js'))
    .reduce((acc, f) => acc + fs.statSync(path.join(assetDir, f)).size, 0);
  const cssBytes = assets
    .filter((f) => f.endsWith('.css'))
    .reduce((acc, f) => acc + fs.statSync(path.join(assetDir, f)).size, 0);

  assert.ok(jsBytes > 0 && jsBytes < 450_000, `Expected compact split JS assets <450KB, got ${jsBytes}`);
  assert.ok(cssBytes > 0 && cssBytes < 80_000, `Expected compact CSS assets <80KB, got ${cssBytes}`);
});
