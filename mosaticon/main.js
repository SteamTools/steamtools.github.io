/* global kdTree */
/* global RGB_to_HSL */
/* global RGB_to_Lab */

angular.module('mosaticonApp', ['ui.bootstrap', 'cfp.hotkeys'])
.config(['$tooltipProvider', function($tooltipProvider){
    $tooltipProvider.setTriggers({
        'mouseenter': 'mouseleave',
        'click': 'click',
        'focus': 'blur',
        'show': 'mouseleave'
	});
}])
.directive('ngRightClick', function($parse) {
		return function(scope, element, attrs) {
				var fn = $parse(attrs.ngRightClick);
				element.bind('contextmenu', function(event) {
						scope.$apply(function() {
								event.preventDefault();
								fn(scope, {$event:event});
						});
				});
		};
})
.filter('charSum', function() {
	return function(data) {
		if (typeof(data) === 'undefined') {
			return 0;
		}

		var sum = 0;
		for (var i = 0; i < data.length; i++) {
			for (var j = 0; j < data[i].length; j++) {
				if (data[i][j] === undefined) continue;
				sum += data[i][j].name.length + 2;
			}
			sum += 1;
		}

		return sum;
	};
})
.controller('mosaticonCtrl', ['$scope', '$http', '$timeout', '$filter', '$modal', 'hotkeys',
function($scope, $http, $timeout, $filter, $modal, hotkeys){
	var CFG = window.STEAMTOOLS_CONFIG;
	var ColorTools = window.MosaticonColors;
	var loadGeneration = 0;

	$scope.orderBy = $filter('orderBy');
	$scope.CDN = CFG.EMOTE_CORS_BASE;
	$scope.EMOTE_IMG_BASE = CFG.STEAM_ECON_BASE + "/emoticon";
	$scope.width = new Size(30);
	$scope.height = new Size(30);
	$scope.status = "";
	$scope.compareMode = "rgb";
	$scope.sortMode = "hue";
	$scope.quality = "1";
	$scope.tool = "pen";
	$scope.q = 1;
	$scope.charCount = 0;
	$scope.updateCharCount = function() {
		$scope.charCount = $filter('charSum')($scope.mosaic);
	};

	if (localStorage.hasOwnProperty("lastUser")) {
		$scope.UserID = localStorage.lastUser;
	}

	// ---- Precomputed emote_colors.json + IndexedDB (v1:<name>) fallback cache ----
	var COLOR_DB_NAME = 'steamtools_mosaticon_colors_v1';
	var COLOR_STORE_NAME = 'emote_colors';
	var _colorDbPromise = null;
	var _memEmoteBytes = new Map();
	var _emoteCatalogPromise = null;

	function openColorDb() {
		if (_colorDbPromise) return _colorDbPromise;
		if (!window.indexedDB) return Promise.resolve(null);
		_colorDbPromise = new Promise(function(resolve) {
			try {
				var req = window.indexedDB.open(COLOR_DB_NAME, 1);
				req.onupgradeneeded = function() {
					var db = req.result;
					if (!db.objectStoreNames.contains(COLOR_STORE_NAME)) {
						db.createObjectStore(COLOR_STORE_NAME);
					}
				};
				req.onsuccess = function() { resolve(req.result); };
				req.onerror = function() { resolve(null); };
			} catch (e) {
				resolve(null);
			}
		});
		return _colorDbPromise;
	}

	function idbGetManyEmoteBytes(names) {
		var found = Object.create(null);
		var missing = [];
		for (var i = 0; i < names.length; i++) {
			var name = names[i];
			if (!name) continue;
			var key = 'v1:' + name;
			if (_memEmoteBytes.has(key)) {
				found[name] = _memEmoteBytes.get(key);
			} else {
				missing.push(name);
			}
		}
		if (missing.length === 0) {
			return Promise.resolve(found);
		}
		return openColorDb().then(function(db) {
			if (!db) return found;
			return new Promise(function(resolve) {
				var settled = false;
				var finish = function() {
					if (settled) return;
					settled = true;
					resolve(found);
				};
				try {
					var tx = db.transaction(COLOR_STORE_NAME, 'readonly');
					var store = tx.objectStore(COLOR_STORE_NAME);
					tx.oncomplete = finish;
					tx.onerror = finish;
					tx.onabort = finish;
					for (var m = 0; m < missing.length; m++) {
						(function(n) {
							var k = 'v1:' + n;
							var req = store.get(k);
							req.onsuccess = function() {
								var val = req.result;
								if (Array.isArray(val) && val.length === 42) {
									_memEmoteBytes.set(k, val);
									found[n] = val;
								}
							};
						})(missing[m]);
					}
				} catch (e) {
					finish();
				}
			});
		});
	}

	function idbPutManyEmoteBytes(entries) {
		if (!Array.isArray(entries) || entries.length === 0) return;
		var valid = [];
		for (var i = 0; i < entries.length; i++) {
			var ent = entries[i];
			if (!ent || !ent.name || !Array.isArray(ent.bytes42) || ent.bytes42.length !== 42) continue;
			_memEmoteBytes.set('v1:' + ent.name, ent.bytes42);
			valid.push(ent);
		}
		if (valid.length === 0) return;
		openColorDb().then(function(db) {
			if (!db) return;
			try {
				var tx = db.transaction(COLOR_STORE_NAME, 'readwrite');
				var store = tx.objectStore(COLOR_STORE_NAME);
				for (var j = 0; j < valid.length; j++) {
					store.put(valid[j].bytes42, 'v1:' + valid[j].name);
				}
			} catch (e) {
				// Ignore storage quota / private mode failures
			}
		});
	}

	function idbGetEmoteBytes(name) {
		var key = 'v1:' + name;
		if (_memEmoteBytes.has(key)) {
			return Promise.resolve(_memEmoteBytes.get(key));
		}
		return idbGetManyEmoteBytes([name]).then(function(found) {
			return found[name] || null;
		});
	}

	function idbPutEmoteBytes(name, bytes42) {
		idbPutManyEmoteBytes([{ name: name, bytes42: bytes42 }]);
	}

	function b64ToBytes42(b64) {
		if (typeof b64 !== 'string' || !b64) return null;
		try {
			var bin = atob(b64);
			if (bin.length !== 42) return null;
			var arr = new Array(42);
			for (var i = 0; i < 42; i++) {
				arr[i] = bin.charCodeAt(i) & 0xFF;
			}
			return arr;
		} catch (e) {
			return null;
		}
	}

	function loadEmoteColorsCatalog() {
		if (_emoteCatalogPromise) return _emoteCatalogPromise;
		_emoteCatalogPromise = CFG.getDatasetJson($http, 'data/emote_colors.json').then(function(body) {
			if (body && body.emotes && typeof body.emotes === 'object') {
				return body.emotes;
			}
			return null;
		}, function() {
			return null;
		});
		return _emoteCatalogPromise;
	}

	function cacheColorMapToIdb(colorMap, resolvedOut) {
		if (!colorMap || typeof colorMap !== 'object') return;
		var keys = Object.keys(colorMap);
		var batch = [];
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			var b64 = colorMap[k];
			if (typeof b64 === 'string' && b64) {
				resolvedOut[k] = b64;
				var bytes42 = b64ToBytes42(b64);
				if (bytes42) {
					batch.push({ name: k, bytes42: bytes42 });
				}
			}
		}
		idbPutManyEmoteBytes(batch);
	}

	function postEmoteColorsBatch(namesBatch) {
		var req = typeof CFG.httpRequestWithFailover === 'function'
			? CFG.httpRequestWithFailover($http, '/v1/emote-colors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				data: { names: namesBatch }
			})
			: $http.post(CFG.API_BASE + '/v1/emote-colors', { names: namesBatch });
		return req.then(function(resp) {
			var body = resp && resp.data;
			if (body && body.colors && typeof body.colors === 'object') {
				return body.colors;
			}
			return null;
		}, function() {
			return null;
		});
	}

	function resolveEmoteColorsForNames(namesList, inlineColors) {
		var resolved = Object.create(null);
		cacheColorMapToIdb(inlineColors, resolved);

		var remaining = [];
		for (var i = 0; i < namesList.length; i++) {
			var name = namesList[i];
			if (name && !Object.prototype.hasOwnProperty.call(resolved, name)) {
				remaining.push(name);
			}
		}
		if (remaining.length === 0) {
			return Promise.resolve(resolved);
		}

		return idbGetManyEmoteBytes(remaining).then(function(foundMap) {
			var stillMissing = [];
			for (var m = 0; m < remaining.length; m++) {
				if (!foundMap[remaining[m]]) {
					stillMissing.push(remaining[m]);
				}
			}
			if (stillMissing.length === 0) {
				return resolved;
			}

			var seenShards = Object.create(null);
			var shardList = [];
			if (typeof CFG.fnv1a32Hex64 === 'function') {
				for (var s = 0; s < stillMissing.length; s++) {
					var hx = CFG.fnv1a32Hex64(stillMissing[s]);
					if (!seenShards[hx]) {
						seenShards[hx] = true;
						shardList.push(hx);
					}
				}
			}

			if (shardList.length > 0 && shardList.length <= 8) {
				return Promise.all(shardList.map(function(hex2) {
					return CFG.getDatasetJson($http, 'data/emote_colors/' + hex2 + '.json').catch(function() {
						return null;
					});
				})).then(function(shardDocs) {
					var anyShardOk = false;
					for (var j = 0; j < shardDocs.length; j++) {
						var doc = shardDocs[j];
						if (doc && typeof doc === 'object') {
							anyShardOk = true;
							cacheColorMapToIdb(doc, resolved);
						}
					}
					if (anyShardOk) {
						return resolved;
					}
					return loadEmoteColorsCatalog().then(function(monolith) {
						return monolith || resolved;
					});
				});
			}

			var chunks = [];
			for (var c = 0; c < stillMissing.length; c += 2000) {
				chunks.push(stillMissing.slice(c, c + 2000));
			}

			var anyFailed = false;
			var idx = 0;
			var workers = [];
			var cap = Math.min(2, chunks.length);
			function nextChunk() {
				if (idx >= chunks.length) return Promise.resolve();
				var batch = chunks[idx++];
				return postEmoteColorsBatch(batch).then(function(colors) {
					if (colors) {
						cacheColorMapToIdb(colors, resolved);
					} else {
						anyFailed = true;
					}
					return nextChunk();
				});
			}
			for (var w = 0; w < cap; w++) {
				workers.push(nextChunk());
			}
			return Promise.all(workers).then(function() {
				if (!anyFailed) {
					return resolved;
				}
				return loadEmoteColorsCatalog().then(function(monolith) {
					if (monolith) {
						return Object.assign(Object.create(null), monolith, resolved);
					}
					return resolved;
				});
			});
		});
	}

	function applyDecodedVectors(e, vecs) {
		e.rgb1 = vecs.rgb1;
		e.lab1 = vecs.lab1;
		e.hsl1 = vecs.hsl1;
		e.rgb2 = vecs.rgb2;
		e.lab2 = vecs.lab2;
		e.hsl2 = vecs.hsl2;
		e.rgb3 = vecs.rgb3;
		e.lab3 = vecs.lab3;
		e.hsl3 = vecs.hsl3;
		e.hue = vecs.hue;
	}

	$scope.loadInventory = function(initialJson) {
		if (!window.SteamToolsImport) return;
		var idHint = String($scope.UserID || '').trim();
		window.SteamToolsImport.openImportDialog({
			mode: 'emotes',
			appid: '753',
			contextid: '6',
			steamId: idHint,
			initialJson: typeof initialJson === 'string' ? initialJson : undefined,
			title: 'Load Owned Emoticons',
			subtitle: 'Paste EmoticonList JSON (even []), or paste/drop/bookmarklet-sync your 753/6 Steam inventory JSON.',
			onImport: function(parsed) {
				$scope.$applyAsync(function() {
					var DEFAULT_EMOTES = [
						'steambored',
						'steamfacepalm',
						'steamhappy',
						'steammocking',
						'steamsad',
						'steamsalty'
					];
					var imported = Array.isArray(parsed && parsed.emoticons) ? parsed.emoticons : [];
					var seen = Object.create(null);
					var emotes = [];
					var i;
					for (i = 0; i < imported.length; i++) {
						if (imported[i] && !seen[imported[i]]) {
							seen[imported[i]] = true;
							emotes.push(imported[i]);
						}
					}
					for (i = 0; i < DEFAULT_EMOTES.length; i++) {
						if (!seen[DEFAULT_EMOTES[i]]) {
							seen[DEFAULT_EMOTES[i]] = true;
							emotes.push(DEFAULT_EMOTES[i]);
						}
					}
					$scope.loadEmotes(emotes);
				});
			}
		});
	};

	if (typeof CFG.attachSteamIdPasteGuard === 'function') {
		CFG.attachSteamIdPasteGuard(document.getElementById('mos-userid'), {
			onJsonPaste: function(text) {
				$scope.$applyAsync(function() {
					$scope.loadInventory(text);
				});
			},
			onOversizedPaste: function() {
				$scope.$applyAsync(function() {
					$scope.status = "Pasted text is too long for a SteamID — click Import… to paste JSON.";
				});
			}
		});
	}

	$scope.emoticons = [];
	$scope.usedEmotes = [];
	$scope.emoteTree = new kdTree([], dist, rangeArray(3));
	$scope.toProcess = 0;

	$scope.loadEmoticons = function(){
		var u = ($scope.UserID || '').trim();
		if (u.charAt(0) === ":" && u.slice(-1) === ":" && u.length > 2) {
			var cleanName = window.SteamToolsImport && window.SteamToolsImport.sanitizeEmoteName
				? window.SteamToolsImport.sanitizeEmoteName(u.slice(1, -1))
				: u.slice(1, -1);
			if (!cleanName) return;
			if ($scope.emoticons.some(function(ex) { return ex.name === cleanName; })) {
				return;
			}
			var activeGen = loadGeneration;
			$scope.toProcess += 1;
			var emote = {'name': cleanName, 'index': $scope.emoticons.length};
			emote.nsize = emote.name.length;
			emote.disable = false;
			emote.used = false;
			resolveEmoteColorsForNames([cleanName], null).then(function(catalog) {
				$scope.getEmoticonColor(emote, catalog, activeGen);
			});
		} else if (!u) {
			$scope.loadInventory();
		} else {
			$scope.status = "Loading emoticons...";
			var emotePath = '/FetchEmotes?id=' + encodeURIComponent(u);
			var emoteReq = typeof CFG.httpRequestWithFailover === 'function'
				? CFG.httpRequestWithFailover($http, emotePath, { method: 'GET', withCredentials: true })
				: $http.get(CFG.API_BASE + emotePath, { withCredentials: true });
			emoteReq.then(function(resp) {
				$scope.$applyAsync(function() {
					var data = resp && resp.data;
					if (data && data.success && Array.isArray(data.items)) {
						localStorage.lastUser = u;
						$scope.loadEmotes(data.items, data.colors);
						return;
					}
					var reason = (data && data.reason) || "Could not load emoticons.";
					if (data && (data.error === 'private_or_unavailable' || data.error === 'rate_limited')) {
						$scope.status = reason + " Use the Import dialog to load directly.";
						$scope.loadInventory();
					} else {
						$scope.status = reason + (data && data.help === 2
							? " Try your Steam custom URL or full profile link, or leave blank to import JSON."
							: "");
					}
				});
			}, function(errResp) {
				$scope.$applyAsync(function() {
					var d = errResp && errResp.data;
					var reason = (d && d.reason) || "Could not load emoticons.";
					if (errResp && (errResp.status === 403 || errResp.status === 429 || errResp.status === 503)) {
						$scope.status = reason + " Use the Import dialog to load directly.";
						$scope.loadInventory();
					} else {
						$scope.status = reason + (d && d.help === 2
							? " Try your Steam custom URL or full profile link, or leave blank to import JSON."
							: "");
					}
				});
			});
		}
	};

	$scope.loadEmotes = function(emotes, inlineColors) {
		var gen = ++loadGeneration;
		var seen = Object.create(null);
		var cleanEmotes = [];
		var rawList = Array.isArray(emotes) ? emotes : [];

		for (var idx = 0; idx < rawList.length; idx++) {
			var item = rawList[idx];
			var rawName = typeof item === 'string'
				? item
				: (item && typeof item.name === 'string' ? item.name : '');
			var name = window.SteamToolsImport && window.SteamToolsImport.sanitizeEmoteName
				? window.SteamToolsImport.sanitizeEmoteName(rawName)
				: String(rawName).trim().replace(/^:+|:+$/g, '');
			if (name && !seen[name]) {
				seen[name] = true;
				cleanEmotes.push(name);
			}
		}

		localStorage.lastEmotes = JSON.stringify(cleanEmotes);
		$scope.processedEmotes = false;
		$scope.emoticons = [];
		$scope.usedEmotes = [];
		$scope.selectedEmote = undefined;
		$scope.emoteTree = new kdTree([], dist, rangeArray(3));
		$scope.toProcess = cleanEmotes.length;

		if (cleanEmotes.length === 0) {
			$scope.status = "No emoticons loaded.";
			return;
		}

		$scope.status = "Processing...";
		resolveEmoteColorsForNames(cleanEmotes, inlineColors).then(function(catalog) {
			if (gen !== loadGeneration) return;
			for (var i = 0; i < cleanEmotes.length; i++) {
				var emote = {'name': cleanEmotes[i], 'index': i};
				emote.nsize = emote.name.length;
				emote.disable = false;
				emote.used = false;
				$scope.getEmoticonColor(emote, catalog, gen);
			}
		});
	};

	function rebuildEmoteTree(emotesList) {
		var points = [];
		for (var i = 0; i < emotesList.length; i++) {
			var em = emotesList[i];
			if (em && em.rgb1) {
				var pt = arrayToObject(em.rgb1);
				pt.emote = em;
				points.push(pt);
			}
		}
		return new kdTree(points, dist, rangeArray(3));
	}

	function commitEmoteVectors(e, vecs, gen) {
		if (gen !== loadGeneration) return;
		applyDecodedVectors(e, vecs);
		if (!$scope.selectedEmote) {
			$scope.selectedEmote = e;
			$scope.selectedEmote.select = true;
		}
		$scope.emoticons.push(e);
		$scope.process(gen);
	}

	var _canvasQueue = [];
	var _canvasActive = 0;
	var MAX_CANVAS_CONCURRENCY = 6;

	function drainCanvasQueue() {
		while (_canvasActive < MAX_CANVAS_CONCURRENCY && _canvasQueue.length > 0) {
			var task = _canvasQueue.shift();
			if (task.gen !== loadGeneration) {
				continue;
			}
			_canvasActive++;
			startCanvasExtract(task.e, task.gen);
		}
	}

	function startCanvasExtract(e, gen) {
		var emoteCvs = document.createElement('canvas');
		emoteCvs.width = 18;
		emoteCvs.height = 18;

		var ctx = emoteCvs.getContext("2d", {willReadFrequently: true});
		var img = document.createElement("img");
		img.crossOrigin = "Anonymous";
		var finished = false;
		function finishTask() {
			if (finished) return;
			finished = true;
			_canvasActive = Math.max(0, _canvasActive - 1);
			drainCanvasQueue();
			$scope.process(gen);
		}
		img.onload = function() {
			if (gen !== loadGeneration) {
				finishTask();
				return;
			}
			try {
				ctx.clearRect(0, 0, 18, 18);
				ctx.drawImage(img, 0, 0, 18, 18);
				var bytes42 = [];
				for (var i = 1; i <= 3; i++) {
					var step = 18 / i;
					for (var y = 0; y < i; y++) {
						for (var x = 0; x < i; x++) {
							var data = ctx.getImageData(x * step, y * step, step, step);
							var rgbByte = ColorTools.extractBlockByteRgbFromRgba(data.data);
							bytes42.push(rgbByte[0], rgbByte[1], rgbByte[2]);
						}
					}
				}
				idbPutEmoteBytes(e.name, bytes42);
				var vecs = ColorTools.decodeEmoteColorBytes(bytes42);
				if (vecs) {
					finished = true;
					_canvasActive = Math.max(0, _canvasActive - 1);
					drainCanvasQueue();
					commitEmoteVectors(e, vecs, gen);
					return;
				}
			} catch (err) {
				// Canvas tainted or unreadable
			}
			finishTask();
		};
		img.onerror = finishTask;
		img.src = CFG.EMOTE_CORS_BASE + '/' + encodeURIComponent(e.name);
	}

	function extractEmoteFromCanvas(e, gen) {
		if (gen !== loadGeneration) return;
		_canvasQueue.push({ e: e, gen: gen });
		drainCanvasQueue();
	}

	$scope.getEmoticonColor = function(e, catalog, expectedGen) {
		var gen = expectedGen !== undefined ? expectedGen : loadGeneration;

		if (catalog && Object.prototype.hasOwnProperty.call(catalog, e.name)) {
			var decoded = ColorTools.decodeEmoteColorB64(catalog[e.name]);
			if (decoded) {
				commitEmoteVectors(e, decoded, gen);
				return;
			}
		}

		idbGetEmoteBytes(e.name).then(function(cachedBytes) {
			if (gen !== loadGeneration) return;
			if (cachedBytes) {
				var decodedCached = ColorTools.decodeEmoteColorBytes(cachedBytes);
				if (decodedCached) {
					commitEmoteVectors(e, decodedCached, gen);
					return;
				}
			}
			extractEmoteFromCanvas(e, gen);
		});
	};

	$scope.getHue = function(hsl) {
		var hue = hsl[0];
		var sat = hsl[1];

		if (sat < 0.005)
			hue = 0;

		return hue;
	};

	$scope.processedEmotes = false;
	$scope.process = function(gen) {
		if (gen !== undefined && gen !== loadGeneration) return;
		$scope.$applyAsync(function() {
			if (gen !== undefined && gen !== loadGeneration) return;
			$scope.toProcess -= 1;
			if ($scope.toProcess <= 0) {
				$scope.toProcess = 0;
				$scope.emoticons = $scope.orderBy($scope.emoticons, 'hue');
				$scope.emoteTree = rebuildEmoteTree($scope.emoticons);
				$scope.processedEmotes = $scope.emoticons.length > 0;
				$scope.status = $scope.emoticons.length > 0 ? "" : "Could not load emoticon images.";
				if ($scope.emoticons.length > 0) {
					if (!$scope.imageLoaded && !$scope.blankLoaded) {
						$timeout($scope.displayEmoticons, 0);
					} else if ($scope.imageLoaded) {
						$timeout($scope.generateMosaic, 0);
					}
				}
			}
		});
	};

	$scope.displayEmoticons = function() {
		$scope.mosaic = [];
		var cols = Math.max(1, ($scope.width && $scope.width.value) || 30);
		for (var i = 0; i < $scope.emoticons.length; i += cols) {
			$scope.mosaic.push($scope.emoticons.slice(i, i + cols));
		}
		$scope.updateCharCount();
	};

	$scope.averageColor = function(colors) {
		var reds = 0, greens = 0, blues = 0, count = 0;
		for (var i = 0; i < colors.length; i+=4) {
			var a = colors[i + 3] / 255;
			reds   += colors[i + 0] * a + 25 * (1 - a);
			greens += colors[i + 1] * a + 25 * (1 - a);
			blues  += colors[i + 2] * a + 25 * (1 - a);
			count += 1;
		}
		var div = count * 255;
		return [reds / div, greens / div, blues / div];
	};

	$scope.imageLoaded = false;
	$scope.handleImage = function handleImage(e){
		var reader = new FileReader();
		reader.onload = function(event){
			var img = new Image();
			img.onload = function(){
				$scope.originalCvs.width = img.width;
				$scope.originalCvs.height = img.height;
				var ctx = $scope.originalCvs.getContext("2d");
				ctx.drawImage(img, 0, 0);
				$scope.imageLoaded = true;
				$scope.blankLoaded = false;
				$timeout($scope.updateUpscale, 0);
			};
			img.src = event.target.result;
		};
		reader.readAsDataURL(e.target.files[0]);
	};

	$scope.updateUpscale = function() {
		if ($scope.blankLoaded || !$scope.imageLoaded || !$scope.originalCvs.width) return;

		var ratio = $scope.originalCvs.height / $scope.originalCvs.width;
		$scope.q = parseInt($scope.quality, 10);
		var width = $scope.width.value * $scope.q;
		$scope.height.value = Math.floor($scope.width.value * ratio);
		var height = $scope.height.value * $scope.q;
		var upscaledHeight = Math.floor(200 * ratio);

		$scope.smallCvs.width = width;
		$scope.smallCvs.height = height;

		var smallCtx = $scope.smallCvs.getContext('2d');
		smallCtx.drawImage($scope.originalCvs, 0, 0, width, height);

		$scope.upscaledCvs.height = upscaledHeight;
		var upscaledCtx = $scope.upscaledCvs.getContext('2d');
		upscaledCtx.mozImageSmoothingEnabled = false;
		upscaledCtx.webkitImageSmoothingEnabled = false;
		upscaledCtx.msImageSmoothingEnabled = false;
		upscaledCtx.imageSmoothingEnabled = false;
		upscaledCtx.drawImage($scope.smallCvs, 0, 0, 200, upscaledHeight);

		$scope.generateMosaic();
	};

	$scope.generateMosaic = function() {
		if ($scope.emoticons.length === 0 || !$scope.imageLoaded) return;

		var q = $scope.q;
		var dims = rangeArray(q * q * 3);
		var points = [];

		var emote, obj;
		for (var j = 0; j < $scope.emoticons.length; j++) {
			emote = $scope.emoticons[j];
			emote.used = false;
			if (!emote.disable) {
				obj = arrayToObject(emote[$scope.compareMode + q]);
				obj.emote = emote;
				points.push(obj);
			}
		}
		var tree = new kdTree(points, dist, dims);
		$scope.usedEmotes = [];

		var ctx = $scope.smallCvs.getContext("2d", {willReadFrequently: true});
		var sw = $scope.smallCvs.width;
		var sh = $scope.smallCvs.height;
		$scope.mosaic = [];
		if (sw <= 0 || sh <= 0) {
			$scope.updateCharCount();
			return;
		}
		var fullData = ctx.getImageData(0, 0, sw, sh).data;
		for (var y = 0; y < sh; y += q) {
			var row = [];
			for (var x = 0; x < sw; x += q) {
				var color = [];
				for (var dy = 0; dy < q; dy++) {
					for (var dx = 0; dx < q; dx++) {
						var idx = ((y + dy) * sw + (x + dx)) * 4;
						var r, g, b, a = fullData[idx + 3] / 255;
						r = (fullData[idx + 0] * a + 25 * (1 - a)) / 255;
						g = (fullData[idx + 1] * a + 25 * (1 - a)) / 255;
						b = (fullData[idx + 2] * a + 25 * (1 - a)) / 255;
						if ($scope.compareMode === "rgb") {
							color.push(r, g, b);
						} else if ($scope.compareMode === "lab") {
							var lab = RGB_to_Lab(r, g, b);
							color.push(lab[0], lab[1], lab[2]);
						} else if ($scope.compareMode === "hsl") {
							var hsl = RGB_to_HSL(r, g, b);
							color.push(hsl[0], hsl[1], hsl[2]);
						}
					}
				}
				var e = tree.nearest(color, 1)[0][0].emote;
				if (!e.used) {
					e.used = true;
					$scope.usedEmotes.push(e);
				}
				row.push(e);
			}
			$scope.mosaic.push(row);
		}
		$scope.updateCharCount();
	};

	$scope.toggleEmote = function(emote) {
		emote.disable = !emote.disable;
		$scope.generateMosaic();
	};

	$scope.selectedEmote = undefined;
	$scope.selectEmote = function(event, emote) {
		if ($scope.selectedEmote !== undefined) {
			$scope.selectedEmote.select = false;
		}

		emote.select = true;
		$scope.selectedEmote = emote;
	};

	$scope.editEmote = function(e, y, x) {
		var e2, e1 = $scope.mosaic[y][x];
		var similar = $scope.emoteTree.nearest(e1.rgb1, 6);
		for (var i = 0; i < similar.length; i++) {
			e2 = similar[i][0].emote;
			if (e1 === e2) continue;
		}
	};

	$scope.exportMosaic = function() {
		var result = "";
		for (var y = 0; y < $scope.mosaic.length; y++) {
			for (var x = 0; x < $scope.mosaic[y].length; x++) {
				var e = $scope.mosaic[y][x];
				if (e === undefined) break;
				result += ":" + e.name + ":";
			}
			result += "\n";
		}
		if (window.STEAMTOOLS_CONFIG && typeof window.STEAMTOOLS_CONFIG.openTextExportDialog === 'function') {
			window.STEAMTOOLS_CONFIG.openTextExportDialog({
				title: 'Export Emoticon Mosaic',
				label: 'Copy and paste into a Steam profile showcase or comment',
				text: result,
				filename: 'mosaticon.txt'
			});
		}
	};

	$scope.importMenu = function () {
		return $modal.open({
			templateUrl: 'importMenu.html',
			controller: ImportMenuCtrl,
			size: 'lg',
			scope: $scope
		}).result;
	};

	function getMosaicLocalCoords(ev) {
		var mdiv = document.getElementById("mosaic");
		if (!mdiv) return { x: 0, y: 0 };
		var rect = mdiv.getBoundingClientRect();
		var cs = window.getComputedStyle(mdiv);
		var padL = parseFloat(cs.paddingLeft) || 0;
		var padT = parseFloat(cs.paddingTop) || 0;
		return {
			x: ev.clientX - rect.left - mdiv.clientLeft - padL + mdiv.scrollLeft,
			y: ev.clientY - rect.top - mdiv.clientTop - padT + mdiv.scrollTop
		};
	}

	$scope.mouseMove = function(e) {
		if (!$scope.clicking) return;
		if (!$scope.mosaic || !$scope.mosaic.length || !$scope.mosaic[0] || !$scope.mosaic[0].length) return;

		var coords = getMosaicLocalCoords(e);
		var x = coords.x;
		var y = coords.y;
		var y1 = Math.max(0, Math.min(Math.floor(y / 18), $scope.mosaic.length - 1));
		var rowLen = $scope.mosaic[y1] ? $scope.mosaic[y1].length : 0;
		if (rowLen === 0) return;
		var x1 = Math.max(0, Math.min(Math.floor(x / 18), rowLen - 1));

		var y2 = Math.floor($scope.startY / 18);
		y2 = Math.max(0, Math.min(y2, $scope.mosaic.length - 1));
		var rowLen2 = $scope.mosaic[y2] ? $scope.mosaic[y2].length : rowLen;
		var x2 = Math.max(0, Math.min(Math.floor($scope.startX / 18), rowLen2 - 1));

		var i, j;
		var dx = Math.abs(x2 - x1);
		var dy = Math.abs(y2 - y1);
		var sx = x1 < x2 ? 1 : -1;
		var sy = y1 < y2 ? 1 : -1;

		if ($scope.tool !== "pen" && Array.isArray($scope.mosaicCopy)) {
			for (j = 0; j < $scope.mosaicCopy.length; j++) {
				var copyRow = $scope.mosaicCopy[j];
				var dstRow = $scope.mosaic[j];
				if (!dstRow) continue;
				for (i = 0; i < copyRow.length; i++) {
					if (dstRow[i] !== copyRow[i]) {
						dstRow[i] = copyRow[i];
					}
				}
			}
		}

		if ($scope.tool === "pen") {
			$scope.mosaic[y1][x1] = $scope.selectedEmote;
		} else if ($scope.tool === "line") {
			var err = dx - dy;

			if (e.shiftKey) {
				if (2 * dx < dy) {
					for (i = Math.min(y1, y2); i < Math.max(y1, y2); i++) {
						$scope.mosaic[i][x2] = $scope.selectedEmote;
					}
				} else if (2 * dy < dx) {
					for (i = Math.min(x1, x2); i < Math.max(x1, x2); i++) {
						$scope.mosaic[y2][i] = $scope.selectedEmote;
					}
				} else {
					var px, py;
					for (i = 0; i < Math.max(dx, dy); i++) {
						py = y2 - i * sy;
						px = x2 - i * sx;
						if (py < 0 || py >= $scope.mosaic.length) continue;
						if (px < 0 || px >= $scope.mosaic[py].length) continue;
						$scope.mosaic[py][px] = $scope.selectedEmote;
					}
				}
			} else {
				while (true) {
					$scope.mosaic[y1][x1] = $scope.selectedEmote;
					if (x1 === x2 && y1 === y2) break;
					var e2 = 2 * err;
					if (e2 > -dy) {
						err -= dy;
						x1 += sx;
					}
					if (e2 < dx) {
						err += dx;
						y1 += sy;
					}
				}
			}
		} else if ($scope.tool === "rect") {
			if (e.shiftKey) {
				var md = Math.max(dx, dy);
				x1 = x2 - md * sx;
				y1 = y2 - md * sy;
			}
			for (j = Math.min(y1, y2); j <= Math.max(y1, y2); j++) {
				if (j < 0 || j >= $scope.mosaic.length) continue;
				for (i = Math.min(x1, x2); i <= Math.max(x1, x2); i++) {
					if (i < 0 || i >= $scope.mosaic[j].length) continue;
					$scope.mosaic[j][i] = $scope.selectedEmote;
				}
			}
		} else if ($scope.tool === "circ") {
			var cx = x2 * 18 + 9;
			var cy = y2 * 18 + 9;
			if (e.altKey) {
				cx = Math.round((x1 + x2) / 2) * 18 + 9;
				cy = Math.round((y1 + y2) / 2) * 18 + 9;
			}
			var rx = Math.pow(x - cx, 2);
			var ry = Math.pow(y - cy, 2);
			if (e.shiftKey) rx = ry = Math.max(rx, ry);
			rx = Math.max(0.5, rx);
			ry = Math.max(0.5, ry);
			for (j = 0; j < $scope.mosaic.length; j++) {
				for (i = 0; i < $scope.mosaic[j].length; i++) {
					var d = Math.pow(i * 18 + 9 - cx, 2) / rx;
					d += Math.pow(j * 18 + 9 - cy, 2) / ry;
					if (d < 1) $scope.mosaic[j][i] = $scope.selectedEmote;
				}
			}
		} else if ($scope.tool === "move") {
			var emote1 = $scope.mosaic[y1][x1];
			var emote2 = $scope.mosaic[y2][x2];
			if (!e.shiftKey) $scope.mosaic[y1][x1] = emote2;
			if (!e.altKey) $scope.mosaic[y2][x2] = emote1;
		} else if ($scope.tool === "fill") {
			var target = $scope.mosaic[y1][x1];
			for (j = 0; j < $scope.mosaic.length; j++) {
				for (i = 0; i < $scope.mosaic[j].length; i++) {
					if ($scope.mosaic[j][i] === target) {
						$scope.mosaic[j][i] = $scope.selectedEmote;
					}
				}
			}
		}
		$scope.updateCharCount();
	};

	$scope.startX = 0;
	$scope.startY = 0;
	var _dragRafId = null;
	var _pendingMoveEvent = null;

	function onWindowMouseMove(ev) {
		if (!$scope.clicking) return;
		_pendingMoveEvent = ev;
		if (_dragRafId !== null) return;
		_dragRafId = window.requestAnimationFrame(function() {
			_dragRafId = null;
			var moveEv = _pendingMoveEvent;
			_pendingMoveEvent = null;
			if (!moveEv || !$scope.clicking) return;
			$scope.$applyAsync(function() {
				if ($scope.clicking) {
					$scope.mouseMove(moveEv);
				}
			});
		});
	}

	function detachDragListeners() {
		window.removeEventListener('mousemove', onWindowMouseMove);
		if (_dragRafId !== null) {
			window.cancelAnimationFrame(_dragRafId);
			_dragRafId = null;
		}
		_pendingMoveEvent = null;
	}

	$scope.mouseDown = function(e) {
		if (!$scope.mosaic || !$scope.mosaic.length || !$scope.mosaic[0] || !$scope.mosaic[0].length) return;
		$scope.clicking = true;
		$scope.mosaicCopy = copyMatrix($scope.mosaic);

		var coords = getMosaicLocalCoords(e);
		$scope.startX = coords.x;
		$scope.startY = coords.y;

		detachDragListeners();
		window.addEventListener('mousemove', onWindowMouseMove);
		$scope.mouseMove(e);
	};

	$scope.mouseUp = function() {
		detachDragListeners();
		if (!$scope.clicking) return;
		$scope.clicking = false;
		$scope.pushUndoSnapshot($scope.mosaicCopy);
		$scope.updateUsed();
		$scope.updateCharCount();
	};

	function onWindowMouseUp() {
		if (!$scope.clicking) return;
		$scope.$applyAsync($scope.mouseUp);
	}
	window.addEventListener('mouseup', onWindowMouseUp);
	$scope.$on('$destroy', function() {
		detachDragListeners();
		window.removeEventListener('mouseup', onWindowMouseUp);
	});

	$scope.usedEmotes = [];
	$scope.updateUsed = function() {
		if (!$scope.imageLoaded && !$scope.blankLoaded) return;

		var i, j, emote;

		for (i = 0; i < $scope.usedEmotes.length; i++) {
			$scope.usedEmotes[i].used = false;
		}
		$scope.usedEmotes = [];
		for (j = 0; j < $scope.mosaic.length; j++) {
			for (i = 0; i < $scope.mosaic[j].length; i++) {
				emote = $scope.mosaic[j][i];
				if (!emote || emote.used) continue;
				$scope.usedEmotes.push(emote);
				emote.used = true;
			}
		}
	};

	$scope.blankLoaded = false;
	$scope.blankCanvas = function() {
		if ($scope.emoticons.length === 0) return;

		$scope.blankLoaded = true;
		$scope.imageLoaded = false;

		$scope.upscaledCvs.width = $scope.upscaledCvs.width;
		var imageLoader = document.getElementById('imageLoader');
		imageLoader.value = "";

		$scope.mosaic = [];
		var row, i, j;
		for (i = 0; i < $scope.height.value; i++) {
			row = [];
			for (j = 0; j < $scope.width.value; j++) {
				row.push($scope.selectedEmote);
			}
			$scope.mosaic.push(row);
		}

		for (i = 0; i < $scope.usedEmotes.length; i++) {
			$scope.usedEmotes[i].used = false;
		}
		$scope.usedEmotes = [];
		$scope.selectedEmote.used = true;
		$scope.usedEmotes.push($scope.selectedEmote);
		$scope.updateCharCount();
	};

	$scope.resizeBlank = function() {
		if ($scope.mosaic === undefined) return;

		var oldHeight = $scope.mosaic.length;
		if (oldHeight === 0) return $scope.blankCanvas();
		var oldWidth = $scope.mosaic[0].length;
		if (oldWidth === 0) return $scope.blankCanvas();

		var newWidth = $scope.width.value;
		var newHeight = $scope.height.value;
		var brush = $scope.selectedEmote;
		var diff, i, j, row;

		if (newWidth > oldWidth) {
			diff = newWidth - oldWidth;
			for (i = 0; i < oldHeight; i++) {
				for (j = 0; j < diff; j++) {
					$scope.mosaic[i].push(brush);
				}
			}
		} else if (newWidth < oldWidth) {
			for (i = 0; i < oldHeight; i++) {
				$scope.mosaic[i].splice(newWidth);
			}
		}

		if (newHeight > oldHeight) {
			diff = newHeight - oldHeight;
			for (i = 0; i < diff; i++) {
				row = [];
				for (j = 0; j < newWidth; j++) {
					row.push(brush);
				}
				$scope.mosaic.push(row);
			}
		} else if (newHeight < oldHeight) {
			$scope.mosaic.splice(newHeight);
		}
		$scope.updateCharCount();
	};

	var MAX_UNDO_HISTORY = 30;
	$scope.undoHistory = [];
	$scope.pushUndoSnapshot = function(mat) {
		if (!mat) return;
		$scope.undoHistory.push(mat);
		if ($scope.undoHistory.length > MAX_UNDO_HISTORY) {
			$scope.undoHistory.shift();
		}
	};

	$scope.undo = function() {
		if ($scope.undoHistory.length === 0) return;
		$scope.mosaic = $scope.undoHistory.pop();
		$scope.updateUsed();
		$scope.updateCharCount();
	};

	$scope.disableAll = function() {
		for (var i = 0; i < $scope.emoticons.length; i++) {
			$scope.emoticons[i].disable = true;
		}
		if ($scope.imageLoaded) $scope.generateMosaic();
	};

	$scope.enableAll = function() {
		for (var i = 0; i < $scope.emoticons.length; i++) {
			$scope.emoticons[i].disable = false;
		}
		if ($scope.imageLoaded) $scope.generateMosaic();
	};

	$scope.sortByHue = function() {
		$scope.emoticons = $scope.orderBy($scope.emoticons, 'hue');
		if (!$scope.imageLoaded && !$scope.blankLoaded) {
			$timeout($scope.displayEmoticons, 0);
		}
	};

	$scope.sortByLength = function() {
		$scope.emoticons = $scope.orderBy($scope.emoticons, 'nsize');
		if (!$scope.imageLoaded && !$scope.blankLoaded) {
			$timeout($scope.displayEmoticons, 0);
		}
	};

	$scope.sortByGame = function() {
		$scope.emoticons = $scope.orderBy($scope.emoticons, 'index');
		if (!$scope.imageLoaded && !$scope.blankLoaded) {
			$timeout($scope.displayEmoticons, 0);
		}
	};

	$scope.horizontalFlip = function() {
		if ($scope.mosaic && $scope.mosaic.length > 0) {
			$scope.pushUndoSnapshot(copyMatrix($scope.mosaic));
		}
		$scope.mosaic.forEach(function(e) { e.reverse(); });
		$scope.updateCharCount();
	};

	$scope.verticalFlip = function() {
		if ($scope.mosaic && $scope.mosaic.length > 0) {
			$scope.pushUndoSnapshot(copyMatrix($scope.mosaic));
		}
		$scope.mosaic.reverse();
		$scope.updateCharCount();
	};

	// Hotkeys
	hotkeys.add('ctrl+z', 'Undo', $scope.undo);
	hotkeys.add('q', 'Pen Tool', () => $scope.tool = "pen");
	hotkeys.add('w', 'Line Tool', () => $scope.tool = "line");
	hotkeys.add('e', 'Rectangle Tool', () => $scope.tool = "rect");
	hotkeys.add('a', 'Circle Tool', () => $scope.tool = "circ");
	hotkeys.add('s', 'Move Tool', () => $scope.tool = "move");
	hotkeys.add('d', 'Bucket Tool', () => $scope.tool = "fill");
	hotkeys.add('h', 'Horizontal flip', () => $scope.horizontalFlip());
	hotkeys.add('v', 'Vertical flip', () => $scope.verticalFlip());

	$scope.wSliderActive = false;
	$scope.hSliderActive = false;

	var imageLoader = document.getElementById('imageLoader');
	imageLoader.addEventListener('change', $scope.handleImage, false);
	$scope.upscaledCvs = document.getElementById('imageCanvas');
	$scope.originalCvs = document.createElement('canvas');
	$scope.smallCvs = document.createElement('canvas');

	$scope.$watch('compareMode', $scope.generateMosaic);
	$scope.$watch('quality', $scope.updateUpscale);
	$scope.$watch('width.value', function() {
		if ($scope.mosaic === undefined || $scope.mosaic.length === 0) {
			return;
		}
		if ($scope.blankLoaded || !$scope.imageLoaded) {
			$scope.resizeBlank();
		} else if ($scope.wSliderActive) {
			if ($scope.width.value < $scope.mosaic[0].length) {
				for (var i = 0; i < $scope.mosaic.length; i++) {
					$scope.mosaic[i].splice($scope.width.value);
				}
			}
		} else {
			$scope.updateUpscale();
		}
	});
	$scope.$watch('height.value', function() {
		if (!$scope.hSliderActive || !$scope.imageLoaded) {
			$scope.resizeBlank();
		}
	});

	if (localStorage.hasOwnProperty("lastEmotes")) {
		try {
			var parsedLastEmotes = JSON.parse(localStorage.lastEmotes);
			if (Array.isArray(parsedLastEmotes) && parsedLastEmotes.length > 0) {
				$scope.loadEmotes(parsedLastEmotes);
			}
		} catch (e) {
			delete localStorage.lastEmotes;
		}
	}
}]);

