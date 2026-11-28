'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

function listFirstPartyJsFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'tests') {
      continue;
    }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      listFirstPartyJsFiles(full, out);
    } else if (ent.isFile() && ent.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function createMockEnv() {
  const sStore = new Map();
  const lStore = new Map();
  global.location = { hostname: 'steam.tools', protocol: 'https:', search: '' };
  global.sessionStorage = {
    getItem: (k) => (sStore.has(k) ? sStore.get(k) : null),
    setItem: (k, v) => sStore.set(k, String(v)),
    removeItem: (k) => sStore.delete(k)
  };
  global.localStorage = {
    getItem: (k) => (lStore.has(k) ? lStore.get(k) : null),
    setItem: (k, v) => lStore.set(k, String(v)),
    removeItem: (k) => lStore.delete(k)
  };
  global.document = { cookie: '' };
  Object.defineProperty(global, 'navigator', {
    value: { userAgent: 'Mozilla/5.0' },
    configurable: true
  });
  global.window = global;
  const CFG = require('../js/steamtools-config.js');
  const W = require('../js/import-worker.js');
  global.SteamToolsImportWorker = W;
  const IMP = require('../js/steamtools-import.js');
  CFG.refresh();
  return { CFG, W, IMP, sStore, lStore };
}

test('all JS files pass node --check syntax validation', () => {
  const jsFiles = listFirstPartyJsFiles(REPO_ROOT);
  assert.ok(jsFiles.length >= 9, `Expected >= 9 JS files, found ${jsFiles.length}`);
  for (const file of jsFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
});

test('quoteSteamKey and fnv1a32Hex2 match Python parity vectors', () => {
  const { W } = createMockEnv();
  assert.strictEqual(
    W.quoteSteamKey("AK-47 | Redline (Field-Tested) ★!*'()"),
    'AK-47%20%7C%20Redline%20%28Field-Tested%29%20%E2%98%85%21%2A%27%28%29'
  );
  assert.strictEqual(W.quoteSteamKey('580-Test~Emote_1'), '580-Test%7EEmote_1');
  assert.strictEqual(W.fnv1a32(''), 0x811c9dc5);
  assert.strictEqual(W.fnv1a32Hex2('753001-Sample%20Card').length, 2);
  assert.strictEqual(W.fnv1a32Hex64('Mann%20Co.%20Supply%20Crate%20Key').length, 2);
  assert.strictEqual(
    W.fnv1a32Hex64('753/440-Dustbowl'),
    require('../js/steamtools-config.js').fnv1a32Hex64('753/440-Dustbowl')
  );
  assert.ok(parseInt(W.fnv1a32Hex64('test'), 16) < 64);
});

test('parseInventoryPayload stacks amounts, deduplicates assetids, and disambiguates 753 backgrounds', () => {
  const { W } = createMockEnv();
  const empty = W.parseInventoryPayload('[]', { mode: 'emotes' });
  assert.strictEqual(empty.kind, 'emoticon_list');
  assert.strictEqual(empty.isEmptyArray, true);
  assert.deepStrictEqual(empty.emoticons, []);

  const payload = {
    success: 1,
    assets: [
      { assetid: 'a1', classid: 'c1', instanceid: '0', amount: '2' },
      { assetid: 'a1', classid: 'c1', instanceid: '0', amount: '99' },
      { assetid: 'a2', classid: 'c1', instanceid: '0', amount: '3' },
      { assetid: 'a3', classid: 'c2', instanceid: '0', amount: '1' },
      { assetid: 'a4', classid: 'c3', instanceid: '0', amount: '5' }
    ],
    descriptions: [
      {
        classid: 'c1',
        instanceid: '0',
        marketable: 1,
        name: 'Winter Forest',
        type: 'Profile Background',
        market_hash_name: '100-Winter Forest',
        tags: [{ category: 'item_class', internal_name: 'item_class_3', localized_tag_name: 'Profile Background' }]
      },
      {
        classid: 'c2',
        instanceid: '0',
        marketable: 1,
        name: 'Winter Forest',
        type: 'Profile Background',
        market_hash_name: '200-Winter Forest',
        tags: [{ category: 'item_class', internal_name: 'item_class_3', localized_tag_name: 'Profile Background' }]
      },
      {
        classid: 'c3',
        instanceid: '0',
        marketable: 1,
        name: ':steamhappy:',
        type: 'Emoticon',
        market_hash_name: '753-steamhappy',
        tags: [{ category: 'item_class', internal_name: 'item_class_4', localized_tag_name: 'Emoticon' }]
      }
    ]
  };
  const parsed = W.parseInventoryPayload(payload, { appid: '753' });
  assert.strictEqual(parsed.items.length, 3);
  assert.strictEqual(parsed.items.find((i) => i.quoted_key === '100-Winter%20Forest').count, 5);
  assert.deepStrictEqual(parsed.background_urls, ['753/100-Winter%20Forest', '753/200-Winter%20Forest']);
  assert.deepStrictEqual(parsed.emoticons, ['steamhappy']);
});

test('CFG manifest caching, API failover, CSV formula escaping, and gallery v2 unpack', async () => {
  const { CFG, W, IMP, sStore } = createMockEnv();
  assert.strictEqual(CFG.escapeCsvFormula('=SUM(A1)'), "'=SUM(A1)");
  assert.strictEqual(CFG.escapeCsvFormula('+1'), "'+1");
  assert.strictEqual(CFG.escapeCsvFormula('Normal'), 'Normal');

  const manifest = {
    version: 1,
    datasets: {
      'data/emote_v2.json': { path: 'v/deadbeef/data/emote_v2.json', v_key: 'v/deadbeef/data/emote_v2.json' }
    }
  };
  const resolved = await CFG.resolveDatasetUrl('data/emote_v2.json', {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => manifest })
  });
  assert.strictEqual(resolved, 'https://cdn.steam.tools/v/deadbeef/data/emote_v2.json');

  sStore.set('st_api_primary', 'https://api.steam.tools');
  const res = await CFG.httpRequestWithFailover(
    async (reqCfg) => {
      if (reqCfg.url.startsWith('https://api.steam.tools/')) {
        throw { status: 503, data: {} };
      }
      return { status: 200, data: { success: true } };
    },
    '/UserInfo?id=123',
    { method: 'GET' }
  );
  assert.strictEqual(res.status, 200);
  assert.strictEqual(sStore.get('st_api_primary'), 'https://api2.steam.tools');

  const unpacked = CFG.unpackGalleryV2({
    v: 2,
    games: ['Test Game'],
    items: [[':smile:', '0.05', 0, '440-%3Asmile%3A', null, [10, 20, 30], 'hash1']]
  });
  assert.deepStrictEqual(unpacked, [
    { name: ':smile:', price: '0.05', game: 'Test Game', url: '753/440-%3Asmile%3A', hls: [10, 20, 30], img: 'hash1' }
  ]);

  const qk = W.quoteSteamKey('Card 1');
  const hx = W.fnv1a32Hex2(qk);
  const priced = await IMP.priceServerItemValuePayload(
    [{ market_hash_name: 'Card 1', count: 2, marketable: true }, { market_hash_name: 'Unpriced', count: 1 }],
    '753',
    {
      config: CFG,
      fetchImpl: async (url) => {
        if (url.endsWith('/manifest.json')) return { ok: false, status: 404, json: async () => ({}) };
        if (url.endsWith('/value/753/' + hx + '.json')) return { ok: true, status: 200, json: async () => ({ [qk]: 45 }) };
        return { ok: true, status: 200, json: async () => ({ x: 1 }) };
      }
    }
  );
  assert.strictEqual(priced.items.length, 1);
  assert.strictEqual(priced.items[0].price, 0.45);

  // 440 sharded valuation fetches value/440/<hex64>.json and falls back to value/440.json only on 404.
  IMP.clearPriceCache();
  const qk440 = W.quoteSteamKey('Mann Co. Supply Crate Key');
  const hx440 = W.fnv1a32Hex64(qk440);
  const priced440 = await IMP.priceServerItemValuePayload(
    [{ market_hash_name: 'Mann Co. Supply Crate Key', count: 2, marketable: true }],
    '440',
    {
      config: CFG,
      fetchImpl: async (url) => {
        if (url.endsWith('/manifest.json')) return { ok: false, status: 404, json: async () => ({}) };
        if (url.endsWith('/value/440/' + hx440 + '.json')) return { ok: true, status: 200, json: async () => ({ [qk440]: 215 }) };
        throw new Error('Unexpected fetch ' + url);
      }
    }
  );
  assert.strictEqual(priced440.items[0].price, 2.15);
  assert.strictEqual(priced440.usedBucketFallback, false);

  IMP.clearPriceCache();
  const priced440Fallback = await IMP.priceServerItemValuePayload(
    [{ market_hash_name: 'Mann Co. Supply Crate Key', count: 1, marketable: true }],
    '440',
    {
      config: CFG,
      fetchImpl: async (url) => {
        if (url.endsWith('/manifest.json')) return { ok: false, status: 404, json: async () => ({}) };
        if (url.endsWith('/value/440/' + hx440 + '.json')) return { ok: false, status: 404, json: async () => ({}) };
        if (url.endsWith('/value/440.json')) return { ok: true, status: 200, json: async () => ({ [qk440]: 220 }) };
        throw new Error('Unexpected fetch ' + url);
      }
    }
  );
  assert.strictEqual(priced440Fallback.items[0].price, 2.2);
  assert.strictEqual(priced440Fallback.usedBucketFallback, true);
});

