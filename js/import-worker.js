(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope) {
    root.onmessage = function (ev) {
      var msg = ev && ev.data ? ev.data : {};
      var id = msg.id;
      try {
        var result = api.parseInventoryPayload(msg.payload, msg.options || {});
        root.postMessage({ id: id, ok: true, result: result });
      } catch (err) {
        root.postMessage({
          id: id,
          ok: false,
          error: err && err.message ? err.message : String(err || 'Parse error')
        });
      }
    };
  } else if (root) {
    root.SteamToolsImportWorker = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function encodeURIComponentSafe(str) {
    var s = String(str === null || str === undefined ? '' : str);
    try {
      return encodeURIComponent(s);
    } catch (e) {
      // Replace lone UTF-16 surrogates with U+FFFD so URIError never aborts valuation.
      var sanitized = '';
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c >= 0xD800 && c <= 0xDBFF) {
          var next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
          if (next >= 0xDC00 && next <= 0xDFFF) {
            sanitized += s.charAt(i) + s.charAt(i + 1);
            i++;
          } else {
            sanitized += '\uFFFD';
          }
        } else if (c >= 0xDC00 && c <= 0xDFFF) {
          sanitized += '\uFFFD';
        } else {
          sanitized += s.charAt(i);
        }
      }
      return encodeURIComponent(sanitized);
    }
  }

  /**
   * Match Python: urllib.parse.quote(s, safe="/").replace("~", "%7E")
   * Keys inside CDN value/{appid}.json do NOT have an `{appid}/` prefix.
   */
  function quoteSteamKey(str) {
    return encodeURIComponentSafe(str)
      .replace(/%2F/g, '/')
      .replace(/[!'()*~]/g, function (c) {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
      });
  }

  var _textEncoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;

  function utf8Bytes(str) {
    var s = String(str === null || str === undefined ? '' : str);
    if (_textEncoder) {
      try {
        return _textEncoder.encode(s);
      } catch (e) {
        // Fallback below
      }
    }
    var bytes = [];
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        i++;
        code = 0x10000 + (((code & 0x3ff) << 10) | (s.charCodeAt(i) & 0x3ff));
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      }
    }
    return bytes;
  }

  function fnv1a32(str) {
    var bytes = utf8Bytes(str);
    var h = 0x811c9dc5;
    for (var i = 0; i < bytes.length; i++) {
      h = Math.imul(h ^ bytes[i], 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function fnv1a32Hex2(quotedKey) {
    return (fnv1a32(quotedKey) >>> 0).toString(16).padStart(8, '0').slice(0, 2);
  }

  /**
   * Parity alignment: missing or non-numeric amount -> 1; numeric "0" -> 0.
   */
  function parseAssetAmount(rawAmount) {
    if (rawAmount === null || rawAmount === undefined || rawAmount === '') {
      return 1;
    }
    var s = String(rawAmount).trim();
    if (!/^[0-9]+$/.test(s)) {
      return 1;
    }
    var parsed = parseInt(s, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
  }

  function sanitizeHexColor(hex, fallback) {
    if (typeof hex === 'string' && /^[0-9A-Fa-f]{6}$/.test(hex.trim())) {
      return hex.trim();
    }
    return fallback || 'D2D2D2';
  }

  function sanitizeEmoteName(raw) {
    if (typeof raw !== 'string') return '';
    var name = raw.trim().replace(/^:+|:+$/g, '');
    if (!name || name.length > 128) return '';
    if (/[\/\\?#<>"'\s]/.test(name) || name.indexOf('..') !== -1) {
      return '';
    }
    return name;
  }

  function extractTextPlainEmotes(text) {
    var out = [];
    var seen = Object.create(null);
    var re = /:([^\s:/\\?#<>"']+):/g;
    var match;
    while ((match = re.exec(text)) !== null) {
      var clean = sanitizeEmoteName(match[1]);
      if (clean && !seen[clean]) {
        seen[clean] = true;
        out.push(clean);
      }
    }
    return out;
  }

  function splitConcatenatedJson(text) {
    var s = String(text || '').trim();
    if (!s) return [];
    try {
      return [JSON.parse(s)];
    } catch (singleErr) {
      var chunks = [];
      var depth = 0;
      var inString = false;
      var escaped = false;
      var start = -1;
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === '{' || ch === '[') {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === '}' || ch === ']') {
          depth--;
          if (depth === 0 && start !== -1) {
            var slice = s.slice(start, i + 1);
            chunks.push(JSON.parse(slice));
            start = -1;
          } else if (depth < 0) {
            throw singleErr;
          }
        }
      }
      if (chunks.length === 0 || depth !== 0) {
        throw singleErr;
      }
      return chunks;
    }
  }

  function unwrapPageObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj.result && typeof obj.result === 'object' && !Array.isArray(obj.result)) {
      return obj.result;
    }
    if (obj.response && typeof obj.response === 'object' && !Array.isArray(obj.response)) {
      return obj.response;
    }
    return obj;
  }

  function isSteamPageObject(obj) {
    var u = unwrapPageObject(obj);
    if (!u || typeof u !== 'object' || Array.isArray(u)) return false;
    return (
      Array.isArray(u.assets) ||
      Array.isArray(u.descriptions) ||
      Boolean(u.rgInventory && typeof u.rgInventory === 'object') ||
      Boolean(u.rgDescriptions && typeof u.rgDescriptions === 'object') ||
      u.success !== undefined
    );
  }

  function isEmoticonEntry(entry) {
    if (typeof entry === 'string') return true;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return typeof entry.name === 'string' || typeof entry.emoticon === 'string';
    }
    return false;
  }

  function collectEmoteNamesFromArray(arr, out, seen) {
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      var rawName = typeof item === 'string'
        ? item
        : (item && typeof item === 'object' ? (item.name || item.emoticon || '') : '');
      var clean = sanitizeEmoteName(rawName);
      if (clean && !seen[clean]) {
        seen[clean] = true;
        out.push(clean);
      }
    }
  }

  function normalizeRawInputs(payload, mode) {
    var items = Array.isArray(payload) ? payload : [payload];
    var pages = [];
    var emotes = [];
    var emoteSeen = Object.create(null);
    var sawEmptyArray = false;
    var sawEmoticonList = false;

    function visitValue(val) {
      if (val === null || val === undefined) {
        throw new Error('Steam returned empty/null JSON. Your inventory may be private or rate-limited.');
      }
      if (typeof val === 'string') {
        var trimmed = val.replace(/^\uFEFF/, '').trim();
        if (!trimmed) return;
        if (trimmed.charAt(0) !== '{' && trimmed.charAt(0) !== '[') {
          if (mode === 'emotes' || /:[A-Za-z0-9_.-]+:/.test(trimmed)) {
            var plain = extractTextPlainEmotes(trimmed);
            if (plain.length > 0) {
              sawEmoticonList = true;
              collectEmoteNamesFromArray(plain, emotes, emoteSeen);
              return;
            }
          }
          throw new Error('Input is not valid Steam inventory JSON.');
        }
        var parsedChunks = splitConcatenatedJson(trimmed);
        for (var i = 0; i < parsedChunks.length; i++) {
          visitValue(parsedChunks[i]);
        }
        return;
      }

      if (Array.isArray(val)) {
        if (val.length === 0) {
          sawEmptyArray = true;
          sawEmoticonList = true;
          return;
        }
        if (isSteamPageObject(val[0])) {
          for (var j = 0; j < val.length; j++) {
            visitValue(val[j]);
          }
          return;
        }
        if (typeof val[0] === 'string' && val[0].trim().charAt(0) === '{') {
          for (var s = 0; s < val.length; s++) {
            visitValue(val[s]);
          }
          return;
        }
        if (isEmoticonEntry(val[0])) {
          sawEmoticonList = true;
          collectEmoteNamesFromArray(val, emotes, emoteSeen);
          return;
        }
        throw new Error('Unrecognized JSON array format.');
      }

      if (typeof val === 'object') {
        if (typeof val.text === 'string' && !val.assets && !val.rgInventory) {
          visitValue(val.text);
          return;
        }
        if (Array.isArray(val.EmoticonList)) {
          sawEmoticonList = true;
          if (val.EmoticonList.length === 0) {
            sawEmptyArray = true;
          } else {
            collectEmoteNamesFromArray(val.EmoticonList, emotes, emoteSeen);
          }
          return;
        }
        var unwrapped = unwrapPageObject(val);
        if (unwrapped.success === false || unwrapped.success === 0) {
          var reason = unwrapped.error || unwrapped.Error || unwrapped.message || 'Inventory unavailable or private.';
          throw new Error('Steam error: ' + String(reason));
        }
        if (!isSteamPageObject(unwrapped)) {
          throw new Error('JSON object does not look like a Steam inventory response.');
        }
        pages.push(unwrapped);
        return;
      }

      throw new Error('Unsupported import payload type.');
    }

    for (var idx = 0; idx < items.length; idx++) {
      visitValue(items[idx]);
    }

    return {
      pages: pages,
      sawEmoticonList: sawEmoticonList,
      sawEmptyArray: sawEmptyArray && emotes.length === 0 && pages.length === 0,
      emotes: emotes
    };
  }

  function mergeSteamPages(pages) {
    var seenAssetIds = Object.create(null);
    var mergedAssets = [];
    var descMap = Object.create(null);
    var descByClass = Object.create(null);
    var lastPage = pages[pages.length - 1] || {};
    var totalInventoryCount = 0;
    var detectedAppId = null;

    for (var p = 0; p < pages.length; p++) {
      var page = unwrapPageObject(pages[p]) || {};
      if (typeof page.total_inventory_count === 'number' && page.total_inventory_count > totalInventoryCount) {
        totalInventoryCount = page.total_inventory_count;
      }

      var rawDescs = [];
      if (Array.isArray(page.descriptions)) {
        rawDescs = page.descriptions;
      } else if (page.rgDescriptions && typeof page.rgDescriptions === 'object') {
        var rkeys = Object.keys(page.rgDescriptions);
        for (var rk = 0; rk < rkeys.length; rk++) {
          rawDescs.push(page.rgDescriptions[rkeys[rk]]);
        }
      }

      for (var d = 0; d < rawDescs.length; d++) {
        var desc = rawDescs[d];
        if (!desc || !desc.classid) continue;
        var cid = String(desc.classid);
        var iid = desc.instanceid !== undefined && desc.instanceid !== null ? String(desc.instanceid) : '0';
        var key = cid + '_' + iid;
        descMap[key] = desc;
        if (!descByClass[cid]) {
          descByClass[cid] = desc;
        }
        if (!detectedAppId && desc.appid !== undefined && desc.appid !== null) {
          detectedAppId = String(desc.appid);
        }
      }

      var rawAssets = [];
      if (Array.isArray(page.assets)) {
        rawAssets = page.assets;
      } else if (page.rgInventory && typeof page.rgInventory === 'object') {
        var ikeys = Object.keys(page.rgInventory);
        for (var ik = 0; ik < ikeys.length; ik++) {
          rawAssets.push(page.rgInventory[ikeys[ik]]);
        }
      }

      for (var a = 0; a < rawAssets.length; a++) {
        var asset = rawAssets[a];
        if (!asset || !asset.classid) continue;
        var aid = asset.assetid !== undefined && asset.assetid !== null
          ? String(asset.assetid)
          : (asset.id !== undefined && asset.id !== null ? String(asset.id) : null);
        if (aid) {
          if (seenAssetIds[aid]) continue;
          seenAssetIds[aid] = true;
        }
        if (!detectedAppId && asset.appid !== undefined && asset.appid !== null) {
          detectedAppId = String(asset.appid);
        }
        mergedAssets.push(asset);
      }
    }

    var unwrappedLast = unwrapPageObject(lastPage) || {};
    var moreItems = Boolean(unwrappedLast.more_items || unwrappedLast.more);
    var lastAssetId = unwrappedLast.last_assetid !== undefined && unwrappedLast.last_assetid !== null
      ? String(unwrappedLast.last_assetid)
      : (unwrappedLast.more_start !== undefined && unwrappedLast.more_start !== null
        ? String(unwrappedLast.more_start)
        : null);

    return {
      assets: mergedAssets,
      descMap: descMap,
      descByClass: descByClass,
      more_items: moreItems,
      last_assetid: lastAssetId,
      total_inventory_count: totalInventoryCount || mergedAssets.length,
      page_count: pages.length,
      detected_appid: detectedAppId
    };
  }

  function resolveDesc(merged, asset) {
    var cid = String(asset.classid);
    var iid = asset.instanceid !== undefined && asset.instanceid !== null ? String(asset.instanceid) : '0';
    return merged.descMap[cid + '_' + iid] || merged.descMap[cid + '_0'] || merged.descByClass[cid] || null;
  }

  function normalize753Type(itemClass, rawType) {
    var ic = String(itemClass || '').toLowerCase();
    var rt = String(rawType || '').toLowerCase();
    if (ic === 'item_class_2' || ic === 'trading card' || rt.indexOf('trading card') !== -1) {
      return 'card';
    }
    if (ic === 'item_class_3' || ic === 'profile background' || rt.indexOf('profile background') !== -1) {
      return 'background';
    }
    if (ic === 'item_class_4' || ic === 'emoticon' || rt.indexOf('emoticon') !== -1) {
      return 'emoticon';
    }
    if (ic === 'item_class_5' || ic === 'booster pack' || rt.indexOf('booster pack') !== -1) {
      return 'booster';
    }
    return '???';
  }

  function extractDescriptionMeta(desc, appid) {
    var tags = Array.isArray(desc.tags) ? desc.tags : [];
    var type = null;
    var rarity = null;
    var rcolor = null;
    var quality = null;
    var qcolor = null;
    var game = null;
    var itemClass = null;
    var cardBorder = null;

    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i];
      if (!tag) continue;
      var cat = String(tag.category || '').toLowerCase();
      var label = tag.localized_tag_name || tag.name || null;
      var internal = String(tag.internal_name || '');

      if (cat === 'item_class') {
        itemClass = internal || label;
      } else if (cat === 'cardborder') {
        cardBorder = internal || label;
      } else if (cat === 'game') {
        game = label;
      } else if (cat === 'rarity') {
        rarity = label;
        rcolor = sanitizeHexColor(tag.color, 'D2D2D2');
      } else if (cat === 'quality') {
        quality = label;
        qcolor = sanitizeHexColor(tag.color, 'D2D2D2');
      } else if (cat === 'type') {
        type = label;
      }
    }

    if (!type && desc.type) {
      type = String(desc.type);
    }

    var hashName = desc.market_hash_name || desc.name || '';
    var quotedKey = quoteSteamKey(hashName);
    var effectiveAppId = String(appid || desc.appid || '753');
    if (effectiveAppId === '753') {
      type = normalize753Type(itemClass, type || desc.type);
    }

    return {
      market_hash_name: hashName,
      name: desc.market_name || desc.name || hashName,
      quoted_key: quotedKey,
      bucket: effectiveAppId === '753' ? fnv1a32Hex2(quotedKey) : null,
      url: effectiveAppId + '/' + quotedKey,
      bg: sanitizeHexColor(desc.background_color, '292929'),
      color: sanitizeHexColor(desc.name_color, 'D2D2D2'),
      icon: desc.icon_url || desc.icon_url_large || '',
      marketable: Boolean(desc.marketable === 1 || desc.marketable === '1' || desc.marketable === true),
      type: type,
      rarity: rarity,
      rcolor: rcolor,
      quality: quality,
      qcolor: qcolor,
      game: game,
      itemClass: itemClass,
      cardBorder: cardBorder
    };
  }

  function buildItemValueItems(merged, targetAppId) {
    var effectiveAppId = String(targetAppId || merged.detected_appid || '753');
    var agg = Object.create(null);
    var orderedKeys = [];
    var bucketsNeededMap = Object.create(null);

    for (var i = 0; i < merged.assets.length; i++) {
      var asset = merged.assets[i];
      var qty = parseAssetAmount(asset.amount);
      if (qty <= 0) continue;

      var desc = resolveDesc(merged, asset);
      if (!desc) continue;

      var itemAppId = String(asset.appid || desc.appid || effectiveAppId);
      // Match legacy InvParser.py 730 parity: 730 includes items without marketable flag.
      if (itemAppId !== '730' && !desc.marketable) {
        continue;
      }

      var hashName = desc.market_hash_name || desc.name || '';
      if (!hashName) continue;

      if (!agg[hashName]) {
        var meta = extractDescriptionMeta(desc, itemAppId);
        meta.count = qty;
        agg[hashName] = meta;
        orderedKeys.push(hashName);
        if (meta.bucket) {
          bucketsNeededMap[meta.bucket] = true;
        }
      } else {
        agg[hashName].count += qty;
      }
    }

    var items = [];
    for (var k = 0; k < orderedKeys.length; k++) {
      items.push(agg[orderedKeys[k]]);
    }

    return {
      items: items,
      bucketsNeeded: Object.keys(bucketsNeededMap).sort()
    };
  }

  function isTradingCard(desc, meta) {
    if (meta.itemClass === 'item_class_2') return true;
    var typeLower = String(desc.type || '').toLowerCase();
    return typeLower.indexOf('trading card') !== -1;
  }

  function isEmoticon(desc, meta) {
    if (meta.itemClass === 'item_class_4') return true;
    var typeLower = String(desc.type || '').toLowerCase();
    return typeLower.indexOf('emoticon') !== -1;
  }

  function isProfileBackground(desc, meta) {
    if (meta.itemClass === 'item_class_3') return true;
    var typeLower = String(desc.type || '').toLowerCase();
    return typeLower.indexOf('profile background') !== -1;
  }

  function resolveMarketFeeApp(desc) {
    if (desc.market_fee_app !== undefined && desc.market_fee_app !== null) {
      return String(desc.market_fee_app);
    }
    var m = /^(\d+)-/.exec(String(desc.market_hash_name || ''));
    return m ? m[1] : null;
  }

  function resolveBackgroundName(desc) {
    if (typeof desc.name === 'string' && desc.name.trim()) {
      return desc.name.trim();
    }
    return String(desc.market_hash_name || '').replace(/^\d+-/, '');
  }

  function buildCommunitySummary(merged) {
    var classTotals = Object.create(null);
    var classSampleDesc = Object.create(null);
    var classOrder = [];

    for (var i = 0; i < merged.assets.length; i++) {
      var asset = merged.assets[i];
      var qty = parseAssetAmount(asset.amount);
      if (qty <= 0) continue;

      var cid = String(asset.classid);
      if (!classTotals[cid]) {
        classTotals[cid] = qty;
        classOrder.push(cid);
        var desc = resolveDesc(merged, asset);
        if (desc) classSampleDesc[cid] = desc;
      } else {
        classTotals[cid] += qty;
      }
    }

    var cards = Object.create(null);
    var emoteCount = 0;
    var bgCount = 0;
    var emoticons = [];
    var emoteSeen = Object.create(null);
    var backgrounds = [];
    var bgSeen = Object.create(null);
    var backgroundUrls = [];
    var bgUrlSeen = Object.create(null);

    for (var c = 0; c < classOrder.length; c++) {
      var classId = classOrder[c];
      var totalQty = classTotals[classId];
      if (totalQty <= 0) continue;

      var dObj = classSampleDesc[classId] || merged.descByClass[classId];
      if (!dObj) continue;

      var meta = extractDescriptionMeta(dObj, '753');

      if (isTradingCard(dObj, meta)) {
        var gameAppId = resolveMarketFeeApp(dObj);
        if (!gameAppId) continue;
        if (!cards[gameAppId]) {
          cards[gameAppId] = [0, 0, 0, 0];
        }
        var isFoil = meta.cardBorder === 'cardborder_1' ||
          meta.cardBorder === 'Foil' ||
          /\(Foil Trading Card\)/i.test(String(dObj.type || '')) ||
          /\(Foil\)$/i.test(String(dObj.market_hash_name || ''));
        if (isFoil) {
          cards[gameAppId][2] += totalQty;
          cards[gameAppId][3] += 1;
        } else {
          cards[gameAppId][0] += totalQty;
          cards[gameAppId][1] += 1;
        }
      } else if (isEmoticon(dObj, meta)) {
        emoteCount += 1;
        var rawEmoteName = dObj.name || String(dObj.market_hash_name || '').replace(/^\d+-/, '');
        var cleanEmote = sanitizeEmoteName(rawEmoteName);
        if (cleanEmote && !emoteSeen[cleanEmote]) {
          emoteSeen[cleanEmote] = true;
          emoticons.push(cleanEmote);
        }
      } else if (isProfileBackground(dObj, meta)) {
        bgCount += 1;
        var bgName = resolveBackgroundName(dObj);
        if (bgName && !bgSeen[bgName]) {
          bgSeen[bgName] = true;
          backgrounds.push(bgName);
        }
        var bgHash = String(dObj.market_hash_name || '').trim();
        var bgKey = bgHash ? ('753/' + quoteSteamKey(bgHash)) : bgName;
        if (bgKey && !bgUrlSeen[bgKey]) {
          bgUrlSeen[bgKey] = true;
          backgroundUrls.push(bgKey);
        }
      }
    }

    return {
      cards: cards,
      emote_count: emoteCount,
      bg_count: bgCount,
      emoticons: emoticons,
      backgrounds: backgrounds,
      background_urls: backgroundUrls
    };
  }

  function parseInventoryPayload(payload, options) {
    var opts = options || {};
    var mode = opts.mode || 'auto';
    var normalized = normalizeRawInputs(payload, mode);

    if (normalized.sawEmoticonList && normalized.pages.length === 0) {
      return {
        kind: 'emoticon_list',
        isEmoticonList: true,
        isEmptyArray: normalized.sawEmptyArray,
        page_count: 0,
        asset_count: normalized.emotes.length,
        total_inventory_count: normalized.emotes.length,
        more_items: false,
        last_assetid: null,
        detected_appid: '753',
        items: [],
        bucketsNeeded: [],
        cards: {},
        emote_count: normalized.emotes.length,
        bg_count: 0,
        emoticons: normalized.emotes,
        backgrounds: [],
        background_urls: []
      };
    }

    var merged = mergeSteamPages(normalized.pages);
    var targetAppId = opts.appid || merged.detected_appid || '753';
    var valued = buildItemValueItems(merged, targetAppId);
    var community = buildCommunitySummary(merged);

    return {
      kind: 'steam_inventory',
      isEmoticonList: false,
      isEmptyArray: false,
      page_count: merged.page_count,
      asset_count: merged.assets.length,
      total_inventory_count: merged.total_inventory_count,
      more_items: merged.more_items,
      last_assetid: merged.last_assetid,
      detected_appid: merged.detected_appid || targetAppId,
      items: valued.items,
      bucketsNeeded: valued.bucketsNeeded,
      cards: community.cards,
      emote_count: community.emote_count,
      bg_count: community.bg_count,
      emoticons: community.emoticons,
      backgrounds: community.backgrounds,
      background_urls: community.background_urls
    };
  }

  return {
    quoteSteamKey: quoteSteamKey,
    fnv1a32: fnv1a32,
    fnv1a32Hex2: fnv1a32Hex2,
    parseAssetAmount: parseAssetAmount,
    sanitizeEmoteName: sanitizeEmoteName,
    normalizeRawInputs: normalizeRawInputs,
    mergeSteamPages: mergeSteamPages,
    buildItemValueItems: buildItemValueItems,
    buildCommunitySummary: buildCommunitySummary,
    parseInventoryPayload: parseInventoryPayload
  };
});
