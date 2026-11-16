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
});

test('Angular ng-app and ng-controller match main JS modules across all apps', () => {
  const apps = [
    ['backgrounds/index.html', 'backgrounds/main.js'],
    ['cards/index.html', 'cards/main.js'],
    ['emoticons/index.html', 'emoticons/main.js'],
    ['games/index.html', 'games/steam.js'],
    ['itemvalue/index.html', 'itemvalue/main.js'],
    ['mosaticon/index.html', 'mosaticon/main.js']
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
  const code = IMP.buildBookmarkletCode({ appid: '753', contextid: '6' });
  const href = IMP.buildBookmarkletHref({ appid: '753', contextid: '6' });
  assert.ok(href.startsWith('javascript:'), 'bookmarklet href must start with javascript:');
  assert.ok(href.length < 2048, `Expected bookmarklet href < 2048 bytes, got ${href.length}`);
  assert.ok(!code.includes('Launch from SteamTools Import first.'), 'bookmarklet should work in standalone tabs');
  assert.ok(code.includes('navigator.clipboard.writeText') && code.includes('Blob('), 'standalone fallback must offer copy + save');
  assert.ok(code.includes('pathname.split'), 'bookmarklet should extract SteamID64 from /profiles/ or /inventory/ paths');
  new Function(code);
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
