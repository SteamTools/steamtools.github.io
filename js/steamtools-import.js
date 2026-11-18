(function (root, factory) {
  var workerMod = (root && root.SteamToolsImportWorker) ||
    (typeof require === 'function' ? require('./import-worker.js') : null);
  var configMod = (root && root.STEAMTOOLS_CONFIG) ||
    (typeof require === 'function' ? require('./steamtools-config.js') : null);
  var api = factory(root, workerMod, configMod);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SteamToolsImport = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, workerMod, configMod) {
  'use strict';

  var WORKER_SCRIPT_URL = null;
  (function detectCurrentScriptUrl() {
    try {
      if (root && root.document && root.document.currentScript && root.document.currentScript.src) {
        WORKER_SCRIPT_URL = root.document.currentScript.src.replace(/steamtools-import\.js(\?.*)?$/i, 'import-worker.js$1');
      }
    } catch (e) {
      // Ignore in non-DOM environments
    }
  })();

  function getConfig() {
    return (root && root.STEAMTOOLS_CONFIG) || configMod || {
      CDN_BASE: 'https://cdn.steam.tools',
      USE_753_BUCKETS: true,
      getContextId: function (appid) {
        var k = String(appid || '');
        if (k === '753') return '6';
        if (k === '322330') return '1';
        return '2';
      }
    };
  }

  function getAllowedOpenerOrigin(overrideOrigin) {
    var candidate = overrideOrigin ||
      (root && root.location && root.location.origin ? root.location.origin : '');
    if (typeof candidate !== 'string' || !candidate) {
      return 'https://steam.tools';
    }
    try {
      var u = new URL(candidate);
      var host = u.hostname.toLowerCase();
      if (u.protocol === 'https:' && (host === 'steam.tools' || host === 'www.steam.tools')) {
        return u.origin;
      }
      if (u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1')) {
        return u.origin;
      }
    } catch (e) {
      // Fall back to canonical production origin
    }
    return 'https://steam.tools';
  }

  function parseSteamInput(raw) {
    var val = String(raw || '').trim();
    if (!val) {
      return { raw: '', steamid64: '', vanity: '', invalid: '' };
    }
    if (/^\d{17}$/.test(val)) {
      return { raw: val, steamid64: val, vanity: '', invalid: '' };
    }
    var profMatch = /steamcommunity\.com\/(?:profiles|openid\/id)\/(\d{17})/i.exec(val);
    if (profMatch) {
      return { raw: val, steamid64: profMatch[1], vanity: '', invalid: '' };
    }
    var sid2Match = /^STEAM_[0-5]:([01]):(\d+)$/i.exec(val);
    if (sid2Match && typeof BigInt === 'function') {
      var computed = (BigInt('76561197960265728') + BigInt(sid2Match[1]) + BigInt(sid2Match[2]) * BigInt(2)).toString();
      return { raw: val, steamid64: computed, vanity: '', invalid: '' };
    }
    var vanityMatch = /steamcommunity\.com\/id\/([^/?#\s]+)/i.exec(val);
    if (vanityMatch) {
      var decodedVanity = vanityMatch[1];
      try {
        decodedVanity = decodeURIComponent(vanityMatch[1]);
      } catch (e) {
        // Keep raw match if URI decoding fails
      }
      return { raw: val, steamid64: '', vanity: decodedVanity, invalid: '' };
    }
    if (/^https?:\/\//i.test(val) || val.indexOf('/') !== -1) {
      return {
        raw: val,
        steamid64: '',
        vanity: '',
        invalid: 'Paste a valid Steam profile URL (steamcommunity.com/id/... or /profiles/...) or custom URL name.'
      };
    }
    if (/^[A-Za-z0-9_.-]{2,64}$/.test(val) && val !== '.' && val !== '..') {
      return { raw: val, steamid64: '', vanity: val, invalid: '' };
    }
    return {
      raw: val,
      steamid64: '',
      vanity: '',
      invalid: 'Enter a 17-digit SteamID64, custom URL name, or Steam profile link.'
    };
  }

  var _resolvedVanityCache = new Map();

  function resolveToSteamId64(rawVal, fetchImpl) {
    var parsed = parseSteamInput(rawVal);
    if (!parsed.raw) {
      return Promise.resolve({ ok: true, steamid64: '', vanity: '' });
    }
    if (parsed.steamid64) {
      return Promise.resolve({ ok: true, steamid64: parsed.steamid64, vanity: '' });
    }
    if (parsed.invalid) {
      return Promise.resolve({ ok: false, reason: parsed.invalid });
    }
    var cacheKey = parsed.vanity.toLowerCase();
    var cached = _resolvedVanityCache.get(cacheKey);
    if (cached) {
      return Promise.resolve({ ok: true, steamid64: cached, vanity: parsed.vanity });
    }
    var f = fetchImpl || (root && typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    if (!f) {
      return Promise.resolve({
        ok: false,
        reason: 'Cannot resolve custom URLs here — enter your 17-digit SteamID64 directly.'
      });
    }
    var cfg = getConfig();
    var pathAndQuery = '/ResolveSteamId?id=' + encodeURIComponent(parsed.vanity);
    var reqPromise = typeof cfg.fetchJsonWithFailover === 'function'
      ? cfg.fetchJsonWithFailover(pathAndQuery, { fetchImpl: f })
      : f(String(cfg.API_BASE || 'https://api.steam.tools').replace(/\/+$/, '') + pathAndQuery)
          .then(function (resp) {
            return resp.json().catch(function () {
              return null;
            }).then(function (data) {
              return { ok: resp.ok, status: resp.status, data: data };
            });
          });
    return reqPromise.then(function (res) {
      var data = res && res.data;
      if (res && res.ok && data && /^\d{17}$/.test(String(data.steamid64 || ''))) {
        var sid = String(data.steamid64);
        _resolvedVanityCache.set(cacheKey, sid);
        return { ok: true, steamid64: sid, vanity: parsed.vanity };
      }
      var detailObj = (data && data.detail && typeof data.detail === 'object') ? data.detail : null;
      var baseReason = (data && (data.reason || data.message)) ||
        (detailObj && (detailObj.reason || detailObj.message)) ||
        'Could not find that Steam custom URL.';
      return {
        ok: false,
        reason: baseReason + ' (Steam login usernames differ from custom profile URLs — paste your steamcommunity.com/profiles/... link if needed.)'
      };
    }).catch(function () {
      return {
        ok: false,
        reason: 'Failed to contact SteamTools resolver — enter your 17-digit SteamID64 or try again.'
      };
    });
  }

  function buildSteamInventoryUrl(steamId64, appid, contextid, lastAssetId) {
    var cfg = getConfig();
    var cleanId = String(steamId64 || '').trim();
    var cleanApp = String(appid || '753').trim();
    var cleanCtx = String(contextid || cfg.getContextId(cleanApp)).trim();
    if (!/^\d{17}$/.test(cleanId)) {
      return '';
    }
    var url = 'https://steamcommunity.com/inventory/' +
      encodeURIComponent(cleanId) + '/' +
      encodeURIComponent(cleanApp) + '/' +
      encodeURIComponent(cleanCtx) +
      '?l=english&count=2000';
    if (lastAssetId) {
      url += '&start_assetid=' + encodeURIComponent(String(lastAssetId));
    }
    return url;
  }

  /**
   * Build self-contained inspectable Bookmarklet JS source (< 2 KB).
   * Posts to window.opener when available, or offers one-click Copy/Download JSON in standalone tabs.
   */
  function buildBookmarkletCode(options) {
    var opts = options || {};
    var cfg = getConfig();
    var origin = getAllowedOpenerOrigin(opts.origin);
    var appid = String(opts.appid || '753').replace(/[^\d]/g, '') || '753';
    var contextid = String(opts.contextid || cfg.getContextId(appid)).replace(/[^\d]/g, '') || '6';
    var unlockCode = opts.lockApp === false
      ? "+p[3]?(A=p[3],C=p[4]||2):(h=parseInt(L.hash.slice(1)))&&(A=h,C=A==753?6:A==322330?1:2);"
      : "";
    var qOrigin = "'" + origin + "'";
    var qApp = "'" + appid + "'";
    var qCtx = "'" + contextid + "'";

    return (
      "(async()=>{let O=" + qOrigin + ",A=" + qApp + ",C=" + qCtx + ",S=window,d=document,D=S.opener,P=[],T='',N=0,L=S.location,X=u=>fetch(u,{credentials:'include'}),E=t=>d.createElement(t),b=S._st||(S._st=E('div')),z='textContent',U=t=>b[z]='SteamTools:'+t,W=m=>new Promise(r=>setTimeout(r,m)),Q=/^\\d{17}$/,h;" +
      "if(L.host!=='steamcommunity.com')return alert('Open Steam first');" +
      "let p=L.pathname.split('/');" +
      unlockCode +
      "let I=(Q.test(p[2])?p[2]:'')||S.g_rgProfileData?.steamid||S.g_steamID||'';" +
      "b.style='position:fixed;top:0;right:0;z-index:9999;background:#111;color:#fff;padding:8px';(d.body||d.documentElement).append(b);" +
      "try{if(!I)I=((await(await X('/my/?xml=1')).text()).split('D64>')[1]||'').slice(0,17);if(!Q.test(I))return U('Sign in first');let R=0,e='';" +
      "try{for(;N<25;){U('p'+(N+1));let r=await X('/inventory/'+I+'/'+A+'/'+C+'?l=english&count=2000'+(T?'&start_assetid='+T:''));if(r.status===429&&!R){R=1;await W(2500);continue;}R=0;if(!r.ok)throw Error(r.status);let j=await r.json();if(!j||j.success<1)throw Error(j?.error||'Private');N++;P.push(j);T=j.more_items&&j.last_assetid||'';if(!T)break;if(N<25)await W(600);}if(T&&!e)e='50k cap';}catch(x){if(!P.length)return U(x.message);e=x.message;}" +
      "if(e)e+=' ';if(D&&!D.closed)try{D.postMessage({type:'STEAMTOOLS_INVENTORY_IMPORT',appid:A,contextid:C,steamid:I,pages:P,partial:!!e,error:e},O);U(e+'Sent '+P.length+'p; open SteamTools');return setTimeout(()=>b.remove(),4e3);}catch(x){}" +
      "let J=JSON.stringify(P[1]?P:P[0]),c=E('button'),a=E('a');U(e+P.length+'p ');c[z]='Copy';c.onclick=()=>navigator.clipboard.writeText(J).then(()=>c[z]='Copied');a[z]=' Save';a.style='color:#7cf';a.href=URL.createObjectURL(new Blob([J]));a.download=A+'.json';b.append(c,a);" +
      "}catch(x){U(x.message);}})();"
    );
  }

  function buildBookmarkletHref(options) {
    return 'javascript:' + encodeURI(buildBookmarkletCode(options));
  }

  // ---- CDN Valuation with FNV-1a 753/440 Buckets & Explicit HTTP 404 Fallback ----
  var _priceFileCache = new Map();
  var _monolithPromises = Object.create(null);

  function clearPriceCache() {
    _priceFileCache.clear();
    _monolithPromises = Object.create(null);
  }

  function fetchJsonStrict(url, fetchImpl) {
    var cached = _priceFileCache.get(url);
    if (cached) return cached;

    var f = fetchImpl || (root && typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    if (!f) {
      return Promise.reject(new Error('Fetch API is unavailable in this environment.'));
    }

    var p = f(url).then(function (resp) {
      if (!resp.ok) {
        var err = new Error('HTTP ' + resp.status + ' loading ' + url);
        err.status = resp.status;
        throw err;
      }
      return resp.json();
    }).catch(function (err) {
      _priceFileCache.delete(url);
      throw err;
    });

    _priceFileCache.set(url, p);
    return p;
  }

  function fetchDatasetViaConfig(logicalKey, cdnBase, fetchImpl) {
    var cfg = getConfig();
    var cleanKey = String(logicalKey || '').replace(/^\/+/, '');
    var fallbackUrl = cdnBase.replace(/\/+$/, '') + '/' + cleanKey;
    if (typeof cfg.resolveDatasetUrl === 'function') {
      return cfg.resolveDatasetUrl(cleanKey, { cdnBase: cdnBase, fetchImpl: fetchImpl })
        .then(function (resolvedUrl) {
          return fetchJsonStrict(resolvedUrl, fetchImpl).catch(function (err) {
            if (resolvedUrl !== fallbackUrl) {
              return fetchJsonStrict(fallbackUrl, fetchImpl);
            }
            throw err;
          });
        });
    }
    return fetchJsonStrict(fallbackUrl, fetchImpl);
  }

  function fetchAppMonolith(appStr, cdnBase, fetchImpl) {
    var cacheKey = cdnBase + ':' + appStr;
    if (_monolithPromises[cacheKey]) return _monolithPromises[cacheKey];
    var p = fetchDatasetViaConfig('value/' + encodeURIComponent(appStr) + '.json', cdnBase, fetchImpl).catch(function (err) {
      delete _monolithPromises[cacheKey];
      throw err;
    });
    _monolithPromises[cacheKey] = p;
    return p;
  }

  function runWithConcurrency(tasks, limit, fn) {
    var results = new Array(tasks.length);
    var idx = 0;
    var workers = [];
    var cap = Math.max(1, Math.min(limit, tasks.length));

    function worker() {
      return Promise.resolve().then(function next() {
        if (idx >= tasks.length) return;
        var current = idx++;
        return Promise.resolve(fn(tasks[current], current)).then(function (res) {
          results[current] = res;
          return next();
        });
      });
    }

    for (var i = 0; i < cap; i++) {
      workers.push(worker());
    }
    return Promise.all(workers).then(function () {
      return results;
    });
  }

  /**
   * Value parsed items client-side using CDN price JSONs.
   * For 753, lazily fetches ONLY needed 2-hex buckets and falls back to value/753.json ONLY on HTTP 404.
   */
  function valueInventoryClientSide(items, appid, options) {
    var opts = options || {};
    var cfg = Object.assign({}, getConfig(), opts.config || {});
    var cdnBase = String(cfg.CDN_BASE || 'https://cdn.steam.tools').replace(/\/+$/, '');
    var fetchImpl = opts.fetchImpl;
    var appStr = String(appid || '753');
    var list = Array.isArray(items) ? items : [];

    if (list.length === 0) {
      return Promise.resolve({ items: [], usedBucketFallback: false, bucketsFetched: [] });
    }

    function applyPriceLookup(priceMap) {
      var valued = [];
      var hasPriceMap = Boolean(priceMap && Object.keys(priceMap).length > 0);
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        var hasPrice = priceMap && Object.prototype.hasOwnProperty.call(priceMap, it.quoted_key);
        if ((opts.requirePriceMatch || (appStr === '730' && it.marketable === false)) && hasPriceMap && !hasPrice) {
          continue;
        }
        var cents = hasPrice ? priceMap[it.quoted_key] : undefined;
        var priceDollars = typeof cents === 'number' && Number.isFinite(cents) ? cents / 100 : 0;
        valued.push(Object.assign({}, it, { price: priceDollars }));
      }
      return valued;
    }

    var useShards = (appStr === '753' && cfg.USE_753_BUCKETS !== false) ||
      (appStr === '440' && cfg.USE_440_BUCKETS !== false);
    if (!useShards) {
      return fetchDatasetViaConfig('value/' + encodeURIComponent(appStr) + '.json', cdnBase, fetchImpl)
        .then(function (priceMap) {
          return {
            items: applyPriceLookup(priceMap),
            usedBucketFallback: appStr === '753' || appStr === '440',
            bucketsFetched: []
          };
        });
    }

    var bucketFn = appStr === '753' ? workerMod.fnv1a32Hex2 : workerMod.fnv1a32Hex64;
    var bucketSet = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var b = list[i].bucket || bucketFn(list[i].quoted_key);
      bucketSet[b] = true;
    }
    var buckets = Object.keys(bucketSet).sort();
    var mergedPrices = Object.create(null);

    return runWithConcurrency(buckets, 12, function (hex2) {
      return fetchDatasetViaConfig('value/' + appStr + '/' + hex2 + '.json', cdnBase, fetchImpl).then(function (map) {
        return { hex2: hex2, map: map };
      });
    }).then(function (entries) {
      for (var e = 0; e < entries.length; e++) {
        var m = entries[e].map;
        if (m && typeof m === 'object') {
          var keys = Object.keys(m);
          for (var k = 0; k < keys.length; k++) {
            mergedPrices[keys[k]] = m[keys[k]];
          }
        }
      }
      return {
        items: applyPriceLookup(mergedPrices),
        usedBucketFallback: false,
        bucketsFetched: buckets
      };
    }).catch(function (err) {
      // Strictly fall back to value/{appid}.json ONLY when bucket file returns 404.
      if (err && err.status === 404) {
        return fetchAppMonolith(appStr, cdnBase, fetchImpl).then(function (monolith) {
          return {
            items: applyPriceLookup(monolith),
            usedBucketFallback: true,
            bucketsFetched: buckets
          };
        });
      }
      throw err;
    });
  }

  function priceServerItemValuePayload(items, appid, options) {
    var appStr = String(appid || '753');
    var list = Array.isArray(items) ? items : [];
    var normalized = new Array(list.length);
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var qk = it.quoted_key || workerMod.quoteSteamKey(it.market_hash_name || it.name || '');
      var bucket = it.bucket || (
        qk
          ? (appStr === '753' ? workerMod.fnv1a32Hex2(qk) : (appStr === '440' ? workerMod.fnv1a32Hex64(qk) : undefined))
          : undefined
      );
      normalized[i] = bucket
        ? Object.assign({}, it, { quoted_key: qk, bucket: bucket })
        : Object.assign({}, it, { quoted_key: qk });
    }
    return valueInventoryClientSide(
      normalized,
      appStr,
      Object.assign({}, options || {}, { requirePriceMatch: true })
    );
  }

  // ---- Worker + Synchronous Fallback Parser ----
  var _workerInstance = null;
  var _workerFailed = false;
  var _workerSeq = 0;
  var _pendingRequests = new Map();

  function getWorkerInstance() {
    if (_workerFailed || !WORKER_SCRIPT_URL) return null;
    if (_workerInstance) return _workerInstance;
    if (!root || typeof root.Worker !== 'function') {
      _workerFailed = true;
      return null;
    }
    try {
      _workerInstance = new root.Worker(WORKER_SCRIPT_URL);
      _workerInstance.onmessage = function (ev) {
        var msg = ev && ev.data ? ev.data : {};
        var entry = _pendingRequests.get(msg.id);
        if (!entry) return;
        _pendingRequests.delete(msg.id);
        if (msg.ok) {
          entry.resolve(msg.result);
        } else {
          entry.reject(new Error(msg.error || 'Worker parse error'));
        }
      };
      _workerInstance.onerror = function () {
        _workerFailed = true;
        _workerInstance = null;
        _pendingRequests.forEach(function (entry) {
          try {
            entry.resolve(workerMod.parseInventoryPayload(entry.payload, entry.options));
          } catch (syncErr) {
            entry.reject(syncErr);
          }
        });
        _pendingRequests.clear();
      };
      return _workerInstance;
    } catch (e) {
      _workerFailed = true;
      return null;
    }
  }

  function parseInWorkerOrSync(payload, options) {
    var worker = getWorkerInstance();
    if (!worker) {
      try {
        return Promise.resolve(workerMod.parseInventoryPayload(payload, options));
      } catch (err) {
        return Promise.reject(err);
      }
    }
    var reqId = ++_workerSeq;
    return new Promise(function (resolve, reject) {
      _pendingRequests.set(reqId, { resolve: resolve, reject: reject, payload: payload, options: options });
      try {
        worker.postMessage({ id: reqId, action: 'parse', payload: payload, options: options || {} });
      } catch (postErr) {
        _pendingRequests.delete(reqId);
        _workerFailed = true;
        try {
          resolve(workerMod.parseInventoryPayload(payload, options));
        } catch (syncErr) {
          reject(syncErr);
        }
      }
    });
  }

  // ---- IndexedDB Session Storage for Multi-Page Inventory Wizard ----
  var DB_NAME = 'steamtools_import_v1';
  var STORE_NAME = 'sessions';
  var SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  var _memorySessions = new Map();
  var _dbPromise = null;

  function openSessionDb() {
    if (_dbPromise) return _dbPromise;
    if (!root || !root.indexedDB) {
      return Promise.resolve(null);
    }
    _dbPromise = new Promise(function (resolve) {
      try {
        var req = root.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'scopeKey' });
          }
        };
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          resolve(null);
        };
      } catch (e) {
        resolve(null);
      }
    });
    return _dbPromise;
  }

  function saveImportSession(record) {
    _memorySessions.set(record.scopeKey, record);
    return openSessionDb().then(function (db) {
      if (!db) return record;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(record);
          tx.oncomplete = function () { resolve(record); };
          tx.onerror = function () { resolve(record); };
        } catch (e) {
          resolve(record);
        }
      });
    });
  }

  function isExpiredSession(record) {
    return !record || !record.updatedAt || (Date.now() - Number(record.updatedAt)) > SESSION_TTL_MS;
  }

  function loadImportSession(scopeKey) {
    function validate(rec) {
      if (!rec) return null;
      if (isExpiredSession(rec)) {
        clearImportSession(scopeKey);
        return null;
      }
      return rec;
    }
    return openSessionDb().then(function (db) {
      if (!db) return validate(_memorySessions.get(scopeKey) || null);
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).get(scopeKey);
          req.onsuccess = function () {
            resolve(validate(req.result || _memorySessions.get(scopeKey) || null));
          };
          req.onerror = function () {
            resolve(validate(_memorySessions.get(scopeKey) || null));
          };
        } catch (e) {
          resolve(validate(_memorySessions.get(scopeKey) || null));
        }
      });
    });
  }

  function clearImportSession(scopeKey) {
    _memorySessions.delete(scopeKey);
    return openSessionDb().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(scopeKey);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        } catch (e) {
          resolve();
        }
      });
    });
  }

  // ---- Shared Accessible <dialog> UI Controller ----
  var DEFAULT_STEAMID_HINT = 'Accepts a 17-digit SteamID64, custom URL name (e.g. ehsankia), or steamcommunity.com profile URL.';
  var METHOD_STORAGE_KEY = 'st_import_method';
  var _dialogInstance = null;

  function getAppDisplayName(appid) {
    var k = String(appid || '753');
    var cfg = getConfig();
    var top = Array.isArray(cfg.TOP_6_APPS) ? cfg.TOP_6_APPS : [];
    for (var i = 0; i < top.length; i++) {
      if (String(top[i].appid) === k) return top[i].name;
    }
    var map = {
      '753': 'Steam',
      '730': 'Counter-Strike 2',
      '440': 'Team Fortress 2',
      '570': 'Dota 2',
      '252490': 'Rust',
      '322330': "Don't Starve Together"
    };
    return map[k] || ('App ' + k);
  }

  function getShortAppName(appid) {
    var k = String(appid || '753');
    var shortMap = {
      '753': 'Steam',
      '730': 'CS2',
      '440': 'TF2',
      '570': 'Dota 2',
      '252490': 'Rust',
      '322330': 'DST'
    };
    return shortMap[k] || getAppDisplayName(k);
  }

  function safeStorageGet(key) {
    try {
      return root && root.localStorage ? root.localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function safeStorageSet(key, val) {
    try {
      if (root && root.localStorage) {
        root.localStorage.setItem(key, String(val));
      }
    } catch (e) {
      // Ignore storage quota/privacy restrictions
    }
  }

  function ensureDialogDom() {
    if (_dialogInstance) return _dialogInstance;
    var doc = root.document;

    var dlg = doc.createElement('dialog');
    dlg.id = 'st-import-dialog';
    dlg.className = 'st-import-dialog';
    dlg.setAttribute('closedby', 'any');
    dlg.setAttribute('aria-labelledby', 'st-import-title');

    var appOptionsHtml = '';
    var topApps = getConfig().TOP_6_APPS || [
      { appid: '753', name: 'Steam' },
      { appid: '730', name: 'Counter-Strike 2' },
      { appid: '440', name: 'Team Fortress 2' },
      { appid: '570', name: 'Dota 2' },
      { appid: '252490', name: 'Rust' },
      { appid: '322330', name: "Don't Starve Together" }
    ];
    for (var ai = 0; ai < topApps.length; ai++) {
      appOptionsHtml += '<option value="' + String(topApps[ai].appid) + '">' + String(topApps[ai].name) + '</option>';
    }

    dlg.innerHTML = [
      '<div class="st-import-header">',
      '  <div class="st-import-title-wrap">',
      '    <h2 class="st-import-title" id="st-import-title">Import Steam Inventory</h2>',
      '    <select id="st-import-app-select" class="st-app-select" aria-label="Select game inventory" hidden>' + appOptionsHtml + '</select>',
      '  </div>',
      '  <button type="button" class="st-import-close" id="st-import-close-btn" aria-label="Close import dialog">&times;</button>',
      '</div>',
      '<div class="st-import-body">',
      '  <p class="st-import-subtitle" id="st-import-subtitle">Processed locally in your browser &mdash; nothing is sent to our servers.</p>',
      '  <div class="st-import-tabs" role="tablist" aria-label="Import methods">',
      '    <button type="button" class="st-tab-btn" role="tab" id="st-tab-paste" aria-selected="true" aria-controls="st-panel-paste" tabindex="0">Quick Copy &amp; Paste (No Setup)</button>',
      '    <button type="button" class="st-tab-btn" role="tab" id="st-tab-bookmarklet" aria-selected="false" aria-controls="st-panel-bookmarklet" tabindex="-1">&#9889; 1-Click Auto-Sync (Bookmarklet)</button>',
      '  </div>',
      '  <div class="st-tabpanel" role="tabpanel" id="st-panel-paste" aria-labelledby="st-tab-paste">',
      '    <div class="st-emote-fast" id="st-emote-fast-section" hidden>',
      '      <div class="st-step-row">',
      '        <span class="st-step-num" aria-hidden="true">1</span>',
      '        <div class="st-step-body">',
      '          <div class="st-step-title">Open your Steam EmoticonList data (no SteamID needed)</div>',
      '          <div class="st-field-row">',
      '            <button type="button" class="st-btn" id="st-open-emotelist-btn">Open Steam EmoticonList JSON &#x2197;</button>',
      '          </div>',
      '          <p class="st-hint">Copy everything on that tab (<code>Ctrl+A</code> then <code>Ctrl+C</code>, or <code>&#8984;A</code> then <code>&#8984;C</code> &middot; in Firefox click <strong>Raw Data</strong> first). Shows <code>null</code>? <button type="button" class="st-link-btn" id="st-emote-login-btn">Sign into Steam in browser &#x2197;</button></p>',
      '        </div>',
      '      </div>',
      '      <details class="st-alt-source-details" id="st-emote-alt-details">',
      '        <summary>Or import from a public Steam Profile inventory (by SteamID)</summary>',
      '        <div id="st-emote-alt-slot" class="st-alt-source-slot"></div>',
      '      </details>',
      '    </div>',
      '    <div id="st-std-profile-slot">',
      '      <div id="st-std-steps-wrap" class="st-step-list">',
      '        <div class="st-step-row">',
      '          <span class="st-step-num" aria-hidden="true">1</span>',
      '          <div class="st-step-body">',
      '            <div class="st-step-title"><label for="st-import-steamid">Your Steam Profile</label></div>',
      '            <div class="st-field-row">',
      '              <input type="text" id="st-import-steamid" class="st-input st-steamid-input" maxlength="256" placeholder="SteamID64, custom URL (e.g. ehsankia), or profile link" autocorrect="off" autocapitalize="none" spellcheck="false" aria-invalid="false" aria-describedby="st-import-steamid-hint" data-error="st-import-steamid-err">',
      '              <span id="st-resolved-chip" class="st-resolved-chip" hidden></span>',
      '            </div>',
      '            <p class="st-hint" id="st-import-steamid-hint">' + DEFAULT_STEAMID_HINT + '</p>',
      '            <p class="st-error-msg" id="st-import-steamid-err" hidden></p>',
      '          </div>',
      '        </div>',
      '        <div class="st-step-row">',
      '          <span class="st-step-num" aria-hidden="true">2</span>',
      '          <div class="st-step-body">',
      '            <div class="st-step-title">Open raw inventory JSON in a new tab</div>',
      '            <div class="st-field-row">',
      '              <button type="button" class="st-btn" id="st-open-steam-inv-btn" disabled>Open Raw Steam JSON (Page 1) &#x2197;</button>',
      '              <span class="st-step-status" id="st-step2-hint">Enter your SteamID64, custom URL, or profile link in Step 1 first.</span>',
      '            </div>',
      '            <p class="st-hint">Copy everything on that tab (<code>Ctrl+A</code> / <code>&#8984;A</code>, then <code>Ctrl+C</code> / <code>&#8984;C</code> &middot; in Firefox click <strong>Raw Data</strong> first). Shows <code>null</code>? <button type="button" class="st-link-btn" id="st-std-login-btn">Sign into Steam in browser &#x2197;</button></p>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="st-step-row st-step-paste">',
      '      <span class="st-step-num" id="st-paste-step-num" aria-hidden="true">3</span>',
      '      <div class="st-step-body">',
      '        <div class="st-step-title" id="st-paste-step-title">Return here &amp; paste or drop the JSON</div>',
      '        <div class="st-smart-dropcard" id="st-import-dropzone">',
      '          <div class="st-smart-dropcard-actions">',
      '            <button type="button" class="st-btn" id="st-clipboard-paste-btn">Paste from Clipboard</button>',
      '            <input type="file" id="st-import-file-input" class="st-visually-hidden" multiple accept=".json,application/json,text/plain">',
      '            <label for="st-import-file-input" class="st-btn">Choose .json file(s)</label>',
      '          </div>',
      '          <p class="st-hint st-drop-subhint">Or press <strong>Ctrl+V / &#8984;V anywhere</strong> in this window, or drag &amp; drop <code>.json</code> file(s) here.</p>',
      '        </div>',
      '        <details id="st-manual-paste-details" class="st-manual-details">',
      '          <summary id="st-manual-paste-summary">Paste or inspect raw JSON text manually</summary>',
      '          <div class="st-field-group">',
      '            <label class="st-label" for="st-import-json-input" id="st-import-json-label">Steam Inventory JSON</label>',
      '            <p class="st-hint" id="st-import-json-hint">Pasting automatically stages the data, or click Stage Text after typing.</p>',
      '            <textarea id="st-import-json-input" class="st-textarea" placeholder=\'{"assets":[...],"descriptions":[...],"more_items":0}\' autocorrect="off" autocapitalize="none" spellcheck="false" aria-invalid="false" aria-describedby="st-import-json-hint" data-error="st-import-json-err"></textarea>',
      '            <p class="st-error-msg" id="st-import-json-err" hidden></p>',
      '            <div class="st-field-row st-paste-actions">',
      '              <button type="button" class="st-btn" id="st-parse-paste-btn">Stage Text</button>',
      '              <button type="button" class="st-btn" id="st-clear-paste-btn">Clear</button>',
      '            </div>',
      '          </div>',
      '        </details>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="st-tabpanel" role="tabpanel" id="st-panel-bookmarklet" aria-labelledby="st-tab-bookmarklet" hidden>',
      '    <div class="st-bookmarklet-box">',
      '      <div class="st-listen-pill" id="st-bm-listen-status"><span class="st-listen-dot" aria-hidden="true"></span> Listening for Steam tab &mdash; will import &amp; close automatically when clicked on Steam.</div>',
      '      <ol class="st-bm-steps" id="st-bm-steps">',
      '        <li>Show your Bookmarks Bar (<code>Ctrl+Shift+B</code> or <code>&#8984;+Shift+B</code>) and drag this pill up to it once: <a id="st-bookmarklet-anchor" class="st-bookmarklet-pill" href="javascript:void(0)" draggable="true">SteamTools Sync</a></li>',
      '        <li>Click <button type="button" class="st-btn" id="st-open-popup-btn">Open Steam Community Tab &#x2197;</button> (keep this window open).</li>',
      '        <li>On the Steam tab, click <strong>SteamTools Sync</strong> in your Bookmarks Bar &mdash; up to 50,000 items sync back automatically.</li>',
      '      </ol>',
      '      <div class="st-field-row st-bm-copy-row">',
      '        <span class="st-copy-wrap">',
      '          <button type="button" class="st-btn" id="st-copy-bm-btn">Copy Bookmarklet Code</button>',
      '          <span class="st-copy-status" id="st-copy-bm-tip" role="status"></span>',
      '        </span>',
      '        <span class="st-hint">Paste into a bookmark&apos;s URL field if creating manually (not the browser address bar).</span>',
      '      </div>',
      '      <details class="st-bm-fallback">',
      '        <summary id="st-bm-code-label">View read-only bookmarklet source code</summary>',
      '        <textarea id="st-bm-code-box" class="st-textarea st-bookmarklet-readonly" readonly aria-labelledby="st-bm-code-label" rows="4"></textarea>',
      '      </details>',
      '    </div>',
      '  </div>',
      '  <div class="st-wizard-box" id="st-wizard-box" hidden>',
      '    <div class="st-wizard-top">',
      '      <p class="st-wizard-status" id="st-wizard-status"></p>',
      '      <span class="st-wizard-pct" id="st-wizard-pct"></span>',
      '    </div>',
      '    <div class="st-progress-track" id="st-wizard-progress-wrap" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">',
      '      <div class="st-progress-fill" id="st-wizard-progress-fill"></div>',
      '    </div>',
      '    <div class="st-field-row st-wizard-actions" id="st-wizard-next-row" hidden>',
      '      <button type="button" class="st-btn" id="st-wizard-next-btn">Open Page 2 JSON &#x2197;</button>',
      '      <button type="button" class="st-link-btn" id="st-switch-autosync-btn">Auto-sync all remaining pages with 1-Click Bookmarklet &#x25B8;</button>',
      '    </div>',
      '    <p class="st-hint" id="st-wizard-next-hint" hidden></p>',
      '  </div>',
      '  <p class="st-status-banner" id="st-status-banner" hidden></p>',
      '  <div id="st-import-live" class="st-visually-hidden" aria-live="polite" aria-atomic="true"></div>',
      '</div>',
      '<div class="st-import-footer">',
      '  <button type="button" class="st-btn st-btn-danger" id="st-reset-session-btn" hidden>Start Over</button>',
      '  <div class="st-footer-actions">',
      '    <button type="button" class="st-btn" id="st-cancel-btn">Cancel</button>',
      '    <button type="button" class="st-btn st-btn-primary" id="st-apply-btn" disabled>Apply Imported Items</button>',
      '  </div>',
      '</div>'
    ].join('\n');

    doc.body.appendChild(dlg);

    var els = {
      dialog: dlg,
      title: dlg.querySelector('#st-import-title'),
      appSelect: dlg.querySelector('#st-import-app-select'),
      subtitle: dlg.querySelector('#st-import-subtitle'),
      closeBtn: dlg.querySelector('#st-import-close-btn'),
      tabs: Array.prototype.slice.call(dlg.querySelectorAll('.st-tab-btn')),
      panels: Array.prototype.slice.call(dlg.querySelectorAll('.st-tabpanel')),
      emoteFastSection: dlg.querySelector('#st-emote-fast-section'),
      openEmoteListBtn: dlg.querySelector('#st-open-emotelist-btn'),
      emoteLoginBtn: dlg.querySelector('#st-emote-login-btn'),
      emoteAltDetails: dlg.querySelector('#st-emote-alt-details'),
      emoteAltSlot: dlg.querySelector('#st-emote-alt-slot'),
      stdProfileSlot: dlg.querySelector('#st-std-profile-slot'),
      stdStepsWrap: dlg.querySelector('#st-std-steps-wrap'),
      steamIdInput: dlg.querySelector('#st-import-steamid'),
      resolvedChip: dlg.querySelector('#st-resolved-chip'),
      steamIdHint: dlg.querySelector('#st-import-steamid-hint'),
      steamIdErr: dlg.querySelector('#st-import-steamid-err'),
      openSteamInvBtn: dlg.querySelector('#st-open-steam-inv-btn'),
      step2Hint: dlg.querySelector('#st-step2-hint'),
      stdLoginBtn: dlg.querySelector('#st-std-login-btn'),
      pasteStepNum: dlg.querySelector('#st-paste-step-num'),
      pasteStepTitle: dlg.querySelector('#st-paste-step-title'),
      clipboardPasteBtn: dlg.querySelector('#st-clipboard-paste-btn'),
      dropzone: dlg.querySelector('#st-import-dropzone'),
      fileInput: dlg.querySelector('#st-import-file-input'),
      manualPasteDetails: dlg.querySelector('#st-manual-paste-details'),
      jsonLabel: dlg.querySelector('#st-import-json-label'),
      jsonInput: dlg.querySelector('#st-import-json-input'),
      jsonErr: dlg.querySelector('#st-import-json-err'),
      parsePasteBtn: dlg.querySelector('#st-parse-paste-btn'),
      clearPasteBtn: dlg.querySelector('#st-clear-paste-btn'),
      bmAnchor: dlg.querySelector('#st-bookmarklet-anchor'),
      openPopupBtn: dlg.querySelector('#st-open-popup-btn'),
      copyBmBtn: dlg.querySelector('#st-copy-bm-btn'),
      copyBmTip: dlg.querySelector('#st-copy-bm-tip'),
      bmCodeBox: dlg.querySelector('#st-bm-code-box'),
      wizardBox: dlg.querySelector('#st-wizard-box'),
      wizardStatus: dlg.querySelector('#st-wizard-status'),
      wizardPct: dlg.querySelector('#st-wizard-pct'),
      wizardProgressWrap: dlg.querySelector('#st-wizard-progress-wrap'),
      wizardProgressFill: dlg.querySelector('#st-wizard-progress-fill'),
      wizardNextRow: dlg.querySelector('#st-wizard-next-row'),
      wizardNextBtn: dlg.querySelector('#st-wizard-next-btn'),
      switchAutosyncBtn: dlg.querySelector('#st-switch-autosync-btn'),
      wizardNextHint: dlg.querySelector('#st-wizard-next-hint'),
      statusBanner: dlg.querySelector('#st-status-banner'),
      liveRegion: dlg.querySelector('#st-import-live'),
      resetSessionBtn: dlg.querySelector('#st-reset-session-btn'),
      cancelBtn: dlg.querySelector('#st-cancel-btn'),
      applyBtn: dlg.querySelector('#st-apply-btn')
    };

    var state = {
      options: null,
      rawPages: [],
      parsedPages: [],
      parsedResult: null,
      restoredSession: false,
      lastSavedScopeKey: null,
      popupRef: null,
      liveTimer: null,
      copyTipTimer: null,
      lastCopyMsg: '',
      inputResolveTimer: null,
      downOutside: false,
      resolvedSteamId: '',
      resolveSeq: 0,
      activeTab: 0
    };

    function announce(msg, delayMs) {
      if (state.liveTimer) {
        clearTimeout(state.liveTimer);
      }
      els.liveRegion.textContent = '';
      state.liveTimer = setTimeout(function () {
        els.liveRegion.textContent = msg;
      }, typeof delayMs === 'number' ? delayMs : 80);
    }

    function setBanner(kind, msg, opts) {
      if (!msg) {
        els.statusBanner.hidden = true;
        els.statusBanner.className = 'st-status-banner';
        els.statusBanner.textContent = '';
        return;
      }
      els.statusBanner.hidden = false;
      els.statusBanner.className = 'st-status-banner is-' + kind;
      els.statusBanner.textContent = msg;
      if (opts && opts.showClear && els.resetSessionBtn) {
        var clearInline = doc.createElement('button');
        clearInline.type = 'button';
        clearInline.className = 'st-btn st-btn-danger';
        clearInline.style.marginLeft = '8px';
        clearInline.textContent = 'Start Over';
        clearInline.addEventListener('click', function () {
          els.resetSessionBtn.click();
        });
        els.statusBanner.appendChild(clearInline);
      }
      announce(msg);
    }

    function setFieldError(inputEl, errEl, baseHintId, errText) {
      if (errText) {
        errEl.textContent = errText;
        errEl.hidden = false;
        inputEl.classList.add('st-is-invalid');
        inputEl.setAttribute('aria-invalid', 'true');
        inputEl.setAttribute('aria-describedby', baseHintId + ' ' + errEl.id);
      } else {
        errEl.hidden = true;
        errEl.textContent = '';
        inputEl.classList.remove('st-is-invalid');
        inputEl.setAttribute('aria-invalid', 'false');
        inputEl.setAttribute('aria-describedby', baseHintId);
      }
    }

    function computeCanAppend() {
      return Boolean(state.rawPages.length > 0 && state.parsedResult && state.parsedResult.more_items);
    }

    function shouldPreferPasteTab(opts) {
      if (opts && opts.initialJson) return true;
      var cfg = getConfig();
      if (typeof cfg.isInAppWebview === 'function' && cfg.isInAppWebview()) return true;
      try {
        if (root && typeof root.matchMedia === 'function' && root.matchMedia('(pointer: coarse)').matches) {
          return true;
        }
      } catch (e) {}
      return false;
    }

    function selectTab(tabIndex, focusTab, tabOpts) {
      if (!els.tabs || els.tabs.length === 0) return;
      var idx = ((tabIndex % els.tabs.length) + els.tabs.length) % els.tabs.length;
      state.activeTab = idx;
      for (var i = 0; i < els.tabs.length; i++) {
        var active = i === idx;
        els.tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
        els.tabs[i].setAttribute('tabindex', active ? '0' : '-1');
        els.panels[i].hidden = !active;
      }
      if (!tabOpts || !tabOpts.skipPersist) {
        if (idx === 1 && !shouldPreferPasteTab(state.options)) {
          safeStorageSet(METHOD_STORAGE_KEY, 'bookmarklet');
        } else if (idx === 0 && (!tabOpts || !tabOpts.transient)) {
          safeStorageSet(METHOD_STORAGE_KEY, 'paste');
        }
      }
      if (focusTab && typeof els.tabs[idx].focus === 'function') {
        els.tabs[idx].focus();
      }
      if (typeof els.tabs[idx].scrollIntoView === 'function') {
        try {
          els.tabs[idx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch (e) {}
      }
    }

    function getEffectiveSteamId() {
      if (/^\d{17}$/.test(state.resolvedSteamId)) {
        return state.resolvedSteamId;
      }
      return parseSteamInput(els.steamIdInput.value).steamid64;
    }

    function getScopeKey() {
      var opts = state.options || {};
      var mode = opts.mode || 'auto';
      var appid = String(opts.appid || '753');
      var ctx = String(opts.contextid || getConfig().getContextId(appid));
      var sid = getEffectiveSteamId() ||
        String((els.steamIdInput && els.steamIdInput.value) || opts.steamId || '').trim().toLowerCase();
      return mode + ':' + appid + ':' + ctx + ':' + (sid || 'anon');
    }

    function persistCurrentSession() {
      if (!state.rawPages || state.rawPages.length === 0) return;
      var currentKey = getScopeKey();
      var prevKey = state.lastSavedScopeKey;
      state.lastSavedScopeKey = currentKey;
      saveImportSession({
        scopeKey: currentKey,
        rawPages: state.rawPages,
        steamId: getEffectiveSteamId() || String(els.steamIdInput.value || '').trim(),
        updatedAt: Date.now()
      });
      if (prevKey && prevKey !== currentKey && prevKey.slice(-5) === ':anon') {
        clearImportSession(prevKey);
      }
    }

    function updateSteamLinks() {
      var opts = state.options || {};
      var appid = String(opts.appid || '753');
      var shortApp = getShortAppName(appid);
      var parsed = parseSteamInput(els.steamIdInput.value);
      var sid = /^\d{17}$/.test(state.resolvedSteamId) ? state.resolvedSteamId : parsed.steamid64;

      els.openSteamInvBtn.textContent = 'Open Raw ' + shortApp + ' JSON (Page 1) \u2197';

      if (sid && /^\d{17}$/.test(sid)) {
        els.resolvedChip.textContent = '\u2713 ID: ' + sid;
        els.resolvedChip.hidden = false;
        els.openSteamInvBtn.disabled = false;
        els.step2Hint.textContent = 'Always opens raw JSON (up to 2,000 items/page).';
      } else if (parsed.vanity && !parsed.invalid) {
        els.resolvedChip.hidden = true;
        els.resolvedChip.textContent = '';
        els.openSteamInvBtn.disabled = false;
        els.step2Hint.textContent = 'Click to resolve "' + parsed.vanity + '" & open raw JSON.';
      } else {
        els.resolvedChip.hidden = true;
        els.resolvedChip.textContent = '';
        els.openSteamInvBtn.disabled = true;
        els.step2Hint.textContent = parsed.invalid
          ? 'Fix the Steam profile field in Step 1 first.'
          : 'Enter your SteamID64, custom URL, or profile link in Step 1 first.';
      }

      var res = state.parsedResult;
      if (res && res.more_items && res.last_assetid) {
        els.wizardNextRow.hidden = false;
        var nextPageNum = (res.page_count || 1) + 1;
        els.wizardNextBtn.textContent = 'Open Page ' + nextPageNum + ' JSON \u2197';
        if (sid || (parsed.vanity && !parsed.invalid)) {
          els.wizardNextBtn.disabled = false;
          els.wizardNextHint.hidden = true;
          els.wizardNextHint.textContent = '';
        } else {
          els.wizardNextBtn.disabled = true;
          els.wizardNextHint.hidden = false;
          els.wizardNextHint.textContent = 'Enter your SteamID in Step 1 to open Page ' + nextPageNum + ' JSON manually, or use 1-Click Bookmarklet.';
        }
      } else {
        els.wizardNextRow.hidden = true;
        els.wizardNextHint.hidden = true;
        els.wizardNextHint.textContent = '';
      }
    }

    function resolveInputNow(announceOnError) {
      var raw = els.steamIdInput.value;
      var parsed = parseSteamInput(raw);
      var seq = ++state.resolveSeq;

      if (!parsed.raw) {
        state.resolvedSteamId = '';
        els.steamIdHint.textContent = DEFAULT_STEAMID_HINT;
        setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', '');
        updateSteamLinks();
        return Promise.resolve({ ok: true, steamid64: '' });
      }

      if (parsed.steamid64) {
        if (els.steamIdInput.value !== parsed.steamid64 && /steamcommunity\.com|^STEAM_/i.test(parsed.raw)) {
          els.steamIdInput.value = parsed.steamid64;
        }
        state.resolvedSteamId = parsed.steamid64;
        els.steamIdHint.textContent = DEFAULT_STEAMID_HINT;
        setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', '');
        updateSteamLinks();
        persistCurrentSession();
        return Promise.resolve({ ok: true, steamid64: parsed.steamid64 });
      }

      if (parsed.invalid) {
        state.resolvedSteamId = '';
        els.steamIdHint.textContent = DEFAULT_STEAMID_HINT;
        setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', parsed.invalid);
        if (announceOnError) {
          announce(parsed.invalid, 500);
        }
        updateSteamLinks();
        return Promise.resolve({ ok: false, reason: parsed.invalid });
      }

      var cachedVanityId = _resolvedVanityCache.get(parsed.vanity.toLowerCase()) || '';
      if (cachedVanityId) {
        state.resolvedSteamId = cachedVanityId;
        setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', '');
        els.steamIdHint.textContent = 'Resolved "' + parsed.vanity + '" to SteamID64 ' + cachedVanityId + '.';
        updateSteamLinks();
        persistCurrentSession();
        return Promise.resolve({ ok: true, steamid64: cachedVanityId, vanity: parsed.vanity });
      }

      state.resolvedSteamId = '';
      els.steamIdHint.textContent = 'Resolving Steam profile "' + parsed.vanity + '"...';
      setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', '');
      updateSteamLinks();

      return resolveToSteamId64(raw).then(function (res) {
        if (seq !== state.resolveSeq) return res;
        if (res && res.ok && res.steamid64) {
          state.resolvedSteamId = res.steamid64;
          setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', '');
          els.steamIdHint.textContent = 'Resolved "' + parsed.vanity + '" to SteamID64 ' + res.steamid64 + '.';
          updateSteamLinks();
          persistCurrentSession();
          return res;
        }
        var reason = (res && res.reason) || 'Could not resolve that Steam custom URL.';
        state.resolvedSteamId = '';
        els.steamIdHint.textContent = DEFAULT_STEAMID_HINT;
        setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', reason);
        if (announceOnError) {
          announce(reason, 500);
        }
        updateSteamLinks();
        return res;
      });
    }

    function setProgress(pct) {
      var clean = Math.max(0, Math.min(100, Math.round(pct || 0)));
      els.wizardPct.textContent = clean + '%';
      els.wizardProgressWrap.setAttribute('aria-valuenow', String(clean));
      els.wizardProgressFill.style.width = clean + '%';
    }

    function renderWizardState() {
      var opts = state.options || {};
      var mode = opts.mode || 'auto';
      var res = state.parsedResult;
      if (!res) {
        els.wizardBox.hidden = true;
        els.resetSessionBtn.hidden = true;
        els.applyBtn.disabled = true;
        els.applyBtn.textContent = 'Apply Imported Items';
        setProgress(0);
        updateSteamLinks();
        return;
      }

      els.resetSessionBtn.hidden = state.rawPages.length === 0 && !res.isEmptyArray;

      if (res.isEmoticonList && res.isEmptyArray) {
        if (mode !== 'emotes') {
          els.wizardBox.hidden = true;
          els.applyBtn.disabled = true;
          els.applyBtn.textContent = mode === 'backgrounds'
            ? 'Import Backgrounds'
            : (mode === 'cards' ? 'Import Card Sets' : 'Import Items');
          setBanner(
            'warning',
            'This empty [] JSON is an EmoticonList, not a Steam Inventory response. Use the Open Raw JSON button in Step 2.'
          );
          updateSteamLinks();
          return;
        }
        if (opts.allowEmptyEmotes) {
          els.wizardBox.hidden = false;
          els.wizardStatus.textContent = 'Your Steam EmoticonList is empty ([]) — ready to load Steam\'s 6 default emoticons.';
          setProgress(100);
          els.applyBtn.disabled = false;
          els.applyBtn.textContent = 'Load 6 Default Steam Emotes';
          setBanner(
            'warning',
            'Your Steam EmoticonList returned [] (no owned emoticons). Click "Load 6 Default Steam Emotes" below to continue, or import from your public profile above.'
          );
          updateSteamLinks();
          return;
        }
        els.wizardBox.hidden = true;
        els.applyBtn.disabled = true;
        els.applyBtn.textContent = 'Import Emoticons';
        setBanner(
          'warning',
          'Steam returned [] (no owned emoticons found). Sign into steamcommunity.com in this browser or import from your public Steam Profile inventory above.'
        );
        updateSteamLinks();
        return;
      }

      els.wizardBox.hidden = false;

      var pct = res.isEmoticonList
        ? 100
        : (res.total_inventory_count > 0
          ? Math.min(100, Math.round((res.asset_count / res.total_inventory_count) * 100))
          : 100);
      setProgress(pct);

      if (res.isEmoticonList) {
        els.wizardStatus.textContent = 'Ready: extracted ' + res.emoticons.length + ' unique emoticon(s).';
      } else {
        var pageSummary = 'Staged Page ' + res.page_count + ': ' + res.asset_count + ' item(s)';
        if (res.total_inventory_count && res.total_inventory_count >= res.asset_count) {
          pageSummary += ' of ' + res.total_inventory_count + ' total';
        }
        if (res.more_items && res.last_assetid) {
          pageSummary += ' — more items on Steam.';
        } else {
          pageSummary += ' — all pages loaded!';
        }
        els.wizardStatus.textContent = pageSummary;
      }

      var detectedApp = res.detected_appid ? String(res.detected_appid) : String(opts.appid || '753');
      var wrongSourceWarning = '';
      var applyDisabled = false;
      var applyLabel = 'Apply Imported Items';

      if (mode === 'backgrounds') {
        var bgCount = res.bg_count || (Array.isArray(res.backgrounds) ? res.backgrounds.length : 0);
        if (res.isEmoticonList || detectedApp !== '753') {
          applyDisabled = true;
          applyLabel = 'Import Backgrounds';
          wrongSourceWarning = 'This data is from ' + (res.isEmoticonList ? 'EmoticonList' : getAppDisplayName(detectedApp)) +
            ', not Steam Profile Backgrounds (Steam 753 inventory).';
        } else {
          applyLabel = 'Import ' + bgCount + ' Background' + (bgCount === 1 ? '' : 's');
          if (bgCount === 0 && !res.more_items) {
            wrongSourceWarning = '0 profile backgrounds found in this inventory page.';
          }
        }
      } else if (mode === 'cards') {
        var setCount = typeof res.card_set_count === 'number'
          ? res.card_set_count
          : (res.cards ? Object.keys(res.cards).length : 0);
        if (res.isEmoticonList || detectedApp !== '753') {
          applyDisabled = true;
          applyLabel = 'Import Card Sets';
          wrongSourceWarning = 'Expected Steam Community (753) inventory JSON for Trading Cards, but got ' +
            (res.isEmoticonList ? 'EmoticonList' : getAppDisplayName(detectedApp)) + ' data.';
        } else {
          applyLabel = setCount > 0
            ? ('Import ' + setCount + ' Card Set' + (setCount === 1 ? '' : 's'))
            : ('Import ' + res.asset_count + ' Item' + (res.asset_count === 1 ? '' : 's'));
        }
      } else if (mode === 'emotes') {
        var emoteCount = res.isEmoticonList
          ? res.emoticons.length
          : (res.emote_count || (Array.isArray(res.emoticons) ? res.emoticons.length : 0));
        if (!res.isEmoticonList && detectedApp !== '753') {
          applyDisabled = true;
          applyLabel = 'Import Emoticons';
          wrongSourceWarning = 'This looks like ' + getAppDisplayName(detectedApp) +
            ' inventory, not Steam Emoticons or EmoticonList JSON.';
        } else if (emoteCount === 0 && opts.allowEmptyEmotes) {
          applyLabel = 'Load 6 Default Steam Emotes';
        } else {
          applyLabel = 'Import ' + emoteCount + ' Emoticon' + (emoteCount === 1 ? '' : 's');
          if (emoteCount === 0 && !res.more_items) {
            applyDisabled = true;
            wrongSourceWarning = '0 emoticons found in this inventory page.';
          }
        }
      } else {
        var mCount = Array.isArray(res.items) ? res.items.length : 0;
        if (res.isEmoticonList) {
          applyDisabled = true;
          applyLabel = 'Import Items';
          wrongSourceWarning = 'EmoticonList JSON cannot be priced in Item Value — open Raw Inventory JSON instead.';
        } else {
          applyLabel = mCount > 0
            ? ('Import ' + mCount + ' Marketable Item' + (mCount === 1 ? '' : 's'))
            : ('Import ' + res.asset_count + ' Item' + (res.asset_count === 1 ? '' : 's'));
        }
      }

      els.applyBtn.disabled = applyDisabled;
      els.applyBtn.textContent = applyLabel;
      if (wrongSourceWarning) {
        setBanner(applyDisabled ? 'error' : 'warning', wrongSourceWarning);
      }
      updateSteamLinks();
    }

    function refreshBookmarklet() {
      var opts = state.options || {};
      var code = buildBookmarkletCode({
        appid: opts.appid || '753',
        contextid: opts.contextid || getConfig().getContextId(opts.appid || '753'),
        lockApp: opts.lockApp !== false
      });
      var href = 'javascript:' + encodeURI(code);
      els.bmAnchor.href = href;
      els.bmCodeBox.value = code;
    }

    function syncModeLayout(savedSessionHasSteamId) {
      var opts = state.options || {};
      var isEmotes = opts.mode === 'emotes';
      if (isEmotes) {
        els.emoteFastSection.hidden = false;
        if (els.stdStepsWrap.parentNode !== els.emoteAltSlot) {
          els.emoteAltSlot.appendChild(els.stdStepsWrap);
        }
        els.pasteStepNum.textContent = '2';
        els.pasteStepTitle.textContent = 'Copy & paste the EmoticonList JSON here';
        if (savedSessionHasSteamId || opts.steamId) {
          els.emoteAltDetails.open = true;
        }
      } else {
        els.emoteFastSection.hidden = true;
        els.emoteAltDetails.open = false;
        if (els.stdStepsWrap.parentNode !== els.stdProfileSlot) {
          els.stdProfileSlot.appendChild(els.stdStepsWrap);
        }
        els.pasteStepNum.textContent = '3';
        els.pasteStepTitle.textContent = 'Return here & paste or drop the JSON';
      }
    }

    function processIncomingInputs(newInputs, appendToSession, parseOpts) {
      setBanner(null, '');
      setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', '');
      var isRestored = Boolean(parseOpts && parseOpts.restored);
      var prevPageCount = state.parsedResult ? Number(state.parsedResult.page_count || 0) : 0;
      var list = Array.isArray(newInputs) ? newInputs.slice() : [newInputs];
      var payloadList = appendToSession ? state.rawPages.concat(list) : list;
      var parsedList = appendToSession ? state.parsedPages.concat(list) : list;
      var opts = state.options || {};

      return parseInWorkerOrSync(parsedList, {
        mode: opts.mode || 'auto',
        appid: opts.appid || '753'
      }).then(function (result) {
        if (result.isEmoticonList && result.isEmptyArray) {
          state.rawPages = [];
          state.parsedPages = [];
          state.parsedResult = result;
          state.restoredSession = false;
          renderWizardState();
          return result;
        }
        var pagesForStorage = Array.isArray(result.slim_pages) ? result.slim_pages : payloadList;
        var dupIgnored = Boolean(appendToSession && result.duplicate_pages_ignored > 0 && result.page_count <= prevPageCount);
        state.rawPages = pagesForStorage;
        state.parsedPages = pagesForStorage;
        state.parsedResult = result;
        state.restoredSession = isRestored;
        renderWizardState();
        persistCurrentSession();

        if (els.applyBtn.disabled) {
          return result;
        }

        if (dupIgnored) {
          var nextPage = (result.page_count || 1) + 1;
          setBanner(
            'warning',
            'That page is already staged — click "Open Page ' + nextPage + ' JSON \u2197" below to get the next 2,000 items.'
          );
          return result;
        }

        if (!els.statusBanner.hidden && els.statusBanner.classList.contains('is-warning')) {
          return result;
        }

        if (isRestored) {
          setBanner(
            'warning',
            'Restored staged session (Page ' + result.page_count + ', ' + result.asset_count + ' item(s)).',
            { showClear: true }
          );
        } else if (parseOpts && parseOpts.bannerOverride) {
          setBanner('success', parseOpts.bannerOverride);
        } else if (!result.isEmoticonList && result.detected_appid && String(result.detected_appid) !== String(opts.appid || '753') && opts.lockApp === false) {
          setBanner(
            'success',
            'Detected ' + getAppDisplayName(result.detected_appid) + ' inventory (' + result.asset_count + ' items across ' + result.page_count + ' page(s)) — game filter will switch automatically.'
          );
        } else if (!result.isEmoticonList) {
          setBanner('success', 'Staged ' + result.asset_count + ' item(s) across ' + result.page_count + ' page(s).');
        } else {
          setBanner('success', 'Extracted ' + result.emoticons.length + ' unique emoticon(s).');
        }
        return result;
      }).catch(function (err) {
        var msg = err && err.message ? err.message : 'Failed to parse inventory JSON.';
        setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', msg);
        setBanner('error', msg);
        announce(msg);
      });
    }

    function reportCopyStatus(ok, msgText) {
      if (state.copyTipTimer) clearTimeout(state.copyTipTimer);
      els.copyBmBtn.removeAttribute('data-copied');
      els.copyBmBtn.removeAttribute('data-failed');
      var msg = msgText || (ok ? 'Copied' : 'Copy failed');
      if (msg === state.lastCopyMsg) {
        msg += '\u00A0';
      }
      state.lastCopyMsg = msg;
      els.copyBmTip.textContent = '';
      els.copyBmTip.classList.remove('is-visible');
      els.copyBmBtn.setAttribute(ok ? 'data-copied' : 'data-failed', '');
      var sched = typeof root.requestAnimationFrame === 'function' ? root.requestAnimationFrame : setTimeout;
      sched(function () {
        els.copyBmTip.textContent = msg;
        els.copyBmTip.classList.add('is-visible');
      }, 0);
      state.copyTipTimer = setTimeout(function () {
        els.copyBmBtn.removeAttribute('data-copied');
        els.copyBmBtn.removeAttribute('data-failed');
        els.copyBmTip.classList.remove('is-visible');
        els.copyBmTip.textContent = '';
        state.copyTipTimer = null;
      }, 2000);
    }

    // Event bindings
    for (var t = 0; t < els.tabs.length; t++) {
      (function (idx) {
        els.tabs[idx].addEventListener('click', function () {
          selectTab(idx, false);
        });
        els.tabs[idx].addEventListener('keydown', function (ev) {
          var key = ev.key || ev.keyCode;
          if (key === 'ArrowRight' || key === 39) {
            ev.preventDefault();
            selectTab(idx + 1, true);
          } else if (key === 'ArrowLeft' || key === 37) {
            ev.preventDefault();
            selectTab(idx - 1, true);
          } else if (key === 'Home' || key === 36) {
            ev.preventDefault();
            selectTab(0, true);
          } else if (key === 'End' || key === 35) {
            ev.preventDefault();
            selectTab(els.tabs.length - 1, true);
          }
        });
      })(t);
    }

    els.appSelect.addEventListener('change', function () {
      if (!state.options) return;
      var newApp = els.appSelect.value;
      state.options.appid = newApp;
      state.options.contextid = getConfig().getContextId(newApp);
      els.title.textContent = 'Import Inventory for ' + getAppDisplayName(newApp);
      refreshBookmarklet();
      updateSteamLinks();
      if (state.rawPages.length > 0) {
        processIncomingInputs(state.rawPages.slice(), false);
      } else {
        loadImportSession(getScopeKey()).then(function (saved) {
          if (saved && Array.isArray(saved.rawPages) && saved.rawPages.length > 0 && state.rawPages.length === 0) {
            processIncomingInputs(saved.rawPages, false, { restored: true });
          }
        });
      }
    });

    els.closeBtn.addEventListener('click', function () {
      dlg.close('cancel');
    });

    els.cancelBtn.addEventListener('click', function () {
      dlg.close('cancel');
    });

    els.applyBtn.addEventListener('click', function () {
      if (!state.parsedResult || els.applyBtn.disabled) return;
      dlg.close('apply');
    });

    dlg.addEventListener('close', function () {
      var rv = dlg.returnValue;
      dlg.returnValue = '';
      var callback = state.options && state.options.onImport;
      var result = state.parsedResult;
      if (rv === 'apply' && typeof callback === 'function' && result) {
        var resolvedSid = getEffectiveSteamId() || '';
        result.steamid64 = resolvedSid;
        var finishedKey = getScopeKey();
        if (!result.more_items) {
          state.rawPages = [];
          state.parsedPages = [];
          state.parsedResult = null;
          state.restoredSession = false;
          state.lastSavedScopeKey = null;
          clearImportSession(finishedKey);
        }
        callback(result);
      }
    });

    // Progressive enhancement backdrop click close only if closedBy is unsupported
    if (typeof root.HTMLDialogElement === 'function' && !('closedBy' in root.HTMLDialogElement.prototype)) {
      dlg.addEventListener('pointerdown', function (ev) {
        var rect = dlg.getBoundingClientRect();
        state.downOutside =
          ev.clientX < rect.left ||
          ev.clientX > rect.right ||
          ev.clientY < rect.top ||
          ev.clientY > rect.bottom;
      });
      dlg.addEventListener('pointerup', function (ev) {
        if (!state.downOutside) return;
        state.downOutside = false;
        var rect = dlg.getBoundingClientRect();
        var upOutside =
          ev.clientX < rect.left ||
          ev.clientX > rect.right ||
          ev.clientY < rect.top ||
          ev.clientY > rect.bottom;
        if (upOutside) {
          dlg.close('cancel');
        }
      });
    }

    function writePendingTabStatus(tab, vanityName) {
      if (!tab || tab.closed) return;
      try {
        tab.document.title = 'Resolving Steam profile...';
        tab.document.body.style.cssText = 'background:#1b2026;color:#edf2f7;font:14px sans-serif;padding:24px;margin:0;';
        tab.document.body.textContent = 'Resolving Steam custom URL "' + vanityName + '"...';
      } catch (e) {}
    }

    function openSteamTarget(kind, ev) {
      if (ev) ev.preventDefault();
      var opts = state.options || {};
      var appid = String(opts.appid || '753');
      var ctx = String(opts.contextid || getConfig().getContextId(appid));
      var parsed = parseSteamInput(els.steamIdInput.value);
      var sid = /^\d{17}$/.test(state.resolvedSteamId) ? state.resolvedSteamId : parsed.steamid64;
      var startAsset = (kind === 'next' && state.parsedResult && state.parsedResult.last_assetid)
        ? state.parsedResult.last_assetid
        : null;

      if (kind === 'emotelist') {
        var eTab = root.open('https://steamcommunity.com/actions/EmoticonList', '_blank', 'noopener,noreferrer');
        if (!eTab) {
          setBanner('error', 'Popup blocked by browser. Allow popups for this site and try again.');
        }
        return;
      }

      if (kind === 'login') {
        var lTab = root.open('https://steamcommunity.com/', '_blank', 'noopener,noreferrer');
        if (!lTab) {
          setBanner('error', 'Popup blocked by browser. Allow popups for this site and try again.');
        }
        return;
      }

      function buildTargetUrl(resolvedSid) {
        if (kind === 'tab') {
          return resolvedSid
            ? ('https://steamcommunity.com/profiles/' + encodeURIComponent(resolvedSid) + '/inventory/#' + encodeURIComponent(appid))
            : ('https://steamcommunity.com/my/inventory/#' + encodeURIComponent(appid));
        }
        return resolvedSid ? buildSteamInventoryUrl(resolvedSid, appid, ctx, startAsset) : '';
      }

      if (parsed.invalid) {
        resolveInputNow(true);
        els.steamIdInput.focus();
        return;
      }

      if ((kind === 'json' || kind === 'next') && !sid && !parsed.vanity) {
        setFieldError(
          els.steamIdInput,
          els.steamIdErr,
          'st-import-steamid-hint',
          'Enter your SteamID64, custom URL, or profile link first.'
        );
        els.steamIdInput.focus();
        updateSteamLinks();
        return;
      }

      if (sid || (kind === 'tab' && !parsed.vanity)) {
        var directUrl = buildTargetUrl(sid);
        // Open without noopener for bookmarklet tab so window.opener stays intact
        state.popupRef = root.open(directUrl, '_blank');
        if (!state.popupRef) {
          setBanner('error', 'Popup blocked by browser. Allow popups for this site and try again.');
          return;
        }
        if (kind === 'tab') {
          setBanner('success', 'Opened Steam Community tab. Click "SteamTools Sync" in your Bookmarks Bar on that tab.');
        }
        return;
      }

      // Unresolved vanity name: open tab synchronously under user gesture, resolve ID, navigate strictly to raw JSON or Steam tab
      var pendingTab = root.open('about:blank', '_blank');
      state.popupRef = pendingTab;
      if (!pendingTab) {
        setBanner('error', 'Popup blocked by browser. Allow popups for this site and try again.');
        resolveInputNow(true);
        return;
      }
      if (state.inputResolveTimer) {
        clearTimeout(state.inputResolveTimer);
        state.inputResolveTimer = null;
      }
      writePendingTabStatus(pendingTab, parsed.vanity);
      resolveInputNow(true).then(function (res) {
        if (res && res.ok && res.steamid64) {
          var finalUrl = buildTargetUrl(res.steamid64);
          try {
            if (!pendingTab.closed && finalUrl) {
              pendingTab.location.href = finalUrl;
            }
          } catch (navErr) {}
          if (kind === 'tab') {
            setBanner('success', 'Opened Steam Community tab. Click "SteamTools Sync" in your Bookmarks Bar on that tab.');
          }
          return;
        }
        try {
          if (!pendingTab.closed) pendingTab.close();
        } catch (closeErr) {}
        els.steamIdInput.focus();
      });
    }

    els.steamIdInput.addEventListener('blur', function () {
      if (state.inputResolveTimer) {
        clearTimeout(state.inputResolveTimer);
        state.inputResolveTimer = null;
      }
      resolveInputNow(true);
    });

    els.steamIdInput.addEventListener('input', function () {
      state.resolveSeq++;
      if (state.inputResolveTimer) {
        clearTimeout(state.inputResolveTimer);
        state.inputResolveTimer = null;
      }
      var parsed = parseSteamInput(els.steamIdInput.value);
      var cachedId = (parsed.vanity && !parsed.steamid64 && !parsed.invalid)
        ? (_resolvedVanityCache.get(parsed.vanity.toLowerCase()) || '')
        : '';
      state.resolvedSteamId = parsed.steamid64 || cachedId || '';
      els.steamIdHint.textContent = cachedId
        ? ('Resolved "' + parsed.vanity + '" to SteamID64 ' + cachedId + '.')
        : DEFAULT_STEAMID_HINT;
      setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', '');
      updateSteamLinks();
      if (state.resolvedSteamId) {
        persistCurrentSession();
      }
      if (parsed.vanity && !state.resolvedSteamId && !parsed.invalid) {
        state.inputResolveTimer = setTimeout(function () {
          state.inputResolveTimer = null;
          resolveInputNow(false);
        }, 300);
      }
    });

    var cfgApi = getConfig();
    var attachGuard = typeof cfgApi.attachSteamIdPasteGuard === 'function'
      ? cfgApi.attachSteamIdPasteGuard
      : null;
    if (attachGuard) {
      attachGuard(els.steamIdInput, {
        onJsonPaste: function (text) {
          selectTab(0, false, { transient: true });
          els.jsonInput.value = '';
          processIncomingInputs([text], computeCanAppend(), {
            bannerOverride: 'Detected inventory JSON pasted into the SteamID field — staged items automatically!'
          });
        },
        onOversizedPaste: function () {
          setFieldError(
            els.steamIdInput,
            els.steamIdErr,
            'st-import-steamid-hint',
            'Pasted text is too long for a SteamID. Paste inventory JSON in Step 3 instead.'
          );
          announce('Pasted text is too long for a SteamID.');
        }
      });
    }

    // Global Ctrl+V / Cmd+V handler anywhere in the open dialog
    dlg.addEventListener('paste', function (ev) {
      if (!dlg.open || ev.defaultPrevented) return;
      var target = ev.target;
      if (target && (target === els.steamIdInput || target === els.jsonInput ||
          target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      var clip = (ev && ev.clipboardData) || (root && root.clipboardData);
      if (!clip || typeof clip.getData !== 'function') return;
      var text = '';
      try {
        text = clip.getData('text/plain') || clip.getData('text') || '';
      } catch (e) {
        return;
      }
      if (!text || !text.trim()) return;
      ev.preventDefault();
      selectTab(0, false, { transient: true });
      processIncomingInputs([text], computeCanAppend());
    });

    // Consistent instant paste handling in manual JSON textarea (any length)
    els.jsonInput.addEventListener('paste', function (ev) {
      var clip = (ev && ev.clipboardData) || (root && root.clipboardData);
      if (!clip || typeof clip.getData !== 'function') return;
      var text = '';
      try {
        text = clip.getData('text/plain') || clip.getData('text') || '';
      } catch (e) {
        return;
      }
      if (!text || !text.trim()) return;
      ev.preventDefault();
      els.jsonInput.value = '';
      if (text.length > 200000) {
        setBanner('warning', 'Staging large JSON (' + Math.round(text.length / 1024) + ' KB)...');
      }
      processIncomingInputs([text], computeCanAppend()).then(function (parsed) {
        if (parsed) {
          els.manualPasteDetails.open = false;
        }
      });
    });

    els.clipboardPasteBtn.addEventListener('click', function () {
      var clip = root && root.navigator && root.navigator.clipboard;
      if (!clip || typeof clip.readText !== 'function') {
        els.manualPasteDetails.open = true;
        els.jsonInput.focus();
        setBanner('warning', 'Direct clipboard read is unsupported here — press Ctrl+V (or \u2318V) inside the box below.');
        return;
      }
      clip.readText().then(function (text) {
        if (!text || !String(text).trim()) {
          setBanner('warning', 'Your clipboard is empty. Open the raw data tab and copy everything (Ctrl+A, Ctrl+C) first.');
          return;
        }
        processIncomingInputs([String(text)], computeCanAppend());
      }).catch(function () {
        els.manualPasteDetails.open = true;
        els.jsonInput.focus();
        setBanner('warning', 'Browser blocked clipboard access — click inside the box below and press Ctrl+V (or \u2318V).');
      });
    });

    els.openEmoteListBtn.addEventListener('click', function (ev) {
      openSteamTarget('emotelist', ev);
    });

    els.emoteLoginBtn.addEventListener('click', function (ev) {
      openSteamTarget('login', ev);
    });

    els.stdLoginBtn.addEventListener('click', function (ev) {
      openSteamTarget('login', ev);
    });

    els.openSteamInvBtn.addEventListener('click', function (ev) {
      openSteamTarget('json', ev);
    });

    els.wizardNextBtn.addEventListener('click', function (ev) {
      openSteamTarget('next', ev);
    });

    els.switchAutosyncBtn.addEventListener('click', function () {
      selectTab(1, true);
    });

    els.jsonInput.addEventListener('input', function () {
      setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', '');
    });

    els.parsePasteBtn.addEventListener('click', function () {
      var raw = els.jsonInput.value.trim();
      if (!raw) {
        setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', 'Paste inventory JSON before staging.');
        announce('Paste inventory JSON before staging.');
        els.jsonInput.focus();
        return;
      }
      processIncomingInputs([raw], computeCanAppend()).then(function (parsed) {
        if (parsed) {
          els.jsonInput.value = '';
          els.manualPasteDetails.open = false;
        }
      });
    });

    els.clearPasteBtn.addEventListener('click', function () {
      els.jsonInput.value = '';
      setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', '');
      els.jsonInput.focus();
    });

    els.resetSessionBtn.addEventListener('click', function () {
      var keyToClear = getScopeKey();
      var prevSaved = state.lastSavedScopeKey;
      state.rawPages = [];
      state.parsedPages = [];
      state.parsedResult = null;
      state.restoredSession = false;
      state.lastSavedScopeKey = null;
      els.jsonInput.value = '';
      clearImportSession(keyToClear);
      if (prevSaved && prevSaved !== keyToClear) {
        clearImportSession(prevSaved);
      }
      renderWizardState();
      setBanner('warning', 'Cleared staged pages.');
    });

    function handleFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      if (files.length === 0) return;
      Promise.all(files.map(function (file) {
        return new Promise(function (resolve, reject) {
          var reader = new root.FileReader();
          reader.onload = function () {
            resolve(String(reader.result || ''));
          };
          reader.onerror = function () {
            reject(new Error('Could not read file ' + file.name));
          };
          reader.readAsText(file);
        });
      })).then(function (texts) {
        return processIncomingInputs(texts, computeCanAppend());
      }).catch(function (err) {
        setBanner('error', err && err.message ? err.message : 'Failed reading dropped file(s).');
      });
    }

    els.fileInput.addEventListener('change', function () {
      handleFiles(els.fileInput.files);
      els.fileInput.value = '';
    });

    els.dropzone.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      els.dropzone.classList.add('is-dragover');
    });

    els.dropzone.addEventListener('dragleave', function () {
      els.dropzone.classList.remove('is-dragover');
    });

    els.dropzone.addEventListener('drop', function (ev) {
      ev.preventDefault();
      els.dropzone.classList.remove('is-dragover');
      if (ev.dataTransfer && ev.dataTransfer.files) {
        handleFiles(ev.dataTransfer.files);
      }
    });

    els.bmAnchor.addEventListener('click', function (ev) {
      ev.preventDefault();
      setBanner(
        'warning',
        'Don\'t click this pill here — drag it up to your browser\'s Bookmarks Bar first (press Ctrl+Shift+B / \u2318+Shift+B to show the bar).'
      );
    });

    els.openPopupBtn.addEventListener('click', function (ev) {
      openSteamTarget('tab', ev);
    });

    els.copyBmBtn.addEventListener('click', function () {
      var href = els.bmAnchor.getAttribute('href') || '';
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
        root.navigator.clipboard.writeText(href).then(function () {
          reportCopyStatus(true, 'Copied');
          setBanner('success', 'Copied bookmarklet URL. Create a new bookmark and paste it into the URL field (not the address bar).');
        }).catch(function () {
          reportCopyStatus(false, 'Copy failed');
          setBanner('warning', 'Clipboard access denied — drag the green pill directly to your Bookmarks Bar instead.');
        });
      } else {
        reportCopyStatus(false, 'Drag pill');
        setBanner('warning', 'Drag the green pill directly to your Bookmarks Bar.');
      }
    });

    // Verified postMessage listener from Steam Community tab (strictly requires https://steamcommunity.com origin)
    root.addEventListener('message', function (ev) {
      if (ev.origin !== 'https://steamcommunity.com') return;
      var fromOpenedTab = state.popupRef && ev.source === state.popupRef;
      if (!fromOpenedTab && !dlg.open) return;
      var msg = ev.data;
      if (!msg || typeof msg !== 'object' || msg.type !== 'STEAMTOOLS_INVENTORY_IMPORT') return;
      if (!Array.isArray(msg.pages) || msg.pages.length === 0) return;

      safeStorageSet(METHOD_STORAGE_KEY, 'bookmarklet');

      if (msg.steamid && /^\d{17}$/.test(String(msg.steamid))) {
        els.steamIdInput.value = String(msg.steamid);
        state.resolvedSteamId = String(msg.steamid);
        els.steamIdHint.textContent = DEFAULT_STEAMID_HINT;
      }

      processIncomingInputs(msg.pages, false, { sourceLabel: 'bookmarklet' }).then(function (parsed) {
        if (!parsed) return;
        if (msg.partial && msg.error) {
          selectTab(0, false, { skipPersist: true });
          setBanner('warning', 'Partial sync received (' + msg.error + '). Staged ' + parsed.asset_count + ' items — review and click Apply.');
        } else if (!els.applyBtn.disabled && dlg.open) {
          dlg.close('apply');
        }
      });
    });

    _dialogInstance = {
      els: els,
      selectTab: selectTab,
      open: function (options, onImportCb) {
        var opts = Object.assign({}, options || {});
        if (typeof onImportCb === 'function') {
          opts.onImport = onImportCb;
        }
        state.options = opts;
        state.rawPages = [];
        state.parsedPages = [];
        state.parsedResult = null;
        state.restoredSession = false;
        state.lastSavedScopeKey = null;
        if (state.inputResolveTimer) {
          clearTimeout(state.inputResolveTimer);
          state.inputResolveTimer = null;
        }

        var defaultTitle = opts.appid ? ('Import Inventory for ' + getAppDisplayName(opts.appid)) : 'Import Steam Inventory';
        els.title.textContent = opts.title || defaultTitle;
        els.subtitle.textContent = opts.subtitle ||
          'Processed locally in your browser \u2014 nothing is sent to our servers.';

        if (opts.lockApp === false) {
          els.appSelect.hidden = false;
          var targetApp = String(opts.appid || '753');
          if (Array.prototype.some.call(els.appSelect.options, function (o) { return o.value === targetApp; })) {
            els.appSelect.value = targetApp;
          }
        } else {
          els.appSelect.hidden = true;
        }

        els.jsonLabel.textContent = opts.mode === 'emotes'
          ? 'Steam EmoticonList or Inventory JSON'
          : 'Steam Inventory JSON';
        els.jsonInput.value = '';
        els.manualPasteDetails.open = false;
        els.steamIdInput.value = opts.steamId ? String(opts.steamId).trim() : '';
        state.resolvedSteamId = '';
        state.resolveSeq++;
        els.steamIdHint.textContent = DEFAULT_STEAMID_HINT;
        setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', '');
        setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', '');
        setBanner(null, '');

        syncModeLayout(false);

        var savedMethod = safeStorageGet(METHOD_STORAGE_KEY);
        var startTab = (!shouldPreferPasteTab(opts) && savedMethod === 'bookmarklet') ? 1 : 0;
        selectTab(startTab, false, { skipPersist: true });

        refreshBookmarklet();
        renderWizardState();

        dlg.showModal();

        var parsedInitial = parseSteamInput(els.steamIdInput.value);
        if (parsedInitial.vanity && !parsedInitial.steamid64 && !parsedInitial.invalid) {
          var syncCached = _resolvedVanityCache.get(parsedInitial.vanity.toLowerCase()) || '';
          if (syncCached) {
            state.resolvedSteamId = syncCached;
            updateSteamLinks();
          }
        }

        if (startTab === 1 && typeof els.openPopupBtn.focus === 'function') {
          els.openPopupBtn.focus();
        } else if (opts.mode === 'emotes' && typeof els.openEmoteListBtn.focus === 'function') {
          els.openEmoteListBtn.focus();
        } else if (getEffectiveSteamId() && typeof els.openSteamInvBtn.focus === 'function') {
          els.openSteamInvBtn.focus();
        } else if (typeof els.steamIdInput.focus === 'function') {
          els.steamIdInput.focus();
        }

        var resolvePromise = els.steamIdInput.value
          ? resolveInputNow(false)
          : Promise.resolve({ ok: true, steamid64: '' });

        if (opts.initialJson) {
          var initStr = String(opts.initialJson);
          processIncomingInputs([initStr], false, {
            bannerOverride: 'Detected inventory JSON pasted into the SteamID field — staged items automatically!'
          });
          return;
        }

        var rawFallbackKey = getScopeKey();
        resolvePromise.then(function () {
          var primaryKey = getScopeKey();
          return loadImportSession(primaryKey).then(function (saved) {
            if (saved || primaryKey === rawFallbackKey) return { saved: saved, key: primaryKey };
            return loadImportSession(rawFallbackKey).then(function (fallbackSaved) {
              return { saved: fallbackSaved, key: rawFallbackKey };
            });
          });
        }).then(function (found) {
          var saved = found && found.saved;
          if (saved && Array.isArray(saved.rawPages) && saved.rawPages.length > 0 && state.rawPages.length === 0) {
            state.lastSavedScopeKey = found.key;
            if (saved.steamId && !els.steamIdInput.value) {
              els.steamIdInput.value = String(saved.steamId);
              resolveInputNow(false);
            }
            if (opts.mode === 'emotes' && saved.steamId) {
              els.emoteAltDetails.open = true;
            }
            processIncomingInputs(saved.rawPages, false, { restored: true });
          }
        });
      }
    };

    return _dialogInstance;
  }

  function openImportDialog(options, onImport) {
    if (!root || !root.document) {
      throw new Error('openImportDialog requires a browser DOM.');
    }
    var inst = ensureDialogDom();
    inst.open(options, onImport);
    return inst;
  }

  return {
    quoteSteamKey: workerMod.quoteSteamKey,
    fnv1a32: workerMod.fnv1a32,
    fnv1a32Hex2: workerMod.fnv1a32Hex2,
    fnv1a32Hex64: workerMod.fnv1a32Hex64,
    parseAssetAmount: workerMod.parseAssetAmount,
    sanitizeEmoteName: workerMod.sanitizeEmoteName,
    parseInventoryPayload: workerMod.parseInventoryPayload,
    parseInWorkerOrSync: parseInWorkerOrSync,
    valueInventoryClientSide: valueInventoryClientSide,
    priceServerItemValuePayload: priceServerItemValuePayload,
    clearPriceCache: clearPriceCache,
    parseSteamInput: parseSteamInput,
    resolveToSteamId64: resolveToSteamId64,
    buildBookmarkletCode: buildBookmarkletCode,
    buildBookmarkletHref: buildBookmarkletHref,
    buildSteamInventoryUrl: buildSteamInventoryUrl,
    getAllowedOpenerOrigin: getAllowedOpenerOrigin,
    saveImportSession: saveImportSession,
    loadImportSession: loadImportSession,
    clearImportSession: clearImportSession,
    openImportDialog: openImportDialog
  };
});
