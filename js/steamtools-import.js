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
   * Strictly checks opener presence and posts ONLY to baked opener origin (never '*').
   */
  function buildBookmarkletCode(options) {
    var opts = options || {};
    var cfg = getConfig();
    var origin = getAllowedOpenerOrigin(opts.origin);
    var appid = String(opts.appid || '753').replace(/[^\d]/g, '') || '753';
    var contextid = String(opts.contextid || cfg.getContextId(appid)).replace(/[^\d]/g, '') || '6';
    var lockApp = opts.lockApp === false ? '0' : '1';
    var qOrigin = "'" + origin + "'";
    var qApp = "'" + appid + "'";
    var qCtx = "'" + contextid + "'";

    return (
      "(function(){" +
      "var O=" + qOrigin + ",A=" + qApp + ",C=" + qCtx + ",S=window,D=S.opener,P=[],T='',M=1,N=0,R=0;" +
      "if(location.origin!=='https://steamcommunity.com')return alert('Open https://steamcommunity.com first.');" +
      "if(!D||D.closed)return alert('Launch from SteamTools Import first.');" +
      "if(!" + lockApp + "){var h=location.hash.match(/(\\d+)(?:_(\\d+))?/);if(h){A=h[1];C=h[2]||(A==='753'?'6':A==='322330'?'1':'2');}}" +
      "var I=(/\\/profiles\\/(\\d{17})/.exec(location.pathname)||[])[1]||(S.g_rgProfileData&&S.g_rgProfileData.steamid)||S.g_steamID||'';" +
      "function post(p,i,e){D.postMessage({type:'STEAMTOOLS_INVENTORY_IMPORT',appid:A,contextid:C,steamid:i,pages:p,partial:!!e,error:e||''},O);}" +
      "function go(i){" +
      "if(!/^\\d{17}$/.test(i))return alert('Sign into Steam first.');" +
      "(function step(){" +
      "if(!M||N++>=25){post(P,i,'');return alert('Sent '+P.length+' page(s) to SteamTools.');}" +
      "fetch('https://steamcommunity.com/inventory/'+i+'/'+A+'/'+C+'?l=english&count=2000'+(T?'&start_assetid='+encodeURIComponent(T):''),{credentials:'include'})" +
      ".then(function(r){if(r.status===429&&!R){R=1;return new Promise(function(ok){setTimeout(function(){ok('RETRY');},2500);});}R=0;if(!r.ok)throw Error('HTTP '+r.status);return r.json();})" +
      ".then(function(d){if(d==='RETRY')return step();if(!d||d.success===0)throw Error((d&&d.error)||'Unavailable');P.push(d);M=d.more_items&&d.last_assetid;T=M||'';if(M)setTimeout(step,600);else step();})" +
      ".catch(function(e){if(P.length){post(P,i,e.message);alert('Partial import ('+P.length+' page(s)): '+e.message);}else alert('SteamTools error: '+e.message);});" +
      "})();}" +
      "if(I)go(I);else fetch('https://steamcommunity.com/my/?xml=1',{credentials:'include'}).then(function(r){return r.text();}).then(function(t){" +
      "var m=/<steamID64>(\\d{17})<\\/steamID64>/.exec(t);go(m?m[1]:'');}).catch(function(){alert('Cannot detect SteamID64.');});" +
      "})();"
    );
  }

  function buildBookmarkletHref(options) {
    return 'javascript:' + encodeURI(buildBookmarkletCode(options));
  }

  // ---- CDN Valuation with FNV-1a 753 Buckets & Explicit HTTP 404 Fallback ----
  var _priceFileCache = new Map();
  var _753MonolithPromise = null;

  function clearPriceCache() {
    _priceFileCache.clear();
    _753MonolithPromise = null;
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

  function fetch753Monolith(cdnBase, fetchImpl) {
    if (_753MonolithPromise) return _753MonolithPromise;
    _753MonolithPromise = fetchDatasetViaConfig('value/753.json', cdnBase, fetchImpl).catch(function (err) {
      _753MonolithPromise = null;
      throw err;
    });
    return _753MonolithPromise;
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

    if (appStr !== '753' || cfg.USE_753_BUCKETS === false) {
      return fetchDatasetViaConfig('value/' + encodeURIComponent(appStr) + '.json', cdnBase, fetchImpl)
        .then(function (priceMap) {
          return {
            items: applyPriceLookup(priceMap),
            usedBucketFallback: appStr === '753',
            bucketsFetched: []
          };
        });
    }

    var bucketSet = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var b = list[i].bucket || workerMod.fnv1a32Hex2(list[i].quoted_key);
      bucketSet[b] = true;
    }
    var buckets = Object.keys(bucketSet).sort();
    if (buckets.length > 96) {
      return fetch753Monolith(cdnBase, fetchImpl).then(function (monolith) {
        return {
          items: applyPriceLookup(monolith),
          usedBucketFallback: true,
          bucketsFetched: []
        };
      });
    }
    var mergedPrices = Object.create(null);

    return runWithConcurrency(buckets, 8, function (hex2) {
      return fetchDatasetViaConfig('value/753/' + hex2 + '.json', cdnBase, fetchImpl).then(function (map) {
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
      // Strictly fall back to value/753.json ONLY when bucket file returns 404.
      if (err && err.status === 404) {
        return fetch753Monolith(cdnBase, fetchImpl).then(function (monolith) {
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
    var list = Array.isArray(items) ? items : [];
    var normalized = new Array(list.length);
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var qk = it.quoted_key || workerMod.quoteSteamKey(it.market_hash_name || it.name || '');
      var bucket = it.bucket || (String(appid || '753') === '753' && qk ? workerMod.fnv1a32Hex2(qk) : undefined);
      normalized[i] = bucket
        ? Object.assign({}, it, { quoted_key: qk, bucket: bucket })
        : Object.assign({}, it, { quoted_key: qk });
    }
    return valueInventoryClientSide(
      normalized,
      appid,
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
  var _dialogInstance = null;

  function ensureDialogDom() {
    if (_dialogInstance) return _dialogInstance;
    var doc = root.document;

    var dlg = doc.createElement('dialog');
    dlg.className = 'st-import-dialog';
    dlg.setAttribute('closedby', 'any');
    dlg.setAttribute('aria-labelledby', 'st-import-title');

    dlg.innerHTML = [
      '<div class="st-import-header">',
      '  <h2 class="st-import-title" id="st-import-title">Import Steam Inventory</h2>',
      '  <button type="button" class="st-import-close" id="st-import-close-btn" aria-label="Close import dialog">&times;</button>',
      '</div>',
      '<div class="st-import-body">',
      '  <p class="st-import-subtitle" id="st-import-subtitle">Bypass rate limits cleanly without captchas by importing directly from your browser session.</p>',
      '  <div class="st-field-group">',
      '    <label class="st-label" for="st-import-steamid">SteamID64, Custom URL, or Profile Link (optional)</label>',
      '    <div class="st-field-row">',
      '      <input type="text" id="st-import-steamid" class="st-input" style="max-width:300px" placeholder="7656119..., custom URL, or profile link" autocorrect="off" autocapitalize="none" spellcheck="false" aria-invalid="false" aria-describedby="st-import-steamid-hint" data-error="st-import-steamid-err">',
      '      <a id="st-open-steam-inv-link" class="st-btn" href="https://steamcommunity.com/my/inventory/" target="_blank" rel="noopener noreferrer">Open My Steam Inventory</a>',
      '    </div>',
      '    <p class="st-hint" id="st-import-steamid-hint">' + DEFAULT_STEAMID_HINT + '</p>',
      '    <p class="st-error-msg" id="st-import-steamid-err" hidden></p>',
      '  </div>',
      '  <div class="st-import-tabs" role="tablist" aria-label="Import methods">',
      '    <button type="button" class="st-tab-btn" role="tab" id="st-tab-paste" aria-selected="true" tabindex="0">Paste JSON</button>',
      '    <button type="button" class="st-tab-btn" role="tab" id="st-tab-drop" aria-selected="false" tabindex="-1">Drop .json Files</button>',
      '    <button type="button" class="st-tab-btn" role="tab" id="st-tab-bookmarklet" aria-selected="false" tabindex="-1">Bookmarklet Sync</button>',
      '  </div>',
      '  <div class="st-tabpanel" role="tabpanel" id="st-panel-paste" aria-labelledby="st-tab-paste">',
      '    <div class="st-field-group">',
      '      <label class="st-label" for="st-import-json-input" id="st-import-json-label">Steam Inventory or EmoticonList JSON</label>',
      '      <p class="st-hint" id="st-import-json-hint">Paste one or more JSON responses saved from Steam Community (CTRL+A then CTRL+C).</p>',
      '      <p class="st-hint" id="st-emotes-direct-row" hidden>Tip for emotes: open <a href="https://steamcommunity.com/actions/EmoticonList" target="_blank" rel="noopener noreferrer" class="st-url-link">steamcommunity.com/actions/EmoticonList</a> while signed into Steam, copy all (CTRL+A, CTRL+C), and paste below.</p>',
      '      <textarea id="st-import-json-input" class="st-textarea" placeholder=\'{"assets":[...],"descriptions":[...],"more_items":0}\' autocorrect="off" autocapitalize="none" spellcheck="false" aria-invalid="false" aria-describedby="st-import-json-hint" data-error="st-import-json-err"></textarea>',
      '      <p class="st-error-msg" id="st-import-json-err" hidden></p>',
      '      <div class="st-field-row">',
      '        <button type="button" class="st-btn st-btn-primary" id="st-parse-paste-btn">Parse &amp; Stage Page</button>',
      '        <button type="button" class="st-btn" id="st-clear-paste-btn">Clear Box</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="st-tabpanel" role="tabpanel" id="st-panel-drop" aria-labelledby="st-tab-drop" hidden>',
      '    <div class="st-dropzone" id="st-import-dropzone">',
      '      <input type="file" id="st-import-file-input" class="st-visually-hidden" multiple accept=".json,application/json,text/plain">',
      '      <label for="st-import-file-input" class="st-dropzone-label">Choose .json file(s)</label>',
      '      <p class="st-hint">Or drag and drop multiple page JSON files here. Duplicate asset IDs across pages are merged safely.</p>',
      '    </div>',
      '  </div>',
      '  <div class="st-tabpanel" role="tabpanel" id="st-panel-bookmarklet" aria-labelledby="st-tab-bookmarklet" hidden>',
      '    <div class="st-bookmarklet-box">',
      '      <p class="st-hint" id="st-bm-steps">1. Drag the pill below to your bookmarks bar once. 2. Click Open Steam Popup. 3. Click the bookmarklet on Steam to stream all pages automatically back here.</p>',
      '      <div class="st-field-row">',
      '        <a id="st-bookmarklet-anchor" class="st-bookmarklet-pill" href="javascript:void(0)">SteamTools Sync Bookmarklet</a>',
      '        <button type="button" class="st-btn st-btn-primary" id="st-open-popup-btn">Open Steam Popup</button>',
      '        <button type="button" class="st-btn" id="st-copy-bm-btn">Copy Bookmarklet URL</button>',
      '      </div>',
      '      <details>',
      '        <summary id="st-bm-code-label">Inspect Bookmarklet Source (<span id="st-bm-size">0</span> bytes, under 2 KB limit)</summary>',
      '        <pre class="st-bookmarklet-code" role="region" aria-labelledby="st-bm-code-label" tabindex="0"><code id="st-bm-code-text"></code></pre>',
      '      </details>',
      '    </div>',
      '  </div>',
      '  <div class="st-wizard-box" id="st-wizard-box" hidden>',
      '    <p class="st-wizard-status" id="st-wizard-status"></p>',
      '    <div class="st-field-row" id="st-wizard-next-row" hidden>',
      '      <span>Next Steam page URL:</span>',
      '      <a id="st-wizard-next-link" class="st-url-link" href="#" target="_blank" rel="noopener noreferrer">Open Next Page</a>',
      '    </div>',
      '  </div>',
      '  <p class="st-status-banner" id="st-status-banner" hidden></p>',
      '  <div id="st-import-live" class="st-visually-hidden" aria-live="polite" aria-atomic="true"></div>',
      '</div>',
      '<div class="st-import-footer">',
      '  <button type="button" class="st-btn st-btn-danger" id="st-reset-session-btn" hidden>Reset Staged Pages</button>',
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
      subtitle: dlg.querySelector('#st-import-subtitle'),
      closeBtn: dlg.querySelector('#st-import-close-btn'),
      steamIdInput: dlg.querySelector('#st-import-steamid'),
      steamIdHint: dlg.querySelector('#st-import-steamid-hint'),
      steamIdErr: dlg.querySelector('#st-import-steamid-err'),
      openSteamInvLink: dlg.querySelector('#st-open-steam-inv-link'),
      tabs: Array.prototype.slice.call(dlg.querySelectorAll('.st-tab-btn')),
      panels: Array.prototype.slice.call(dlg.querySelectorAll('.st-tabpanel')),
      jsonLabel: dlg.querySelector('#st-import-json-label'),
      emotesDirectRow: dlg.querySelector('#st-emotes-direct-row'),
      jsonInput: dlg.querySelector('#st-import-json-input'),
      jsonErr: dlg.querySelector('#st-import-json-err'),
      parsePasteBtn: dlg.querySelector('#st-parse-paste-btn'),
      clearPasteBtn: dlg.querySelector('#st-clear-paste-btn'),
      dropzone: dlg.querySelector('#st-import-dropzone'),
      fileInput: dlg.querySelector('#st-import-file-input'),
      bmAnchor: dlg.querySelector('#st-bookmarklet-anchor'),
      openPopupBtn: dlg.querySelector('#st-open-popup-btn'),
      copyBmBtn: dlg.querySelector('#st-copy-bm-btn'),
      bmSize: dlg.querySelector('#st-bm-size'),
      bmCodeText: dlg.querySelector('#st-bm-code-text'),
      wizardBox: dlg.querySelector('#st-wizard-box'),
      wizardStatus: dlg.querySelector('#st-wizard-status'),
      wizardNextRow: dlg.querySelector('#st-wizard-next-row'),
      wizardNextLink: dlg.querySelector('#st-wizard-next-link'),
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
      popupRef: null,
      lastFocused: null,
      liveTimer: null,
      downOutside: false,
      resolvedSteamId: '',
      resolveSeq: 0
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
        clearInline.textContent = 'Clear';
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

    function selectTab(tabIndex, focusTab) {
      if (!els.tabs || els.tabs.length === 0) return;
      var idx = ((tabIndex % els.tabs.length) + els.tabs.length) % els.tabs.length;
      for (var i = 0; i < els.tabs.length; i++) {
        var active = i === idx;
        els.tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
        els.tabs[i].setAttribute('tabindex', active ? '0' : '-1');
        els.panels[i].hidden = !active;
      }
      if (focusTab && typeof els.tabs[idx].focus === 'function') {
        els.tabs[idx].focus();
      }
      if (typeof els.tabs[idx].scrollIntoView === 'function') {
        try {
          els.tabs[idx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch (e) {
          // Ignore scrollIntoView unsupported option objects.
        }
      }
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

    function getEffectiveSteamId() {
      if (/^\d{17}$/.test(state.resolvedSteamId)) {
        return state.resolvedSteamId;
      }
      return parseSteamInput(els.steamIdInput.value).steamid64;
    }

    function updateSteamLinks() {
      var opts = state.options || {};
      var appid = String(opts.appid || '753');
      var ctx = String(opts.contextid || getConfig().getContextId(appid));
      var parsed = parseSteamInput(els.steamIdInput.value);
      var sid = /^\d{17}$/.test(state.resolvedSteamId) ? state.resolvedSteamId : parsed.steamid64;

      if (sid) {
        els.openSteamInvLink.href = buildSteamInventoryUrl(sid, appid, ctx, null);
      } else if (parsed.vanity) {
        els.openSteamInvLink.href = 'https://steamcommunity.com/id/' +
          encodeURIComponent(parsed.vanity) + '/inventory/#' + encodeURIComponent(appid);
      } else {
        els.openSteamInvLink.href = 'https://steamcommunity.com/my/inventory/#' + encodeURIComponent(appid);
      }

      if (state.parsedResult && state.parsedResult.more_items && state.parsedResult.last_assetid && sid) {
        var nextUrl = buildSteamInventoryUrl(sid, appid, ctx, state.parsedResult.last_assetid);
        els.wizardNextLink.href = nextUrl;
        els.wizardNextLink.textContent = nextUrl;
        els.wizardNextRow.hidden = false;
      } else if (state.parsedResult && state.parsedResult.more_items && state.parsedResult.last_assetid) {
        els.wizardNextRow.hidden = false;
        els.wizardNextLink.href = parsed.vanity
          ? ('https://steamcommunity.com/id/' + encodeURIComponent(parsed.vanity) + '/inventory/#' + encodeURIComponent(appid))
          : ('https://steamcommunity.com/my/inventory/#' + encodeURIComponent(appid));
        els.wizardNextLink.textContent = 'Enter your SteamID64 or custom URL above to build next page link (start_assetid=' + state.parsedResult.last_assetid + ')';
      } else {
        els.wizardNextRow.hidden = true;
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

    function renderWizardState() {
      var res = state.parsedResult;
      if (!res) {
        els.wizardBox.hidden = true;
        els.resetSessionBtn.hidden = true;
        els.applyBtn.disabled = true;
        updateSteamLinks();
        return;
      }

      els.resetSessionBtn.hidden = state.rawPages.length === 0;

      if (res.isEmoticonList && res.isEmptyArray) {
        els.wizardBox.hidden = true;
        els.applyBtn.disabled = true;
        setBanner(
          'warning',
          'Steam returned [] (no emoticons found). Make sure you are logged into steamcommunity.com in this browser, or import your 753/6 Steam inventory JSON instead.'
        );
        return;
      }

      els.wizardBox.hidden = false;
      els.applyBtn.disabled = false;

      if (res.isEmoticonList) {
        els.wizardStatus.textContent = 'Ready: extracted ' + res.emoticons.length + ' unique emoticon(s).';
      } else {
        var pageSummary = 'Staged ' + res.page_count + ' page(s), ' + res.asset_count + ' asset(s)';
        if (res.total_inventory_count) {
          pageSummary += ' of ' + res.total_inventory_count + ' total';
        }
        if (res.more_items && res.last_assetid) {
          pageSummary += '. Steam has more pages — open the next page URL below, or apply what you have staged so far.';
        } else {
          pageSummary += '. All pages loaded!';
        }
        els.wizardStatus.textContent = pageSummary;
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
      els.bmCodeText.textContent = code;
      els.bmSize.textContent = String(href.length);
    }

    function decodeIncomingPage(item) {
      if (typeof item !== 'string') return item;
      var trimmed = item.trim();
      if (trimmed && trimmed.charCodeAt(0) === 0xFEFF) {
        trimmed = trimmed.slice(1).trim();
      }
      if (!trimmed) return item;
      if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
        return JSON.parse(trimmed);
      }
      return item;
    }

    function processIncomingInputs(newInputs, appendToSession, parseOpts) {
      setBanner(null, '');
      setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', '');
      var isRestored = Boolean(parseOpts && parseOpts.restored);

      var decodedNew = [];
      try {
        for (var p = 0; p < newInputs.length; p++) {
          decodedNew.push(decodeIncomingPage(newInputs[p]));
        }
      } catch (jsonErr) {
        var jsonMsg = 'Invalid JSON input: ' + (jsonErr && jsonErr.message ? jsonErr.message : 'parse error');
        setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', jsonMsg);
        setBanner('error', jsonMsg);
        announce(jsonMsg);
        return Promise.resolve(null);
      }

      var payloadList = appendToSession ? state.rawPages.concat(newInputs) : newInputs;
      var parsedList = appendToSession ? state.parsedPages.concat(decodedNew) : decodedNew;
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
        state.rawPages = payloadList;
        state.parsedPages = parsedList;
        state.parsedResult = result;
        state.restoredSession = isRestored;
        renderWizardState();
        saveImportSession({
          scopeKey: getScopeKey(),
          rawPages: state.rawPages,
          steamId: getEffectiveSteamId() || String(els.steamIdInput.value || '').trim(),
          updatedAt: Date.now()
        });
        if (isRestored) {
          setBanner(
            'warning',
            'Restored staged session (' + result.page_count + ' page(s), ' +
              result.asset_count + ' item(s)).',
            { showClear: true }
          );
        } else if (!result.isEmoticonList) {
          setBanner('success', 'Parsed ' + result.asset_count + ' asset(s) across ' + result.page_count + ' page(s).');
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

    els.closeBtn.addEventListener('click', function () {
      dlg.close('cancel');
    });

    els.cancelBtn.addEventListener('click', function () {
      dlg.close('cancel');
    });

    els.applyBtn.addEventListener('click', function () {
      if (!state.parsedResult) return;
      dlg.close('apply');
    });

    dlg.addEventListener('close', function () {
      var rv = dlg.returnValue;
      dlg.returnValue = '';
      var callback = state.options && state.options.onImport;
      var result = state.parsedResult;
      if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
        try {
          state.lastFocused.focus();
        } catch (e) {
          // Ignore focus failures on detached elements
        }
      }
      if (rv === 'apply' && typeof callback === 'function' && result) {
        if (!result.more_items) {
          state.rawPages = [];
          state.parsedPages = [];
          state.parsedResult = null;
          state.restoredSession = false;
          clearImportSession(getScopeKey());
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

    els.steamIdInput.addEventListener('blur', function () {
      resolveInputNow(true);
    });

    els.steamIdInput.addEventListener('input', function () {
      state.resolveSeq++;
      var parsed = parseSteamInput(els.steamIdInput.value);
      state.resolvedSteamId = parsed.steamid64 || '';
      els.steamIdHint.textContent = DEFAULT_STEAMID_HINT;
      setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', '');
      updateSteamLinks();
    });

    els.jsonInput.addEventListener('input', function () {
      setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', '');
    });

    els.parsePasteBtn.addEventListener('click', function () {
      var raw = els.jsonInput.value.trim();
      if (!raw) {
        setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', 'Paste inventory JSON before parsing.');
        announce('Paste inventory JSON before parsing.');
        els.jsonInput.focus();
        return;
      }
      var canAppend = !state.restoredSession && state.rawPages.length > 0 && state.parsedResult && state.parsedResult.more_items;
      processIncomingInputs([raw], Boolean(canAppend));
    });

    els.clearPasteBtn.addEventListener('click', function () {
      els.jsonInput.value = '';
      setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', '');
      els.jsonInput.focus();
    });

    els.resetSessionBtn.addEventListener('click', function () {
      state.rawPages = [];
      state.parsedPages = [];
      state.parsedResult = null;
      state.restoredSession = false;
      els.jsonInput.value = '';
      clearImportSession(getScopeKey());
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
        var canAppend = !state.restoredSession && state.rawPages.length > 0 && state.parsedResult && state.parsedResult.more_items;
        return processIncomingInputs(texts, Boolean(canAppend));
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

    els.openPopupBtn.addEventListener('click', function () {
      var parsed = parseSteamInput(els.steamIdInput.value);
      var sid = /^\d{17}$/.test(state.resolvedSteamId) ? state.resolvedSteamId : parsed.steamid64;
      var url = sid
        ? 'https://steamcommunity.com/profiles/' + encodeURIComponent(sid) + '/inventory/'
        : (parsed.vanity
            ? 'https://steamcommunity.com/id/' + encodeURIComponent(parsed.vanity) + '/inventory/'
            : 'https://steamcommunity.com/my/inventory/');
      // Open WITHOUT noopener so window.opener remains intact for same-session postMessage.
      state.popupRef = root.open(url, 'SteamToolsImportPopup', 'width=980,height=740,resizable=yes,scrollbars=yes');
      if (!state.popupRef) {
        setBanner('error', 'Popup blocked by browser. Allow popups for this site and try again.');
      } else {
        setBanner('success', 'Opened Steam Community popup. Click your SteamTools Sync bookmarklet in that popup window.');
      }
    });

    els.copyBmBtn.addEventListener('click', function () {
      var href = els.bmAnchor.getAttribute('href') || '';
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
        root.navigator.clipboard.writeText(href).then(function () {
          setBanner('success', 'Copied bookmarklet URI (' + href.length + ' chars) to clipboard.');
        }).catch(function () {
          setBanner('warning', 'Clipboard access denied; drag the green pill to your bookmarks bar instead.');
        });
      } else {
        setBanner('warning', 'Drag the green pill directly to your browser bookmarks bar.');
      }
    });

    // Strict verified postMessage listener from Steam Community popup ONLY
    root.addEventListener('message', function (ev) {
      if (ev.origin !== 'https://steamcommunity.com') return;
      if (!state.popupRef || ev.source !== state.popupRef) return;
      var msg = ev.data;
      if (!msg || typeof msg !== 'object' || msg.type !== 'STEAMTOOLS_INVENTORY_IMPORT') return;
      if (!Array.isArray(msg.pages) || msg.pages.length === 0) return;

      if (msg.steamid && /^\d{17}$/.test(String(msg.steamid))) {
        els.steamIdInput.value = String(msg.steamid);
        state.resolvedSteamId = String(msg.steamid);
        els.steamIdHint.textContent = DEFAULT_STEAMID_HINT;
      }
      selectTab(0);
      processIncomingInputs(msg.pages, false).then(function (parsed) {
        if (parsed && msg.partial && msg.error) {
          setBanner('warning', 'Partial import received (' + msg.error + '). Staged ' + parsed.asset_count + ' items.');
        } else if (parsed) {
          setBanner('success', 'Received ' + parsed.page_count + ' page(s) via Bookmarklet! Click "Apply Imported Items".');
        }
      });
    });

    _dialogInstance = {
      els: els,
      selectTab: selectTab,
      open: function (options) {
        state.options = options || {};
        state.rawPages = [];
        state.parsedPages = [];
        state.parsedResult = null;
        state.restoredSession = false;
        state.lastFocused = doc.activeElement;

        els.title.textContent = state.options.title || 'Import Steam Inventory';
        els.subtitle.textContent = state.options.subtitle ||
          'Import directly from Steam Community JSON without captchas or server rate limits.';
        els.jsonLabel.textContent = state.options.mode === 'emotes'
          ? 'Steam Inventory (753/6) or EmoticonList JSON'
          : 'Steam Inventory JSON';
        els.jsonInput.value = '';
        els.steamIdInput.value = state.options.steamId ? String(state.options.steamId).trim() : '';
        state.resolvedSteamId = '';
        state.resolveSeq++;
        els.steamIdHint.textContent = DEFAULT_STEAMID_HINT;
        els.emotesDirectRow.hidden = state.options.mode !== 'emotes';
        setFieldError(els.steamIdInput, els.steamIdErr, 'st-import-steamid-hint', '');
        setFieldError(els.jsonInput, els.jsonErr, 'st-import-json-hint', '');
        setBanner(null, '');
        selectTab(0);
        refreshBookmarklet();
        renderWizardState();

        dlg.showModal();

        if (els.steamIdInput.value) {
          resolveInputNow(false);
        }

        loadImportSession(getScopeKey()).then(function (saved) {
          if (saved && Array.isArray(saved.rawPages) && saved.rawPages.length > 0 && state.rawPages.length === 0) {
            if (saved.steamId && !els.steamIdInput.value) {
              els.steamIdInput.value = String(saved.steamId);
              resolveInputNow(false);
            }
            processIncomingInputs(saved.rawPages, false, { restored: true });
          }
        });
      }
    };

    return _dialogInstance;
  }

  function openImportDialog(options) {
    if (!root || !root.document) {
      throw new Error('openImportDialog requires a browser DOM.');
    }
    var inst = ensureDialogDom();
    inst.open(options);
    return inst;
  }

  return {
    quoteSteamKey: workerMod.quoteSteamKey,
    fnv1a32: workerMod.fnv1a32,
    fnv1a32Hex2: workerMod.fnv1a32Hex2,
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
    openImportDialog: openImportDialog
  };
});