function Size(v) {
	var value = v;

	this.__defineGetter__("value", function () {
		return value;
	});

	this.__defineSetter__("value", function (val) {
		var parsed = parseInt(val, 10);
		if (!Number.isFinite(parsed)) return;
		value = Math.max(1, Math.min(50, parsed));
	});
}

function copyMatrix(matrix) {
	if (!Array.isArray(matrix)) return [];
	var copy = [];
	for (var i = 0; i < matrix.length; i++) {
		var row = [];
		for (var j = 0; j < matrix[i].length; j++) {
			row.push(matrix[i][j]);
		}
		copy.push(row);
	}
	return copy;
}

function arrayToObject(arr) {
	var obj = {};
	for (var i = 0; i < arr.length; i++) {
		obj[i] = arr[i];
	}
	obj.length = arr.length;
	return obj;
}

function rangeArray(start, end) {
	var total = [];
	if (end === undefined) {
		end = start;
		start = 0;
	}
	for (var i = start; i < end; i += 1) {
		total.push(i);
	}
	return total;
}

function dist(a, b){
	var total = 0;
	for (var i = 0; i < a.length; i++) {
		total += Math.pow(a[i] - b[i], 2);
	}
	return total;
}

function FireEvent(ElementId, EventName) {
    if(document.getElementById(ElementId) !== null) {
        if(document.getElementById(ElementId).fireEvent) {
            document.getElementById(ElementId).fireEvent('on' + EventName);
        }
        else {
            var evObj = document.createEvent('Events');
            evObj.initEvent(EventName, true, false);
            document.getElementById(ElementId).dispatchEvent(evObj);
        }
    }
}

