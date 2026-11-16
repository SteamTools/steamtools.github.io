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

  function resolveSitekey() {
    var fromQuery = safeSearchParamGet('st_turnstile_sitekey');
    if (fromQuery && /^[0-9A-Za-z_-]{8,128}$/.test(fromQuery.trim())) {
      return fromQuery.trim();
    }
    var fromStorage = safeLocalStorageGet('st_turnstile_sitekey');
    if (fromStorage && /^[0-9A-Za-z_-]{8,128}$/.test(fromStorage.trim())) {
      return fromStorage.trim();
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

  function checkAuthSession($http) {
    var authBase = trimTrailingSlashes(config.AUTH_BASE);
    var cookieSteamId = parseValidatedOauthCookie();

    function cookieFallback() {
      if (cookieSteamId) {
        return { authenticated: true, steamid: cookieSteamId, source: 'cookie' };
      }
      return { authenticated: false, steamid: null, source: null };
    }

    if (!$http || typeof $http.get !== 'function') {
      return Promise.resolve(cookieFallback());
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
        resolve(cookieFallback());
      };
      var onError = function () {
        resolve(cookieFallback());
      };
      if (typeof req.then === 'function') {
        req.then(onSuccess, onError);
      } else if (typeof req.success === 'function') {
        req.success(function (data) {
          onSuccess({ data: data });
        }).error(onError);
      } else {
        resolve(cookieFallback());
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

  function clearLegacyOauthCookie() {
    if (root && root.document) {
      root.document.cookie = 'oauth_steamid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    }
  }

  function performLogout($http) {
    clearLegacyOauthCookie();
    var authBase = trimTrailingSlashes(config.AUTH_BASE);
    if (!$http || typeof $http.post !== 'function') {
      return Promise.resolve({ ok: true });
    }
    return new Promise(function (resolve) {
      var req = $http.post(authBase + '/auth/logout', {}, { withCredentials: true });
      var done = function () {
        clearLegacyOauthCookie();
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

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSteamAssetUrl(url) {
    if (typeof url !== 'string') return '';
    return url
      .replace(/^http:\/\/cdn\.akamai\.steamstatic\.com\//i, 'https://cdn.akamai.steamstatic.com/')
      .replace(/^https?:\/\/steamcommunity-a\.akamaihd\.net\//i, 'https://community.akamai.steamstatic.com/')
      .replace(/^http:\/\//i, 'https://');
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
    CDN_BASE: DEFAULTS.CDN_BASE,
    CDN2_BASE: DEFAULTS.CDN2_BASE,
    STEAM_ECON_BASE: DEFAULTS.STEAM_ECON_BASE,
    EMOTE_CORS_BASE: DEFAULTS.EMOTE_CORS_BASE,
    API_BASE: DEFAULTS.API_BASE,
    AUTH_BASE: DEFAULTS.AUTH_BASE,
    GAMES_API_BASE: DEFAULTS.GAMES_API_BASE,
    TURNSTILE_SITEKEY: DEFAULTS.TURNSTILE_SITEKEY,
    USE_753_BUCKETS: DEFAULTS.USE_753_BUCKETS,
    isTrustedOriginUrl: isTrustedOriginUrl,
    isTurnstileConfigured: isTurnstileConfigured,
    getContextId: getContextId,
    parseValidatedOauthCookie: parseValidatedOauthCookie,
    checkAuthSession: checkAuthSession,
    getLoginUrl: getLoginUrl,
    performLogout: performLogout,
    clearLegacyOauthCookie: clearLegacyOauthCookie,
    escapeHtml: escapeHtml,
    normalizeSteamAssetUrl: normalizeSteamAssetUrl,
    refresh: refresh
  };

  refresh();
  return config;
});
