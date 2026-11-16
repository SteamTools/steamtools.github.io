(function (root, factory) {
  var exportsObj = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = exportsObj;
  }
  if (root) {
    root.STEAMTOOLS_CONFIG = exportsObj;
    root.SteamToolsConfig = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var DEFAULTS = {
    CDN_BASE: 'https://cdn.steam.tools',
    CDN2_BASE: 'https://cdn2.steam.tools',
    STEAM_ECON_BASE: 'https://community.akamai.steamstatic.com/economy',
    EMOTE_CORS_BASE: 'https://emotes.steam.tools',
    API_BASE: 'https://api.steam.tools',
    API_POOL: ['https://api.steam.tools', 'https://api2.steam.tools'],
    AUTH_BASE: 'https://api.steam.tools',
    GAMES_API_BASE: 'https://api.steam.tools',
    TURNSTILE_SITEKEY: '0x4AAAAAAGCoBDnjdhsVPpPB',
    USE_753_BUCKETS: true
  };

  var TOP_6_APPS = [
    { appid: '753', name: 'Steam', contextid: '6' },
    { appid: '730', name: 'Counter-Strike 2', contextid: '2' },
    { appid: '440', name: 'Team Fortress 2', contextid: '2' },
    { appid: '570', name: 'Dota 2', contextid: '2' },
    { appid: '252490', name: 'Rust', contextid: '2' },
    { appid: '322330', name: "Don't Starve Together", contextid: '1' }
  ];

  var CURRENCY_DATA = [
    { name: 'USD', symbolFormat: '$',     right: false, ratio: 1.0 },
    { name: 'AED', symbolFormat: ' AED',  right: true,  ratio: 3.6772 },
    { name: 'ARS', symbolFormat: 'ARS$',  right: false, ratio: 97.6575 },
    { name: 'AUD', symbolFormat: 'A$ ',   right: false, ratio: 1.3799 },
    { name: 'BRL', symbolFormat: 'R$ ',   right: false, ratio: 5.244 },
    { name: 'CAD', symbolFormat: 'CDN$ ', right: false, ratio: 1.2635 },
    { name: 'CHF', symbolFormat: 'CHF ',  right: false, ratio: 0.9190 },
    { name: 'CLP', symbolFormat: 'CLP$ ', right: false, ratio: 785.5814 },
    { name: 'CNY', symbolFormat: '¥ ',    right: false, ratio: 6.4934 },
    { name: 'COP', symbolFormat: 'COL$ ', right: false, ratio: 3875.5106 },
    { name: 'CRC', symbolFormat: '₡',     right: false, ratio: 624.9128 },
    { name: 'EUR', symbolFormat: '€',     right: true,  ratio: 0.851 },
    { name: 'GBP', symbolFormat: '£',     right: false, ratio: 0.7293 },
    { name: 'HKD', symbolFormat: 'HK$ ',  right: false, ratio: 7.7957 },
    { name: 'IDR', symbolFormat: 'Rp ',   right: false, ratio: 14434.151 },
    { name: 'ILS', symbolFormat: '₪',     right: false, ratio: 3.2308 },
    { name: 'INR', symbolFormat: '₹ ',    right: false, ratio: 74.2201 },
    { name: 'JPY', symbolFormat: '¥ ',    right: false, ratio: 110.2601 },
    { name: 'KRW', symbolFormat: '₩ ',    right: false, ratio: 1171.6164 },
    { name: 'KWD', symbolFormat: ' KD',   right: true,  ratio: 0.3017 },
    { name: 'KZT', symbolFormat: '₸',     right: false, ratio: 427.1962 },
    { name: 'MXN', symbolFormat: 'Mex$ ', right: false, ratio: 20.3632 },
    { name: 'MYR', symbolFormat: 'RM',    right: false, ratio: 4.2012 },
    { name: 'NOK', symbolFormat: ' kr',   right: true,  ratio: 8.8252 },
    { name: 'NZD', symbolFormat: 'NZ$ ',  right: false, ratio: 1.4374 },
    { name: 'PEN', symbolFormat: 'S/.',   right: false, ratio: 4.1061 },
    { name: 'PHP', symbolFormat: 'P',     right: false, ratio: 50.0509 },
    { name: 'PLN', symbolFormat: 'zł',    right: true,  ratio: 3.8976 },
    { name: 'QAR', symbolFormat: ' QR',   right: true,  ratio: 3.6456 },
    { name: 'RUB', symbolFormat: ' pуб.', right: true,  ratio: 74.4343 },
    { name: 'SAR', symbolFormat: ' SR',   right: true,  ratio: 3.7543 },
    { name: 'SGD', symbolFormat: 'S$',    right: false, ratio: 1.3551 },
    { name: 'THB', symbolFormat: '฿',     right: false, ratio: 32.8027 },
    { name: 'TRY', symbolFormat: ' TL',   right: true,  ratio: 8.4025 },
    { name: 'TWD', symbolFormat: 'NT$ ',  right: false, ratio: 27.9719 },
    { name: 'UAH', symbolFormat: '₴',     right: true,  ratio: 26.8975 },
    { name: 'UYU', symbolFormat: '$U',    right: false, ratio: 42.8828 },
    { name: 'VND', symbolFormat: '₫',     right: false, ratio: 22810.1732 },
    { name: 'ZAR', symbolFormat: 'R ',    right: false, ratio: 14.9625 }
  ];

  var CONTEXT_MAP = {
    '753': '6',
    '730': '2',
    '440': '2',
    '570': '2',
    '252490': '2',
    '322330': '1'
  };

  function trimTrailingSlashes(url) {
    return String(url || '').replace(/\/+$/, '');
  }

  var ALLOWED_APPENGINE_HOST_RE = /^(?:(?:[a-z0-9](?:(?!-dot-)[a-z0-9-]){0,61}[a-z0-9]|[a-z0-9])-dot-){0,2}(?:item-value1[3-6]|mosaticon4)(?:\.[a-z]{2}\.r)?\.appspot\.com$/;
  var STEAMTOOLS_SUBDOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.steam\.tools$/;

  /**
   * Restrict runtime API/AUTH/CDN overrides to explicit SteamTools, canonical AppEngine, or local origins.
   * Rejects userinfo, paths, and arbitrary third-party hosts so localStorage overrides cannot exfiltrate tokens.
   */
  function isTrustedOriginUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return false;
    var trimmed = rawUrl.trim();
    if (!trimmed) return false;
    try {
      var parsed = new URL(trimmed);
      if (parsed.username || parsed.password) return false;
      if (parsed.pathname && parsed.pathname !== '/') return false;
      if (parsed.search || parsed.hash) return false;
      var host = parsed.hostname.toLowerCase();
      if (parsed.protocol === 'https:') {
        if (host === 'steam.tools' || STEAMTOOLS_SUBDOMAIN_RE.test(host)) return true;
        if (ALLOWED_APPENGINE_HOST_RE.test(host)) return true;
        if (host === '127.0.0.1' || host === 'localhost') return true;
        return false;
      }
      if (parsed.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1')) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function safeLocalStorageGet(key) {
    try {
      if (root && root.localStorage) {
        return root.localStorage.getItem(key);
      }
    } catch (e) {
      // Ignore storage access errors in restricted contexts.
    }
    return null;
  }

  function safeSearchParamGet(key) {
    try {
      if (root && root.location && typeof root.location.search === 'string' && typeof URLSearchParams === 'function') {
        var params = new URLSearchParams(root.location.search);
        return params.get(key);
      }
    } catch (e) {
      // Ignore malformed location search strings.
    }
    return null;
  }

  function resolveUrlSetting(storageKey, defaultValue) {
    var fromStorage = safeLocalStorageGet(storageKey);
    if (fromStorage && isTrustedOriginUrl(fromStorage)) {
      return trimTrailingSlashes(fromStorage.trim());
    }
    return trimTrailingSlashes(defaultValue);
  }

  function isLocalDevHost() {
    var host = root && root.location && root.location.hostname ? String(root.location.hostname).toLowerCase() : '';
    return host === 'localhost' || host === '127.0.0.1';
  }

  function resolveSitekey() {
    if (isLocalDevHost()) {
      var fromQuery = safeSearchParamGet('st_turnstile_sitekey');
      if (fromQuery && /^[0-9A-Za-z_-]{8,128}$/.test(fromQuery.trim())) {
        return fromQuery.trim();
      }
      var fromStorage = safeLocalStorageGet('st_turnstile_sitekey');
      if (fromStorage && /^[0-9A-Za-z_-]{8,128}$/.test(fromStorage.trim())) {
        return fromStorage.trim();
      }
    }
    return DEFAULTS.TURNSTILE_SITEKEY;
  }

  function resolveBooleanSetting(storageKey, defaultValue) {
    var raw = safeLocalStorageGet(storageKey);
    if (raw === null) return defaultValue;
    var norm = String(raw).trim().toLowerCase();
    if (norm === '0' || norm === 'false' || norm === 'off' || norm === 'no') return false;
    if (norm === '1' || norm === 'true' || norm === 'on' || norm === 'yes') return true;
    return defaultValue;
  }

  function parseValidatedOauthCookie(cookieString) {
    var src = typeof cookieString === 'string'
      ? cookieString
      : (root && root.document && typeof root.document.cookie === 'string' ? root.document.cookie : '');
    if (!src) return null;
    var pairs = src.split(';');
    for (var i = 0; i < pairs.length; i++) {
      var eqIdx = pairs[i].indexOf('=');
      if (eqIdx === -1) continue;
      var k = pairs[i].slice(0, eqIdx).trim();
      if (k !== 'oauth_steamid') continue;
      var v = pairs[i].slice(eqIdx + 1).trim();
      if (v.length >= 2 && v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') {
        v = v.slice(1, -1);
      }
      try {
        v = decodeURIComponent(v);
      } catch (e) {
        return null;
      }
      var trimmed = v.trim();
      if (/^\d{17}$/.test(trimmed)) {
        return trimmed;
      }
      var openIdMatch = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})\/?$/.exec(trimmed);
      if (openIdMatch) {
        return openIdMatch[1];
      }
      return null;
    }
    return null;
  }

  function hasLoggedInHintCookie(cookieString) {
    var src = typeof cookieString === 'string'
      ? cookieString
      : (root && root.document && typeof root.document.cookie === 'string' ? root.document.cookie : '');
    if (!src) return false;
    return /(?:^|;\s*)st_logged_in=1(?:;|$)/.test(src);
  }

  function clearLoggedInHintCookie() {
    if (root && root.document) {
      root.document.cookie = 'st_logged_in=; path=/; domain=.steam.tools; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      root.document.cookie = 'st_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    }
  }

  function checkAuthSession($http) {
    clearLegacyOauthCookie();
    if (!hasLoggedInHintCookie()) {
      return Promise.resolve({ authenticated: false, steamid: null, source: null });
    }
    var authBase = trimTrailingSlashes(config.AUTH_BASE);
    if (!$http || typeof $http.get !== 'function') {
      return Promise.resolve({ authenticated: false, steamid: null, source: null });
    }

    return new Promise(function (resolve) {
      var req = $http.get(authBase + '/auth/me', { withCredentials: true });
      var onSuccess = function (resp) {
        var payload = resp && resp.data !== undefined ? resp.data : resp;
        if (payload && payload.authenticated && /^\d{17}$/.test(String(payload.steamid || ''))) {
          resolve({
            authenticated: true,
            steamid: String(payload.steamid),
            source: 'session'
          });
          return;
        }
        clearLoggedInHintCookie();
        resolve({ authenticated: false, steamid: null, source: null });
      };
      var onError = function () {
        resolve({ authenticated: false, steamid: null, source: null });
      };
      if (typeof req.then === 'function') {
        req.then(onSuccess, onError);
      } else if (typeof req.success === 'function') {
        req.success(function (data) {
          onSuccess({ data: data });
        }).error(onError);
      } else {
        onError();
      }
    });
  }

  function getLoginUrl(returnTo) {
    var target = returnTo;
    if (!target && root && root.location && root.location.href) {
      target = root.location.href;
    }
    var url = trimTrailingSlashes(config.AUTH_BASE) + '/auth/steam/login';
    if (target) {
      url += '?return_to=' + encodeURIComponent(target);
    }
    return url;
  }

  function clearLegacyOauthCookie(force) {
    if (!root || !root.document) return;
    var cur = String(root.document.cookie || '');
    if (!force && !/(?:^|;\s*)oauth_steamid=/.test(cur)) return;
    root.document.cookie = 'oauth_steamid=; path=/; domain=.steam.tools; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    root.document.cookie = 'oauth_steamid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  }

  function performLogout($http) {
    clearLegacyOauthCookie(true);
    clearLoggedInHintCookie();
    var authBase = trimTrailingSlashes(config.AUTH_BASE);
    if (!$http || typeof $http.post !== 'function') {
      return Promise.resolve({ ok: true });
    }
    return new Promise(function (resolve) {
      var req = $http.post(authBase + '/auth/logout', {}, { withCredentials: true });
      var done = function () {
        clearLegacyOauthCookie();
        clearLoggedInHintCookie();
        resolve({ ok: true });
      };
      if (typeof req.then === 'function') {
        req.then(done, done);
      } else if (typeof req.success === 'function') {
        req.success(done).error(done);
      } else {
        done();
      }
    });
  }

  function getContextId(appid) {
    var key = String(appid || '').trim();
    return CONTEXT_MAP[key] || '2';
  }

  function isTurnstileConfigured() {
    var key = String(config.TURNSTILE_SITEKEY || '').trim();
    return key.length > 0 && !/PLACEHOLDER/i.test(key);
  }

  function escapeCsvFormula(str) {
    var s = String(str === null || str === undefined ? '' : str);
    return /^[=+\-@\t\r]/.test(s) ? ("'" + s) : s;
  }

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var _currencyPromise = null;
  var _manifestCache = Object.create(null);
  var _manifestPromises = Object.create(null);
  var MANIFEST_TTL_MS = 300000;
  var API_PRIMARY_STORAGE_KEY = 'st_api_primary';

  function isPoolApiBase(base) {
    return DEFAULTS.API_POOL.indexOf(base) !== -1;
  }

  function getApiCandidates(preferredBase) {
    var base = trimTrailingSlashes(preferredBase || config.API_BASE || DEFAULTS.API_BASE);
    if (!base) base = DEFAULTS.API_BASE;
    if (!isPoolApiBase(base)) {
      return [base];
    }
    var pool = DEFAULTS.API_POOL.slice();
    var primary = null;
    try {
      if (root && root.sessionStorage) {
        var stored = trimTrailingSlashes(root.sessionStorage.getItem(API_PRIMARY_STORAGE_KEY) || '');
        if (isPoolApiBase(stored)) {
          primary = stored;
        } else {
          primary = Math.random() < 0.5 ? pool[0] : pool[1];
          root.sessionStorage.setItem(API_PRIMARY_STORAGE_KEY, primary);
        }
      }
    } catch (e) {}
    if (!primary) {
      primary = base;
    }
    var candidates = [primary];
    for (var i = 0; i < pool.length; i++) {
      if (pool[i] !== primary) {
        candidates.push(pool[i]);
      }
    }
    return candidates;
  }

  function promotePrimaryApiBase(base) {
    if (!isPoolApiBase(base)) return;
    try {
      if (root && root.sessionStorage) {
        root.sessionStorage.setItem(API_PRIMARY_STORAGE_KEY, base);
      }
    } catch (e) {}
  }

  function normalizeApiPath(pathAndQuery) {
    var s = String(pathAndQuery || '');
    if (!s) return '/';
    return s.charAt(0) === '/' ? s : ('/' + s);
  }

  function appendQueryParam(pathAndQuery, key, val) {
    var sep = pathAndQuery.indexOf('?') !== -1 ? '&' : '?';
    return pathAndQuery + sep + encodeURIComponent(key) + '=' + encodeURIComponent(String(val));
  }

  function getTurnstileHeaderName(headers) {
    if (!headers || typeof headers !== 'object') return null;
    var keys = Object.keys(headers);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === 'x-turnstile-token' && headers[keys[i]]) {
        return keys[i];
      }
    }
    return null;
  }

  function isRetriableApiFailure(status, data, hasTurnstileToken) {
    var code = data && typeof data === 'object' ? String(data.error || '') : '';
    var softRetry = status >= 200 && status < 300 &&
      data && data.success === false &&
      (code === 'rate_limited' || code === 'upstream_unavailable');
    var hasPass = Boolean(data && typeof data === 'object' && data.key && data.ts);

    if (hasTurnstileToken) {
      if (status <= 0 || status === 502 || status === 503 || status === 504) {
        return true;
      }
      if (hasPass && (softRetry || status === 429 || status === 500)) {
        return true;
      }
      return false;
    }
    return status <= 0 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || softRetry;
  }

  function cloneReqConfigWithBase(reqConfig, base, pathAndQuery) {
    var cfg = {};
    if (reqConfig && typeof reqConfig === 'object') {
      var keys = Object.keys(reqConfig);
      for (var i = 0; i < keys.length; i++) {
        cfg[keys[i]] = reqConfig[keys[i]];
      }
      if (reqConfig.headers && typeof reqConfig.headers === 'object') {
        cfg.headers = Object.assign({}, reqConfig.headers);
      }
    }
    if (!cfg.method) cfg.method = 'GET';
    cfg.url = trimTrailingSlashes(base) + normalizeApiPath(pathAndQuery);
    return cfg;
  }

  function httpRequestWithFailover($http, pathAndQuery, reqConfig, options) {
    if (typeof $http !== 'function') {
      return Promise.reject(new Error('Angular $http client is required.'));
    }
    var opts = options || {};
    var candidates = getApiCandidates(opts.preferredBase);
    var cleanPath = normalizeApiPath(pathAndQuery);
    var turnstileHdr = getTurnstileHeaderName(reqConfig && reqConfig.headers);
    var hasTurnstileToken = Boolean(turnstileHdr);
    var issuedPass = null;

    function runAttempt(idx, currentPath, currentConfig, allowTurnstile) {
      var attemptBase = candidates[idx];
      var attemptCfg = cloneReqConfigWithBase(currentConfig, attemptBase, currentPath);
      if (!allowTurnstile && attemptCfg.headers) {
        var hdr = getTurnstileHeaderName(attemptCfg.headers);
        if (hdr) delete attemptCfg.headers[hdr];
      }

      return new Promise(function (resolve, reject) {
        var req = $http(attemptCfg);
        var onSuccess = function (resp) {
          var status = resp && typeof resp.status === 'number' ? resp.status : 200;
          var data = resp ? resp.data : null;
          if (data && typeof data === 'object' && data.key && data.ts) {
            issuedPass = { key: data.key, ts: data.ts };
          }
          if (idx + 1 < candidates.length && isRetriableApiFailure(status, data, allowTurnstile)) {
            var nextPath = currentPath;
            var nextAllowTurnstile = allowTurnstile;
            if (allowTurnstile && issuedPass) {
              nextAllowTurnstile = false;
              nextPath = appendQueryParam(appendQueryParam(nextPath, 'ts', issuedPass.ts), 'key', issuedPass.key);
            }
            runAttempt(idx + 1, nextPath, currentConfig, nextAllowTurnstile).then(resolve, reject);
            return;
          }
          if (idx > 0) {
            promotePrimaryApiBase(attemptBase);
          }
          resolve(resp);
        };
        var onError = function (errResp) {
          var status = errResp && typeof errResp.status === 'number' ? errResp.status : 0;
          var data = errResp ? errResp.data : null;
          if (data && typeof data === 'object' && data.key && data.ts) {
            issuedPass = { key: data.key, ts: data.ts };
          } else if (issuedPass && errResp && typeof errResp === 'object') {
            if (!errResp.data || typeof errResp.data !== 'object') {
              errResp.data = {};
            }
            if (!errResp.data.key) errResp.data.key = issuedPass.key;
            if (!errResp.data.ts) errResp.data.ts = issuedPass.ts;
          }
          if (idx + 1 < candidates.length && isRetriableApiFailure(status, data, allowTurnstile)) {
            var nextPath = currentPath;
            var nextAllowTurnstile = allowTurnstile;
            if (allowTurnstile && issuedPass) {
              nextAllowTurnstile = false;
              nextPath = appendQueryParam(appendQueryParam(nextPath, 'ts', issuedPass.ts), 'key', issuedPass.key);
            }
            runAttempt(idx + 1, nextPath, currentConfig, nextAllowTurnstile).then(resolve, reject);
            return;
          }
          reject(errResp);
        };
        if (typeof req.then === 'function') {
          req.then(onSuccess, onError);
        } else if (typeof req.success === 'function') {
          req.success(function (d, st, h) { onSuccess({ data: d, status: st || 200, headers: h }); })
             .error(function (d, st, h) { onError({ data: d, status: st || 0, headers: h }); });
        } else {
          onError({ status: 0, data: null });
        }
      });
    }

    return runAttempt(0, cleanPath, reqConfig || {}, hasTurnstileToken);
  }

  function fetchJsonWithFailover(pathAndQuery, options) {
    var opts = options || {};
    var f = opts.fetchImpl || (root && typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    if (!f) {
      return Promise.reject(new Error('Fetch API is not available.'));
    }
    var candidates = getApiCandidates(opts.preferredBase);
    var cleanPath = normalizeApiPath(pathAndQuery);

    function runAttempt(idx) {
      var attemptBase = candidates[idx];
      var fetchOpts = {};
      if (opts.method) fetchOpts.method = opts.method;
      if (opts.headers) fetchOpts.headers = opts.headers;
      if (opts.credentials) fetchOpts.credentials = opts.credentials;

      return Promise.resolve().then(function () {
        return f(trimTrailingSlashes(attemptBase) + cleanPath, fetchOpts);
      }).then(function (resp) {
        if (!resp) {
          throw new Error('Empty response from ' + attemptBase);
        }
        return resp.json().catch(function () { return null; }).then(function (data) {
          if (idx + 1 < candidates.length && isRetriableApiFailure(resp.status, data, false)) {
            return runAttempt(idx + 1);
          }
          if (idx > 0 && resp.ok) {
            promotePrimaryApiBase(attemptBase);
          }
          return {
            response: resp,
            ok: Boolean(resp.ok),
            status: resp.status,
            data: data,
            base: attemptBase
          };
        });
      }).catch(function (err) {
        if (idx + 1 < candidates.length) {
          return runAttempt(idx + 1);
        }
        throw err;
      });
    }

    return runAttempt(0);
  }

  function fetchRawJson(url, options) {
    var opts = options || {};
    var $http = opts.$http;
    var fetchImpl = opts.fetchImpl;
    if (fetchImpl) {
      return Promise.resolve().then(function () { return fetchImpl(url); }).then(function (resp) {
        if (!resp || !resp.ok) {
          var err = new Error('HTTP ' + (resp ? resp.status : 'ERR') + ' loading ' + url);
          err.status = resp ? resp.status : 0;
          throw err;
        }
        return resp.json();
      });
    }
    if ($http && typeof $http.get === 'function') {
      return new Promise(function (resolve, reject) {
        var req = $http.get(url);
        var ok = function (resp) { resolve(resp && resp.data !== undefined ? resp.data : resp); };
        var fail = function (err) {
          var status = err && typeof err.status === 'number' ? err.status : 0;
          var e = new Error('HTTP ' + status + ' loading ' + url);
          e.status = status;
          reject(e);
        };
        if (typeof req.then === 'function') {
          req.then(ok, fail);
        } else if (typeof req.success === 'function') {
          req.success(function (d) { resolve(d); }).error(function (_d, st) {
            var e = new Error('HTTP ' + (st || 0) + ' loading ' + url);
            e.status = st || 0;
            reject(e);
          });
        } else {
          fail({ status: 0 });
        }
      });
    }
    if (root && typeof root.fetch === 'function') {
      return root.fetch(url).then(function (resp) {
        if (!resp || !resp.ok) {
          var err = new Error('HTTP ' + (resp ? resp.status : 'ERR') + ' loading ' + url);
          err.status = resp ? resp.status : 0;
          throw err;
        }
        return resp.json();
      });
    }
    return Promise.reject(new Error('No HTTP client available.'));
  }

  function getManifest(options) {
    var opts = options || {};
    var cdnBase = trimTrailingSlashes(opts.cdnBase || config.CDN_BASE);
    if (!opts.forceRefresh) {
      var mem = _manifestCache[cdnBase];
      if (mem && (Date.now() - mem.ts) < MANIFEST_TTL_MS) {
        return Promise.resolve(mem.data);
      }
      try {
        if (root && root.sessionStorage) {
          var raw = root.sessionStorage.getItem('st_manifest_v1:' + cdnBase);
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && parsed.ts && (Date.now() - parsed.ts) < MANIFEST_TTL_MS && parsed.data && parsed.data.datasets) {
              _manifestCache[cdnBase] = parsed;
              return Promise.resolve(parsed.data);
            }
          }
        }
      } catch (e) {}
    }

    if (_manifestPromises[cdnBase]) return _manifestPromises[cdnBase];
    var p = fetchRawJson(cdnBase + '/manifest.json', opts).then(function (data) {
      delete _manifestPromises[cdnBase];
      if (data && typeof data === 'object' && data.datasets) {
        var rec = { ts: Date.now(), data: data };
        _manifestCache[cdnBase] = rec;
        try {
          if (root && root.sessionStorage) {
            root.sessionStorage.setItem('st_manifest_v1:' + cdnBase, JSON.stringify(rec));
          }
        } catch (e) {}
        return data;
      }
      return null;
    }).catch(function () {
      delete _manifestPromises[cdnBase];
      return null;
    });
    _manifestPromises[cdnBase] = p;
    return p;
  }

  function resolveDatasetUrl(logicalKey, options) {
    var opts = options || {};
    var cleanKey = String(logicalKey || '').replace(/^\/+/, '');
    var cdnBase = trimTrailingSlashes(opts.cdnBase || config.CDN_BASE);
    var fallbackUrl = cdnBase + '/' + cleanKey;
    return getManifest(opts).then(function (manifest) {
      var entry = manifest && manifest.datasets && manifest.datasets[cleanKey];
      var rel = entry && (entry.v_key || entry.path);
      if (typeof rel === 'string' && rel.trim()) {
        return cdnBase + '/' + rel.trim().replace(/^\/+/, '');
      }
      return fallbackUrl;
    }).catch(function () {
      return fallbackUrl;
    });
  }

  function getDatasetJson($http, logicalKey, options) {
    var opts = Object.assign({}, options || {});
    if ($http && typeof $http.get === 'function' && !opts.$http) {
      opts.$http = $http;
    }
    var cleanKey = String(logicalKey || '').replace(/^\/+/, '');
    var cdnBase = trimTrailingSlashes(opts.cdnBase || config.CDN_BASE);
    var fallbackUrl = cdnBase + '/' + cleanKey;
    return resolveDatasetUrl(cleanKey, opts).then(function (resolvedUrl) {
      return fetchRawJson(resolvedUrl, opts).catch(function (err) {
        if (resolvedUrl !== fallbackUrl) {
          return fetchRawJson(fallbackUrl, opts);
        }
        throw err;
      });
    });
  }

  function applyCurrencyRatesMap(data) {
    if (!data || typeof data !== 'object') return 0;
    var count = 0;
    for (var i = 0; i < CURRENCY_DATA.length; i++) {
      var code = CURRENCY_DATA[i].name;
      if (Object.prototype.hasOwnProperty.call(data, code) && typeof data[code] === 'number' && Number.isFinite(data[code]) && data[code] > 0) {
        CURRENCY_DATA[i].ratio = data[code];
        count++;
      }
    }
    return count;
  }

  function loadCurrencyRates($http) {
    if (_currencyPromise) return _currencyPromise;
    var CACHE_KEY = 'st_currency_rates_v1';
    try {
      if (root && root.sessionStorage) {
        var raw = root.sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          var cached = JSON.parse(raw);
          if (cached && cached.ts && (Date.now() - cached.ts) < 600000 && cached.data) {
            var c = applyCurrencyRatesMap(cached.data);
            return Promise.resolve({ updated: c, total: CURRENCY_DATA.length, cached: true });
          }
        }
      }
    } catch (e) {}

    var handleData = function (data) {
      var count = applyCurrencyRatesMap(data);
      if (count > 0) {
        try {
          if (root && root.sessionStorage) {
            root.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
          }
        } catch (e) {}
      }
      return { updated: count, total: CURRENCY_DATA.length, cached: false };
    };

    var resolveCurrencyPromise = ($http && typeof $http.get === 'function') || (root && typeof root.fetch === 'function')
      ? getDatasetJson($http, 'data/currency.json')
      : Promise.resolve(null);

    _currencyPromise = resolveCurrencyPromise
      .then(handleData)
      .catch(function () { return { updated: 0, total: CURRENCY_DATA.length, error: true }; });
    return _currencyPromise;
  }

  function getSavedCurIndex() {
    var raw = safeLocalStorageGet('curIndex');
    if (raw === null) return 0;
    var parsed = parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < CURRENCY_DATA.length) {
      return parsed;
    }
    return 0;
  }

  function formatNumberCommas(val, decimals) {
    var fixed = Number(val).toFixed(decimals === undefined ? 2 : decimals);
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function formatPriceUsd(usdValue, curIndex, opts) {
    var options = opts || {};
    var num = Number(usdValue);
    if (usdValue === null || usdValue === undefined || usdValue === '' || isNaN(num) || !Number.isFinite(num)) {
      return 'N/A';
    }
    var idx = Number.isInteger(curIndex) && CURRENCY_DATA[curIndex] ? curIndex : 0;
    var cur = CURRENCY_DATA[idx];
    var converted = num * cur.ratio;
    var formatted = typeof options.formatNumber === 'function'
      ? options.formatNumber(converted, 2)
      : formatNumberCommas(converted, 2);
    if (options.noCurrency) return formatted;
    var base = cur.right ? (formatted + cur.symbolFormat) : (cur.symbolFormat + formatted);
    if (idx > 0 && !options.noApprox) {
      return '≈ ' + base;
    }
    return base;
  }

  function openTextExportDialog(options) {
    if (!root || !root.document) return null;
    var doc = root.document;
    var opts = options || {};
    var prevFocus = doc.activeElement;
    var dlg = doc.createElement('dialog');
    dlg.className = 'st-import-dialog st-export-dialog';
    dlg.setAttribute('closedby', 'any');
    dlg.setAttribute('aria-labelledby', 'st-export-title');

    var header = doc.createElement('div');
    header.className = 'st-import-header';
    var h2 = doc.createElement('h2');
    h2.className = 'st-import-title';
    h2.id = 'st-export-title';
    h2.textContent = opts.title || 'Export Data';
    var closeTop = doc.createElement('button');
    closeTop.type = 'button';
    closeTop.className = 'st-import-close';
    closeTop.setAttribute('aria-label', 'Close export dialog');
    closeTop.textContent = '×';
    header.appendChild(h2);
    header.appendChild(closeTop);

    var body = doc.createElement('div');
    body.className = 'st-import-body';
    if (opts.subtitle) {
      var sub = doc.createElement('p');
      sub.className = 'st-import-subtitle';
      sub.textContent = opts.subtitle;
      body.appendChild(sub);
    }

    var textId = 'st-export-textarea-' + Math.floor(Math.random() * 1e6);
    var label = doc.createElement('label');
    label.className = 'st-label';
    label.setAttribute('for', textId);
    label.textContent = opts.label || 'Export output';

    var ta = doc.createElement('textarea');
    ta.id = textId;
    ta.className = 'st-textarea';
    ta.readOnly = true;
    ta.rows = 12;
    ta.value = String(opts.text || '');

    var row = doc.createElement('div');
    row.className = 'st-field-row';
    var copyWrap = doc.createElement('span');
    copyWrap.className = 'st-copy-wrap';
    var copyBtn = doc.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'st-btn st-btn-primary';
    copyBtn.textContent = opts.copyLabel || 'Copy to Clipboard';
    var bubble = doc.createElement('span');
    bubble.className = 'st-copy-status';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    copyWrap.appendChild(copyBtn);
    copyWrap.appendChild(bubble);
    row.appendChild(copyWrap);

    if (opts.filename) {
      var dlBtn = doc.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'st-btn';
      dlBtn.textContent = 'Download ' + opts.filename;
      dlBtn.addEventListener('click', function () {
        var blob = new root.Blob([ta.value], { type: opts.mimeType || 'text/plain;charset=utf-8' });
        var blobUrl = root.URL.createObjectURL(blob);
        var a = doc.createElement('a');
        a.href = blobUrl;
        a.download = opts.filename;
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        root.setTimeout(function () { root.URL.revokeObjectURL(blobUrl); }, 1000);
      });
      row.appendChild(dlBtn);
    }

    var closeFooterBtn = doc.createElement('button');
    closeFooterBtn.type = 'button';
    closeFooterBtn.className = 'st-btn';
    closeFooterBtn.textContent = 'Close';
    row.appendChild(closeFooterBtn);

    body.appendChild(label);
    body.appendChild(ta);
    body.appendChild(row);
    dlg.appendChild(header);
    dlg.appendChild(body);
    doc.body.appendChild(dlg);

    var copyTimer = null;
    var lastStatusMsg = '';
    function reportCopy(ok) {
      if (copyTimer) root.clearTimeout(copyTimer);
      copyBtn.removeAttribute('data-copied');
      copyBtn.removeAttribute('data-failed');
      var msg = ok ? 'Copied' : 'Copy failed';
      if (msg === lastStatusMsg) msg += '\u00A0';
      lastStatusMsg = msg;
      bubble.textContent = '';
      bubble.classList.remove('is-visible');
      copyBtn.setAttribute(ok ? 'data-copied' : 'data-failed', '');
      var show = function () {
        bubble.textContent = msg;
        bubble.classList.add('is-visible');
      };
      if (typeof root.requestAnimationFrame === 'function') {
        root.requestAnimationFrame(show);
      } else {
        show();
      }
      copyTimer = root.setTimeout(function () {
        copyBtn.removeAttribute('data-copied');
        copyBtn.removeAttribute('data-failed');
        bubble.classList.remove('is-visible');
        bubble.textContent = '';
      }, 2200);
    }

    function legacyCopyFromTextarea() {
      ta.focus();
      ta.select();
      try {
        return typeof doc.execCommand === 'function' && doc.execCommand('copy');
      } catch (e) {
        return false;
      }
    }

    copyBtn.addEventListener('click', function () {
      var txt = ta.value;
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
        root.navigator.clipboard.writeText(txt).then(function () {
          reportCopy(true);
        }).catch(function () {
          reportCopy(legacyCopyFromTextarea());
        });
      } else {
        reportCopy(legacyCopyFromTextarea());
      }
    });

    closeTop.addEventListener('click', function () { dlg.close('close'); });
    closeFooterBtn.addEventListener('click', function () { dlg.close('close'); });

    if (!root.HTMLDialogElement || !('closedBy' in root.HTMLDialogElement.prototype)) {
      var downOutside = false;
      var isOutside = function (ev) {
        var r = dlg.getBoundingClientRect();
        return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
      };
      dlg.addEventListener('pointerdown', function (ev) { downOutside = isOutside(ev); });
      dlg.addEventListener('pointerup', function (ev) {
        if (!downOutside) return;
        downOutside = false;
        if (isOutside(ev)) dlg.close('backdrop');
      });
    }

    dlg.addEventListener('close', function () {
      if (copyTimer) root.clearTimeout(copyTimer);
      dlg.returnValue = '';
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      if (prevFocus && typeof prevFocus.focus === 'function') {
        try { prevFocus.focus(); } catch (e) {}
      }
    });

    dlg.showModal();
    ta.focus();
    ta.select();
    return dlg;
  }

  function normalizeSteamAssetUrl(url) {
    if (typeof url !== 'string') return '';
    return url
      .replace(/^http:\/\/cdn\.akamai\.steamstatic\.com\//i, 'https://cdn.akamai.steamstatic.com/')
      .replace(/^https?:\/\/steamcommunity-a\.akamaihd\.net\//i, 'https://community.akamai.steamstatic.com/')
      .replace(/^http:\/\//i, 'https://');
  }

  function isInAppWebview(userAgent) {
    var ua = typeof userAgent === 'string'
      ? userAgent
      : (root && root.navigator && typeof root.navigator.userAgent === 'string' ? root.navigator.userAgent : '');
    if (!ua) return false;
    return /(FBAN|FBAV|Instagram|Line\/|MicroMessenger|Twitter|Snapchat|TikTok|Discord|Reddit|; wv\))/i.test(ua);
  }

  function mountWebviewNotice() {
    if (!root || !root.document || !isInAppWebview()) return;
    var doc = root.document;
    var render = function () {
      if (!doc.body || !doc.querySelector('[ng-app]')) return;
      if (doc.getElementById('st-webview-banner')) return;
      try {
        if (root.sessionStorage && root.sessionStorage.getItem('st_webview_dismissed') === '1') return;
      } catch (e) {}

      var banner = doc.createElement('div');
      banner.id = 'st-webview-banner';
      banner.className = 'st-webview-banner';
      banner.setAttribute('role', 'note');

      var msg = doc.createElement('span');
      msg.textContent = 'Using an in-app browser? Steam Sign-In cookies may not persist here — open steam.tools in your system browser or use Import Inventory.';
      var dismiss = doc.createElement('button');
      dismiss.type = 'button';
      dismiss.textContent = 'Dismiss';
      dismiss.setAttribute('aria-label', 'Dismiss in-app browser notice');
      dismiss.addEventListener('click', function () {
        try {
          if (root.sessionStorage) root.sessionStorage.setItem('st_webview_dismissed', '1');
        } catch (e) {}
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      });

      banner.appendChild(msg);
      banner.appendChild(dismiss);
      var container = doc.getElementById('container');
      if (container && container.firstChild) {
        container.insertBefore(banner, container.firstChild);
      } else if (doc.body.firstChild) {
        doc.body.insertBefore(banner, doc.body.firstChild);
      } else {
        doc.body.appendChild(banner);
      }
    };

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', render);
    } else {
      render();
    }
  }

  function refresh() {
    config.CDN_BASE = resolveUrlSetting('st_cdn_base', DEFAULTS.CDN_BASE);
    config.CDN2_BASE = resolveUrlSetting('st_cdn2_base', DEFAULTS.CDN2_BASE);
    config.STEAM_ECON_BASE = DEFAULTS.STEAM_ECON_BASE;
    config.EMOTE_CORS_BASE = DEFAULTS.EMOTE_CORS_BASE;
    config.API_BASE = resolveUrlSetting('st_api_base', DEFAULTS.API_BASE);
    config.AUTH_BASE = resolveUrlSetting('st_auth_base', config.API_BASE || DEFAULTS.AUTH_BASE);
    config.GAMES_API_BASE = resolveUrlSetting('st_games_api_base', config.API_BASE || DEFAULTS.GAMES_API_BASE);
    config.TURNSTILE_SITEKEY = resolveSitekey();
    config.USE_753_BUCKETS = resolveBooleanSetting('st_use_753_buckets', DEFAULTS.USE_753_BUCKETS);
    return config;
  }

  var config = {
    DEFAULTS: DEFAULTS,
    TOP_6_APPS: TOP_6_APPS,
    CURRENCY_DATA: CURRENCY_DATA,
    CDN_BASE: DEFAULTS.CDN_BASE,
    CDN2_BASE: DEFAULTS.CDN2_BASE,
    STEAM_ECON_BASE: DEFAULTS.STEAM_ECON_BASE,
    EMOTE_CORS_BASE: DEFAULTS.EMOTE_CORS_BASE,
    API_BASE: DEFAULTS.API_BASE,
    API_POOL: DEFAULTS.API_POOL.slice(),
    AUTH_BASE: DEFAULTS.AUTH_BASE,
    GAMES_API_BASE: DEFAULTS.GAMES_API_BASE,
    TURNSTILE_SITEKEY: DEFAULTS.TURNSTILE_SITEKEY,
    USE_753_BUCKETS: DEFAULTS.USE_753_BUCKETS,
    isTrustedOriginUrl: isTrustedOriginUrl,
    isTurnstileConfigured: isTurnstileConfigured,
    getContextId: getContextId,
    getApiCandidates: getApiCandidates,
    httpRequestWithFailover: httpRequestWithFailover,
    fetchJsonWithFailover: fetchJsonWithFailover,
    getManifest: getManifest,
    resolveDatasetUrl: resolveDatasetUrl,
    getDatasetJson: getDatasetJson,
    loadCurrencyRates: loadCurrencyRates,
    getSavedCurIndex: getSavedCurIndex,
    formatPriceUsd: formatPriceUsd,
    openTextExportDialog: openTextExportDialog,
    parseValidatedOauthCookie: parseValidatedOauthCookie,
    hasLoggedInHintCookie: hasLoggedInHintCookie,
    clearLoggedInHintCookie: clearLoggedInHintCookie,
    checkAuthSession: checkAuthSession,
    getLoginUrl: getLoginUrl,
    performLogout: performLogout,
    clearLegacyOauthCookie: clearLegacyOauthCookie,
    escapeCsvFormula: escapeCsvFormula,
    escapeHtml: escapeHtml,
    normalizeSteamAssetUrl: normalizeSteamAssetUrl,
    isInAppWebview: isInAppWebview,
    mountWebviewNotice: mountWebviewNotice,
    refresh: refresh
  };

  refresh();
  mountWebviewNotice();
  return config;
});