var ImportMenuCtrl = function($scope, $modalInstance) {
	$scope.data = {text: ""};

	$scope.closeModal = function() {
		$modalInstance.dismiss('close');
	}

	$scope.importMosaic = function() {
		var ms = $scope.$parent;
		var rows = $scope.data.text.split('\n');
		var emoteDict = {};
		var width = 0;
		var i, j;

		for (i = 0; i < ms.emoticons.length; i++) {
			emoteDict[ms.emoticons[i].name] = ms.emoticons[i];
		}

		if (ms.mosaic && ms.mosaic.length > 0) {
			if (typeof ms.pushUndoSnapshot === 'function') {
				ms.pushUndoSnapshot(copyMatrix(ms.mosaic));
			} else {
				ms.undoHistory.push(copyMatrix(ms.mosaic));
			}
		}
		ms.mosaic = [];
		for (i = 0; i < rows.length; i++) {
			var row = rows[i].trim();
			if (row === "") continue;
			var sep = row.indexOf(":") < 0 ? "ːː" : "::";
			var emotes = row.replace(/\s+/g, '').slice(1, -1).split(sep);
			var emoteRow = [];
			for (j = 0; j < emotes.length; j++) {
				if (emoteDict.hasOwnProperty(emotes[j]))
					emoteRow.push(emoteDict[emotes[j]]);
				else
					emoteRow.push(ms.selectedEmote);
			}
			width = Math.max(width, emoteRow.length);
			ms.mosaic.push(emoteRow);
		}

		for (i = 0; i < ms.mosaic.length; i++) {
			while (ms.mosaic[i].length < width) {
				ms.mosaic[i].push(ms.selectedEmote);
			}
		}

		if (ms.mosaic.length === 0 || width <= 0) {
			$modalInstance.dismiss('close');
			return;
		}
		ms.imageLoaded = false;
		ms.blankLoaded = true;
		ms.width.value = width;
		ms.height.value = ms.mosaic.length;
		ms.updateUsed();
		if (typeof ms.updateCharCount === 'function') {
			ms.updateCharCount();
		}
		$modalInstance.dismiss('close');
	};
};