test('Angular ng-app and ng-controller match main JS modules across all v1 apps', () => {
  const apps = [
    ['v1/backgrounds/index.html', 'v1/backgrounds/main.js'],
    ['v1/cards/index.html', 'v1/cards/main.js'],
    ['v1/emoticons/index.html', 'v1/emoticons/main.js'],
    ['v1/games/index.html', 'v1/games/steam.js'],
    ['v1/itemvalue/index.html', 'v1/itemvalue/main.js'],
    ['v1/mosaticon/index.html', 'v1/mosaticon/main.js']
  ];
  for (const [htmlRel, jsRel] of apps) {
    const html = fs.readFileSync(path.join(REPO_ROOT, htmlRel), 'utf8');
    const js = fs.readFileSync(path.join(REPO_ROOT, jsRel), 'utf8');
    const appMatch = /\bng-app=(["'])([A-Za-z0-9_.-]+)\1/.exec(html);
    const ctrlMatch = /\bng-controller=(["'])([A-Za-z0-9_.-]+)\1/.exec(html);
    assert.ok(appMatch, `${htmlRel} missing ng-app`);
    assert.ok(ctrlMatch, `${htmlRel} missing ng-controller`);
    const modMatches = Array.from(js.matchAll(/angular\.module\(\s*(['"])([A-Za-z0-9_.-]+)\1/g));
    assert.strictEqual(
      modMatches.length,
      1,
      `${jsRel} should declare exactly 1 angular.module, found ${modMatches.length}`
    );
    assert.strictEqual(
      modMatches[0][2],
      appMatch[2],
      `${jsRel} angular.module('${modMatches[0][2]}') must match ${htmlRel} ng-app="${appMatch[2]}"`
    );
    const ctrlDeclared =
      js.includes(`.controller('${ctrlMatch[2]}'`) ||
      js.includes(`.controller("${ctrlMatch[2]}"`) ||
      new RegExp(`function\\s+${ctrlMatch[2]}\\s*\\(`).test(js);
    assert.ok(ctrlDeclared, `${jsRel} missing controller ${ctrlMatch[2]}`);
  }
});

test('bookmarklet stays under 2 KB and supports standalone tabs and /inventory/ paths', () => {
  const { IMP } = createMockEnv();
  for (const opts of [
    { appid: '753', contextid: '6' },
    { appid: '730', contextid: '2', lockApp: false }
  ]) {
    const code = IMP.buildBookmarkletCode(opts);
    const href = IMP.buildBookmarkletHref(opts);
    assert.ok(href.startsWith('javascript:'), 'bookmarklet href must start with javascript:');
    assert.ok(href.length < 2048, `Expected bookmarklet href < 2048 bytes (lockApp=${opts.lockApp}), got ${href.length}`);
    assert.ok(!code.includes('Launch from SteamTools Import first.'), 'bookmarklet should work in standalone tabs');
    assert.ok(code.includes('navigator.clipboard.writeText') && code.includes('Blob('), 'standalone fallback must offer copy + save');
    assert.ok(code.includes('pathname.split'), 'bookmarklet should extract SteamID64 from /profiles/ or /inventory/ paths');
    assert.ok(code.includes('50k cap'), 'bookmarklet should flag partial 25-page 50k cap');
    new Function(code);
  }
});

test('classifySteamIdPaste and attachSteamIdPasteGuard block JSON/oversized pastes without mutating input', () => {
  const { CFG } = createMockEnv();
  assert.deepStrictEqual(CFG.classifySteamIdPaste('76561197976086060'), { block: false, isJson: false });
  assert.deepStrictEqual(CFG.classifySteamIdPaste('ehsankia'), { block: false, isJson: false });
  assert.deepStrictEqual(CFG.classifySteamIdPaste('https://steamcommunity.com/id/ehsankia/'), { block: false, isJson: false });
  assert.deepStrictEqual(CFG.classifySteamIdPaste('  {"assets":[],"descriptions":[]}'), { block: true, isJson: true });
  assert.deepStrictEqual(CFG.classifySteamIdPaste('\uFEFF[{"name":"steamhappy"}]'), { block: true, isJson: true });
  assert.deepStrictEqual(CFG.classifySteamIdPaste('x'.repeat(600)), { block: true, isJson: false });

  const attrs = {};
  const listeners = {};
  const fakeInput = {
    getAttribute: (k) => attrs[k] || null,
    setAttribute: (k, v) => { attrs[k] = String(v); },
    addEventListener: (ev, fn) => { listeners[ev] = fn; }
  };
  let pastedJson = '';
  let oversizedCount = 0;
  CFG.attachSteamIdPasteGuard(fakeInput, {
    onJsonPaste: (t) => { pastedJson = t; },
    onOversizedPaste: () => { oversizedCount++; }
  });
  assert.strictEqual(attrs.maxlength, '256');
  assert.strictEqual(typeof listeners.paste, 'function');

  let preventedJson = false;
  listeners.paste({
    clipboardData: { getData: () => '{"assets":[1]}' },
    preventDefault: () => { preventedJson = true; }
  });
  assert.strictEqual(preventedJson, true);
  assert.strictEqual(pastedJson, '{"assets":[1]}');

  let preventedShort = false;
  listeners.paste({
    clipboardData: { getData: () => 'ehsankia' },
    preventDefault: () => { preventedShort = true; }
  });
  assert.strictEqual(preventedShort, false);

  let preventedLong = false;
  listeners.paste({
    clipboardData: { getData: () => 'a'.repeat(700) },
    preventDefault: () => { preventedLong = true; }
  });
  assert.strictEqual(preventedLong, true);
  assert.strictEqual(oversizedCount, 1);
});

test('Wave 2 unpackGalleryV3, unpackSetDataV2, unpackItemValueV2, shards manifest SWR, and slim_pages', async () => {
  const { CFG, W, lStore } = createMockEnv();

  // 1. unpackGalleryV3 parity + sha8 mismatch rejection
  const catV3 = {
    v: 3,
    sha8: 'abcd1234',
    games: [['440', 'TF2'], ['570', 'Dota 2']],
    dates: { '440': 1400000000 },
    items: [
      [':hi:', 0, 0, [1, 2, 3], (12 << 16) | (34 << 8) | 56],
      ['Nebula', 1, 1, [4, 5, 6], (78 << 16) | (90 << 8) | 123],
      [':dup:', 0, 2, null, (1 << 16) | (2 << 8) | 3, 'imghash']
    ]
  };
  const pxV3 = { v: 3, sha8: 'abcd1234', p: [12, 150, null] };
  const unpackedV3 = CFG.unpackGalleryV3(catV3, pxV3);
  assert.deepStrictEqual(unpackedV3.dates, { '440': 1400000000 });
  assert.deepStrictEqual(unpackedV3.items[0], {
    name: ':hi:',
    price: '0.12',
    game: 'TF2',
    url: '753/440-%3Ahi%3A',
    hls: [12, 34, 56],
    pos: [1, 2, 3]
  });
  assert.strictEqual(unpackedV3.items[1].url, '753/570-Nebula%20%28Profile%20Background%29');
  assert.strictEqual(unpackedV3.items[2].url, '753/440-%3Adup%3A%20%28Emoticon%29');
  assert.strictEqual(unpackedV3.items[2].price, null);
  assert.strictEqual(unpackedV3.items[2].img, 'imghash');
  assert.strictEqual(CFG.unpackGalleryV3(catV3, { v: 3, sha8: 'different', p: [12, 150, null] }), null);

  // 2. unpackSetDataV2 parity
  const unpackedSd = CFG.unpackSetDataV2({
    v: 2,
    time: 123,
    data_median_age: 45,
    game_count: 1,
    card_count: 5,
    emote_count: 2,
    bg_count: 1,
    totals: { normal: '1.00', foil: '5.00', combined: '10.00' },
    rows: [[440, 'TF2', 5, 1400000000, 1, 10, 8, 5, 10, 2, 1, [5, 100, 20, 2, 99], null]]
  });
  assert.strictEqual(unpackedSd.sets[0].appid, '440');
  assert.strictEqual(unpackedSd.sets[0].f2p, true);
  assert.strictEqual(unpackedSd.sets[0].bprice, '0.08');
  assert.strictEqual(unpackedSd.sets[0].normal.price, '1.00');
  assert.strictEqual(unpackedSd.sets[0].foil, null);

  // 3. unpackItemValueV2 parity
  const ivItems = CFG.unpackItemValueV2({
    v: 2,
    appid: '753',
    strings: ['292929', 'D2D2D2', 'TF2', 'card'],
    rows: [['Card A', '440-Card A', 'ico1', 2, 45, 1, 0, 1, -1, -1, -1, -1, 2, 3]]
  });
  assert.strictEqual(ivItems.length, 1);
  assert.strictEqual(ivItems[0].quoted_key, '440-Card%20A');
  assert.strictEqual(ivItems[0].url, '753/440-Card%20A');
  assert.strictEqual(ivItems[0].price, '0.45');
  assert.strictEqual(ivItems[0].bucket, CFG.fnv1a32Hex256('440-Card%20A'));

  // 4. Compact shards manifest resolution + localStorage SWR
  const arr64 = new Array(64).fill('');
  arr64[10] = 'deadbeef';
  let manifestFetches = 0;
  const resolvedUrl = await CFG.resolveDatasetUrl('data/emote_colors/0a.json', {
    forceRefresh: true,
    cdnBase: 'https://cdn.example',
    fetchImpl: async () => {
      manifestFetches++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          version: 1,
          shards: { 'data/emote_colors': arr64 },
          datasets: {}
        })
      };
    }
  });
  assert.strictEqual(resolvedUrl, 'https://cdn.example/v/deadbeef/data/emote_colors/0a.json');
  assert.strictEqual(manifestFetches, 1);
  assert.ok(lStore.has('st_manifest_v2:https://cdn.example'));

  // 5. slimSteamPageForStorage lossless parity
  const rawPage = {
    success: 1,
    total_inventory_count: 1,
    assets: [{ assetid: '10', classid: '20', instanceid: '0', amount: '2', contextid: '6' }],
    descriptions: [{
      appid: 753,
      classid: '20',
      instanceid: '0',
      marketable: 1,
      name: ':cool:',
      market_hash_name: '440-:cool:',
      icon_url: 'ico',
      descriptions: [{ value: '<p>Huge bloat HTML lore</p>' }],
      actions: [{ link: 'https://example.com', name: 'Inspect' }],
      tags: [{ category: 'item_class', localized_tag_name: 'Emoticon' }, { category: 'Game', localized_tag_name: 'TF2' }]
    }]
  };
  const origParsed = W.parseInventoryPayload([rawPage], { appid: '753' });
  const slimmedParsed = W.parseInventoryPayload(origParsed.slim_pages, { appid: '753' });
  assert.strictEqual(origParsed.slim_pages[0].descriptions[0].descriptions, undefined);
  assert.strictEqual(origParsed.slim_pages[0].descriptions[0].actions, undefined);
  assert.deepStrictEqual(slimmedParsed.items, origParsed.items);
  assert.deepStrictEqual(slimmedParsed.emoticons, origParsed.emoticons);
});

test('import-worker gives actionable validation errors and deduplicates repeated pages', () => {
  const { W } = createMockEnv();

  assert.throws(() => W.parseInventoryPayload('null', { appid: '753' }), /Steam returned "null".*steamcommunity\.com/i);
  assert.throws(() => W.parseInventoryPayload('<!DOCTYPE html><html><title>Sign In</title></html>', { appid: '753' }), /Sign-In web page/i);
  assert.throws(() => W.parseInventoryPayload('<html><body><div>Inventory</div></body></html>', { appid: '753' }), /Steam web page \(HTML\)/i);
  assert.throws(() => W.parseInventoryPayload('success: 1\nassets:\n  0:\n    assetid: "1"', { appid: '753' }), /Firefox.*Raw Data/i);

  const page1 = {
    success: 1,
    total_inventory_count: 2,
    more_items: 1,
    last_assetid: '101',
    assets: [{ assetid: '101', classid: 'c1', instanceid: '0', amount: '1' }],
    descriptions: [{
      appid: 753,
      classid: 'c1',
      instanceid: '0',
      marketable: 1,
      name: 'Alpha Card',
      type: 'Trading Card',
      market_hash_name: '440-Alpha Card',
      tags: [
        { category: 'item_class', internal_name: 'item_class_2', localized_tag_name: 'Trading Card' },
        { category: 'Game', internal_name: 'app_440', localized_tag_name: 'TF2' },
        { category: 'cardborder', internal_name: 'cardborder_0', localized_tag_name: 'Normal' }
      ]
    }]
  };
  const page2 = {
    success: 1,
    total_inventory_count: 2,
    more_items: 0,
    assets: [{ assetid: '102', classid: 'c2', instanceid: '0', amount: '1' }],
    descriptions: [{
      appid: 753,
      classid: 'c2',
      instanceid: '0',
      marketable: 1,
      name: 'Beta Card',
      type: 'Trading Card',
      market_hash_name: '570-Beta Card',
      tags: [
        { category: 'item_class', internal_name: 'item_class_2', localized_tag_name: 'Trading Card' },
        { category: 'Game', internal_name: 'app_570', localized_tag_name: 'Dota 2' },
        { category: 'cardborder', internal_name: 'cardborder_0', localized_tag_name: 'Normal' }
      ]
    }]
  };

  const duped = W.parseInventoryPayload([page1, page1], { appid: '753', mode: 'cards' });
  assert.strictEqual(duped.page_count, 1);
  assert.strictEqual(duped.duplicate_pages_ignored, 1);
  assert.strictEqual(duped.asset_count, 1);
  assert.strictEqual(duped.slim_pages.length, 1);
  assert.strictEqual(duped.card_set_count, 1);

  const distinct = W.parseInventoryPayload([page1, page2], { appid: '753', mode: 'cards' });
  assert.strictEqual(distinct.page_count, 2);
  assert.strictEqual(distinct.duplicate_pages_ignored, 0);
  assert.strictEqual(distinct.asset_count, 2);
  assert.strictEqual(distinct.card_set_count, 2);
});

function createMiniDomEnv() {
  function StubClassList(el) {
    this._el = el;
    this._set = new Set();
  }
  StubClassList.prototype = {
    _sync(str) {
      this._set = new Set(String(str || '').trim().split(/\s+/).filter(Boolean));
    },
    add(...names) {
      for (const n of names) if (n) this._set.add(n);
      this._el._attrs.class = Array.from(this._set).join(' ');
    },
    remove(...names) {
      for (const n of names) this._set.delete(n);
      this._el._attrs.class = Array.from(this._set).join(' ');
    },
    contains(n) {
      return this._set.has(n);
    }
  };

  function StubElement(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this._attrs = Object.create(null);
    this._listeners = Object.create(null);
    this.style = {};
    this.classList = new StubClassList(this);
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.value = '';
    this.returnValue = '';
    this.files = [];
    this.rows = 0;
    this._text = '';
  }
  Object.defineProperty(StubElement.prototype, 'id', {
    get() { return this._attrs.id || ''; },
    set(v) { this._attrs.id = String(v); }
  });
  Object.defineProperty(StubElement.prototype, 'className', {
    get() { return this._attrs.class || ''; },
    set(v) {
      this._attrs.class = String(v);
      this.classList._sync(v);
    }
  });
  Object.defineProperty(StubElement.prototype, 'href', {
    get() { return this._attrs.href || ''; },
    set(v) { this._attrs.href = String(v); }
  });
  Object.defineProperty(StubElement.prototype, 'textContent', {
    get() { return this._text; },
    set(v) { this._text = String(v === null || v === undefined ? '' : v); }
  });
  Object.defineProperty(StubElement.prototype, 'options', {
    get() { return this.children.filter((c) => c.tagName === 'OPTION'); }
  });
  StubElement.prototype.appendChild = function (child) {
    if (child.parentNode) {
      const idx = child.parentNode.children.indexOf(child);
      if (idx !== -1) child.parentNode.children.splice(idx, 1);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  };
  StubElement.prototype.setAttribute = function (k, v) {
    const lk = String(k).toLowerCase();
    this._attrs[lk] = String(v);
    if (lk === 'class') this.classList._sync(v);
    if (lk === 'value') this.value = String(v);
    if (lk === 'hidden') this.hidden = true;
    if (lk === 'disabled') this.disabled = true;
  };
  StubElement.prototype.getAttribute = function (k) {
    const lk = String(k).toLowerCase();
    return Object.prototype.hasOwnProperty.call(this._attrs, lk) ? this._attrs[lk] : null;
  };
  StubElement.prototype.removeAttribute = function (k) {
    const lk = String(k).toLowerCase();
    delete this._attrs[lk];
    if (lk === 'hidden') this.hidden = false;
    if (lk === 'disabled') this.disabled = false;
  };
  StubElement.prototype.addEventListener = function (type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  };
  StubElement.prototype.dispatchEvent = function (ev) {
    ev.target = ev.target || this;
    ev.preventDefault = ev.preventDefault || (() => { ev.defaultPrevented = true; });
    const list = this._listeners[ev.type] || [];
    for (const fn of list) fn.call(this, ev);
  };
  StubElement.prototype.click = function () {
    this.dispatchEvent({ type: 'click', button: 0 });
  };
  StubElement.prototype.focus = function () {
    doc.activeElement = this;
  };
  StubElement.prototype.showModal = function () {
    this.open = true;
  };
  StubElement.prototype.close = function (rv) {
    if (rv !== undefined) this.returnValue = String(rv);
    this.open = false;
    this.dispatchEvent({ type: 'close' });
  };
  StubElement.prototype.querySelectorAll = function (sel) {
    const out = [];
    const wantId = sel.startsWith('#') ? sel.slice(1) : null;
    const wantClass = sel.startsWith('.') ? sel.slice(1) : null;
    (function walk(node) {
      for (const ch of node.children) {
        if ((wantId && ch.id === wantId) || (wantClass && ch.classList.contains(wantClass))) {
          out.push(ch);
        }
        walk(ch);
      }
    })(this);
    return out;
  };
  StubElement.prototype.querySelector = function (sel) {
    return this.querySelectorAll(sel)[0] || null;
  };
  Object.defineProperty(StubElement.prototype, 'innerHTML', {
    get() { return ''; },
    set(html) {
      this.children = [];
      const stack = [this];
      const tagRe = /<\/?([A-Za-z0-9-]+)([^>]*)>/g;
      const voidTags = new Set(['input', 'br', 'hr', 'img', 'meta', 'link']);
      let m;
      while ((m = tagRe.exec(String(html))) !== null) {
        const full = m[0];
        const tag = m[1].toLowerCase();
        const attrText = m[2] || '';
        if (full.startsWith('</')) {
          if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === tag) {
            stack.pop();
          }
          continue;
        }
        const el = new StubElement(tag);
        const attrRe = /([A-Za-z0-9:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s/>]+)))?/g;
        let am;
        while ((am = attrRe.exec(attrText)) !== null) {
          el.setAttribute(am[1], am[2] ?? am[3] ?? am[4] ?? '');
        }
        stack[stack.length - 1].appendChild(el);
        if (!voidTags.has(tag) && !full.endsWith('/>')) {
          stack.push(el);
        }
      }
    }
  });

  const body = new StubElement('body');
  const winListeners = Object.create(null);
  const openedUrls = [];
  const doc = {
    cookie: '',
    body,
    activeElement: null,
    createElement: (t) => new StubElement(t),
    addEventListener: () => {}
  };
  const base = createMockEnv();
  global.document = doc;
  global.HTMLDialogElement = function () {};
  global.open = (url) => {
    openedUrls.push(String(url));
    return { closed: false, document: { body: { style: {} } }, location: {}, close: () => {} };
  };
  let coarsePointer = false;
  global.matchMedia = () => ({ matches: coarsePointer });
  global.addEventListener = (type, fn) => {
    if (!winListeners[type]) winListeners[type] = [];
    winListeners[type].push(fn);
  };
  Object.defineProperty(global, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0',
      clipboard: { writeText: () => Promise.resolve() }
    },
    configurable: true
  });
  delete require.cache[require.resolve('../js/steamtools-import.js')];
  const IMP = require('../js/steamtools-import.js');
  return {
    ...base,
    IMP,
    doc,
    openedUrls,
    setCoarsePointer: (v) => { coarsePointer = Boolean(v); },
    getDialog: () => doc.body.querySelector('#st-import-dialog')
  };
}

test('openImportDialog Option B: zero-ID emotes, allowEmptyEmotes, deterministic raw link, multi-page append after restore, and method memory', async () => {
  const env = createMiniDomEnv();
  const { IMP, doc, openedUrls, lStore } = env;

  // 1. Emotes mode: 0-ID EmoticonList fast path + allowEmptyEmotes enabling Apply on []
  let importedResult = null;
  IMP.openImportDialog({
    mode: 'emotes',
    appid: '753',
    contextid: '6',
    allowEmptyEmotes: true,
    onImport: (res) => { importedResult = res; }
  });
  const dlg = env.getDialog();
  assert.ok(dlg && dlg.open, 'dialog should open');
  assert.strictEqual(dlg.querySelector('#st-emote-fast-section').hidden, false);
  assert.strictEqual(dlg.querySelector('#st-paste-step-num').textContent, '2');
  assert.strictEqual(doc.activeElement.id, 'st-open-emotelist-btn');

  dlg.querySelector('#st-open-emotelist-btn').click();
  assert.strictEqual(openedUrls[openedUrls.length - 1], 'https://steamcommunity.com/actions/EmoticonList');

  dlg.dispatchEvent({
    type: 'paste',
    target: dlg,
    clipboardData: { getData: () => '[]' }
  });
  await new Promise((r) => setTimeout(r, 10));
  const applyBtn = dlg.querySelector('#st-apply-btn');
  assert.strictEqual(applyBtn.disabled, false);
  assert.strictEqual(applyBtn.textContent, 'Load 6 Default Steam Emotes');
  applyBtn.click();
  assert.ok(importedResult && importedResult.isEmptyArray);
  assert.strictEqual(dlg.returnValue, '', 'dialog close listener must reset returnValue');

  // 2. Backgrounds mode: deterministic Raw JSON button & accessible aria-invalid/describedby
  IMP.openImportDialog({ mode: 'backgrounds', appid: '753', contextid: '6' });
  const sidInput = dlg.querySelector('#st-import-steamid');
  const rawBtn = dlg.querySelector('#st-open-steam-inv-btn');
  assert.strictEqual(sidInput.getAttribute('aria-invalid'), 'false');
  assert.ok(!(sidInput.getAttribute('aria-describedby') || '').includes('st-import-steamid-err'));
  assert.strictEqual(rawBtn.disabled, true, 'Raw JSON button must stay disabled when SteamID is empty');

  sidInput.value = '76561197976086060';
  sidInput.dispatchEvent({ type: 'input' });
  assert.strictEqual(rawBtn.disabled, false);
  assert.strictEqual(dlg.querySelector('#st-resolved-chip').hidden, false);
  rawBtn.click();
  assert.strictEqual(
    openedUrls[openedUrls.length - 1],
    'https://steamcommunity.com/inventory/76561197976086060/753/6?l=english&count=2000'
  );

  // Wrong app (CS2 730) should block Backgrounds Apply
  dlg.dispatchEvent({
    type: 'paste',
    target: dlg,
    clipboardData: {
      getData: () => JSON.stringify({
        success: 1,
        assets: [{ assetid: '1', classid: 'c1', instanceid: '0', amount: '1', appid: 730 }],
        descriptions: [{ appid: 730, classid: 'c1', instanceid: '0', name: 'AK-47', market_hash_name: 'AK-47', marketable: 1 }]
      })
    }
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(applyBtn.disabled, true);
  dlg.close('cancel');

  // 3. Restored multi-page session MUST append Page 2 rather than overwriting Page 1, and pass steamid64 back
  const sid = '76561197976086060';
  const scopeKey = 'cards:753:6:' + sid;
  const page1 = {
    success: 1,
    total_inventory_count: 2,
    more_items: 1,
    last_assetid: '101',
    assets: [{ assetid: '101', classid: 'c1', instanceid: '0', amount: '1' }],
    descriptions: [{
      appid: 753, classid: 'c1', instanceid: '0', marketable: 1, name: 'Card 1', type: 'Trading Card',
      market_hash_name: '440-Card 1',
      tags: [
        { category: 'item_class', internal_name: 'item_class_2', localized_tag_name: 'Trading Card' },
        { category: 'Game', internal_name: 'app_440', localized_tag_name: 'TF2' },
        { category: 'cardborder', internal_name: 'cardborder_0', localized_tag_name: 'Normal' }
      ]
    }]
  };
  const page2 = {
    success: 1,
    total_inventory_count: 2,
    more_items: 0,
    assets: [{ assetid: '102', classid: 'c2', instanceid: '0', amount: '1' }],
    descriptions: [{
      appid: 753, classid: 'c2', instanceid: '0', marketable: 1, name: 'Card 2', type: 'Trading Card',
      market_hash_name: '570-Card 2',
      tags: [
        { category: 'item_class', internal_name: 'item_class_2', localized_tag_name: 'Trading Card' },
        { category: 'Game', internal_name: 'app_570', localized_tag_name: 'Dota 2' },
        { category: 'cardborder', internal_name: 'cardborder_0', localized_tag_name: 'Normal' }
      ]
    }]
  };
  await IMP.saveImportSession({ scopeKey, rawPages: [page1], steamId: sid, updatedAt: Date.now() });

  let multiResult = null;
  IMP.openImportDialog({
    mode: 'cards',
    appid: '753',
    contextid: '6',
    steamId: sid,
    onImport: (res) => { multiResult = res; }
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(dlg.querySelector('#st-wizard-next-btn').disabled, false);

  dlg.dispatchEvent({
    type: 'paste',
    target: dlg,
    clipboardData: { getData: () => JSON.stringify(page2) }
  });
  await new Promise((r) => setTimeout(r, 20));
  applyBtn.click();
  assert.strictEqual(multiResult.page_count, 2, 'Page 2 must append to restored Page 1 instead of overwriting');
  assert.strictEqual(multiResult.asset_count, 2);
  assert.strictEqual(multiResult.steamid64, sid);

  // 4. Method memory & copy-button rule: copy never disables button; bookmarklet remembered on desktop, paste on mobile
  lStore.set('st_import_method', 'bookmarklet');
  env.setCoarsePointer(false);
  IMP.openImportDialog({ mode: 'itemvalue', appid: '730', lockApp: false });
  assert.strictEqual(dlg.querySelector('#st-tab-bookmarklet').getAttribute('aria-selected'), 'true');
  const copyBmBtn = dlg.querySelector('#st-copy-bm-btn');
  copyBmBtn.click();
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(copyBmBtn.disabled, false, 'copy button must never disable while showing feedback');
  dlg.close('cancel');

  env.setCoarsePointer(true);
  IMP.openImportDialog({ mode: 'itemvalue', appid: '730', lockApp: false });
  assert.strictEqual(dlg.querySelector('#st-tab-paste').getAttribute('aria-selected'), 'true');
  dlg.close('cancel');
});

test('CFG.track enforces host gate, event allowlist, field sanitization, and per-page cap', () => {
  const { CFG } = createMockEnv();
  const sent = [];
  const captureSend = (url, body) => sent.push({ url, data: JSON.parse(body) });

  // Disallowed off steam.tools unless _force is true
  global.location = { hostname: 'localhost', pathname: '/v2/cards/', protocol: 'http:', search: '' };
  assert.strictEqual(CFG.track('v2_route', { _sendImpl: captureSend }), false);
  assert.strictEqual(sent.length, 0);

  // Unknown event rejected even with _force
  assert.strictEqual(CFG.track('unknown_event_name', { _force: true, _sendImpl: captureSend }), false);
  assert.strictEqual(sent.length, 0);

  // Valid event sanitizes fields and auto-detects v2/app
  assert.strictEqual(
    CFG.track('import_ok', {
      _force: true,
      a: 'Item Value!! / VeryLongFieldName_1234567890_abcdefghijklmnopqrstuvwxyz',
      b: 'bookmarklet?x=1',
      n: 4.8,
      scheme: 'dark',
      _sendImpl: captureSend
    }),
    true
  );
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].url, '/t');
  assert.deepStrictEqual(sent[0].data, {
    e: 'import_ok',
    ver: 'v2',
    app: 'cards',
    a: 'itemvalueveryLongFieldName_1234567890_abcdefghij'.toLowerCase(),
    b: 'bookmarkletx1',
    scheme: 'dark',
    n: 5
  });

  // Reset via refresh and verify 30-event per-page cap on steam.tools
  global.location = { hostname: 'steam.tools', pathname: '/itemvalue/', protocol: 'https:', search: '' };
  CFG.refresh();
  const capped = [];
  for (let i = 0; i < 35; i++) {
    CFG.track('export', { a: 'csv', _sendImpl: (u, b) => capped.push(b) });
  }
  assert.strictEqual(capped.length, 30);
});

test('all classic v1 tool pages include a Try v2 link to their matching root route and noindex', () => {
  const routes = [
    ['v1/itemvalue/index.html', '/itemvalue/'],
    ['v1/cards/index.html', '/cards/'],
    ['v1/mosaticon/index.html', '/mosaticon/'],
    ['v1/emoticons/index.html', '/emoticons/'],
    ['v1/backgrounds/index.html', '/backgrounds/'],
    ['v1/games/index.html', '/games/']
  ];
  for (const [relHtml, expectedHref] of routes) {
    const html = fs.readFileSync(path.join(REPO_ROOT, relHtml), 'utf8');
    assert.ok(html.includes('class="topbutton st-v2-link"'), `${relHtml} missing .st-v2-link`);
    assert.ok(html.includes(`href="${expectedHref}"`), `${relHtml} missing href="${expectedHref}"`);
    assert.ok(html.includes('noindex'), `${relHtml} should be noindex under /v1/`);
  }
});

test('all v1 tool pages and v2 Hub point Donate links to Ko-fi without legacy PayPal links', () => {
  const donateFiles = [
    'v2-src/src/components/AppShell.svelte',
    'v1/itemvalue/index.html',
    'v1/cards/index.html',
    'v1/mosaticon/index.html',
    'v1/emoticons/index.html',
    'v1/backgrounds/index.html',
    'v1/games/index.html',
  ];
  for (const relPath of donateFiles) {
    const content = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    assert.ok(content.includes('href="https://ko-fi.com/ehsankia"'), `${relPath} missing Ko-fi donate link`);
    assert.ok(!content.includes('paypal.com/donate'), `${relPath} still contains legacy PayPal link`);
  }
});

test('Sentry setup discloses usage in privacy policy and restricts tracePropagationTargets away from API/CDN hosts', () => {
  const privacyHtml = fs.readFileSync(path.join(REPO_ROOT, 'privacy.html'), 'utf8');
  assert.ok(
    privacyHtml.includes('https://sentry.io/privacy/'),
    'privacy.html must disclose Sentry error monitoring and feedback'
  );

  const sentryTs = fs.readFileSync(path.join(REPO_ROOT, 'v2-src/src/lib/diag-client.ts'), 'utf8');
  assert.ok(sentryTs.includes("SENTRY_TUNNEL_PATH = '/e'"), 'diag-client.ts must define /e tunnel path');
  assert.ok(
    sentryTs.includes('tunnel: prod ? SENTRY_TUNNEL_PATH : undefined'),
    'diag-client.ts must enable first-party /e tunnel on prod hosts',
  );
  assert.ok(sentryTs.includes('tracePropagationTargets'), 'diag-client.ts must configure tracePropagationTargets');
  assert.ok(!sentryTs.includes("tracePropagationTargets: ['*'"), 'tracePropagationTargets must not wildcard all hosts');
  assert.ok(sentryTs.includes('dataCollection'), 'diag-client.ts must configure dataCollection privacy controls');
});
