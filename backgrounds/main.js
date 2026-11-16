angular.module('BGApp', ['ui-rangeSlider'])
.controller('BGCtrl', ['$scope', '$http', '$location', '$filter',
function($scope, $http, $location, $filter) {
	var CFG = window.STEAMTOOLS_CONFIG;
	$scope.BASE_URL = "https://steamcommunity.com/market/listings/";
	$scope.ECON_URL = CFG.STEAM_ECON_BASE + "/image/";
	$scope.steamLoginUrl = CFG.getLoginUrl();
	$scope.bg = [];
	$scope.filteredItems = [];
	$scope.numLines = 20;
	$scope.itemsPerLine = 4;
	$scope.curIndex = typeof CFG.getSavedCurIndex === 'function' ? CFG.getSavedCurIndex() : 0;

	$scope.formatPrice = function(p) {
		if (p === Infinity || p === null || p === undefined || isNaN(p)) return 'N/A';
		if (typeof CFG.formatPriceUsd === 'function') {
			return CFG.formatPriceUsd(p, $scope.curIndex);
		}
		return '$' + $filter('number')(p, 2);
	};

	if (typeof CFG.loadCurrencyRates === 'function') {
		CFG.loadCurrencyRates($http).then(function() {
			$scope.$applyAsync(applyFilterAndSort);
		});
	}

	$scope.limits = {
		min: 0,
		max: 100,
		type: 'Date',
		dateRange: (Date.now()/1000) - 1368590400,
		maxPrice: 400,
	};

	function isBgOwned(item) {
		if (!item) return false;
		if (item.url && $scope.owned.hasOwnProperty(item.url)) return true;
		if (item.name && $scope.owned.hasOwnProperty(item.name)) return true;
		return false;
	}

	function applyFilterAndSort() {
		var source = $scope.bg || [];
		var limits = $scope.limits;
		var type = limits.type;
		var useRange = !(type === "Random" || type === "Name" || type === "Game");
		var newMin = 0, newMax = Infinity;

		if (useRange) {
			if (type === "Hue" || type === "Brightness" || type === "Saturation") {
				newMin = limits.min / 100 * 255;
				newMax = limits.max / 100 * 255;
			} else if (type === "Price") {
				newMin = Math.pow(limits.min, 3) / Math.pow(100, 3) * limits.maxPrice;
				newMax = Math.pow(limits.max, 3) / Math.pow(100, 3) * limits.maxPrice;
			} else if (type === "Date") {
				newMin = limits.min / 100 * limits.dateRange;
				newMax = limits.max / 100 * limits.dateRange;
			}

			var minLabel, maxLabel;
			if (type === "Price") {
				if (typeof CFG.formatPriceUsd === 'function') {
					minLabel = CFG.formatPriceUsd(newMin, $scope.curIndex, { noApprox: true });
					maxLabel = CFG.formatPriceUsd(newMax, $scope.curIndex) + (limits.max >= 100 ? '+' : '');
				} else {
					minLabel = '$' + $filter('number')(newMin, 2);
					maxLabel = '$' + $filter('number')(newMax, 2) + (limits.max >= 100 ? '+' : '');
				}
			} else if (type === "Date") {
				var minDate = (newMin + 1368590400) * 1000;
				var maxDate = (newMax + 1368590400) * 1000;
				minLabel = new Date(minDate).toDateString().substr(4);
				maxLabel = new Date(maxDate).toDateString().substr(4);
			} else {
				minLabel = parseInt(newMin, 10);
				maxLabel = parseInt(newMax, 10);
			}
			limits.rangeLabel = minLabel + ' - ' + maxLabel;
		}

		var q = String($scope.filterText || '').trim().toLowerCase();
		var hasOwn = Object.keys($scope.owned || {}).length > 0;
		var revOwn = !!$scope.reverseOwn;
		var filtered = [];

		for (var i = 0; i < source.length; i++) {
			var item = source[i];
			if (hasOwn || revOwn) {
				var isOwned = isBgOwned(item);
				if (revOwn ? !isOwned : isOwned) continue;
			}
			if (q && item._search.indexOf(q) === -1) continue;

			if (useRange) {
				var hls = item.hls || [0, 0, 0];
				var data = 0;
				if (type === "Hue") {
					data = hls[0];
				} else if (type === "Brightness") {
					data = hls[1];
				} else if (type === "Saturation") {
					data = hls[2];
				} else if (type === "Price") {
					data = item.price;
				} else if (type === "Date") {
					data = item.time;
				}
				if (type === "Price" && limits.max >= 100) {
					if (!(data >= newMin)) continue;
				} else if (!(newMin <= data && data <= newMax)) {
					continue;
				}
			}
			filtered.push(item);
		}

		var orderFn = $scope.order;
		var rev = !!$scope.rev;
		if (typeof orderFn === 'function') {
			filtered.sort(function(a, b) {
				var va = orderFn(a);
				var vb = orderFn(b);
				var cmp = va < vb ? -1 : (va > vb ? 1 : (a._idx - b._idx));
				return rev ? -cmp : cmp;
			});
		}

		$scope.filteredItems = filtered;
	}
	$scope.recomputeFiltered = applyFilterAndSort;

	CFG.getDatasetJson($http, 'data/bg.json').then(function(data){
		$scope.$applyAsync(function() {
			if (!Array.isArray(data)) return;
			var maxPrice = 0;
			for (var i = 0; i < data.length; i++) {
				var b = data[i];
				b._idx = i;
				var appMatch = /^753\/(\d+)-/.exec(b.url || '');
				b.appid = appMatch ? appMatch[1] : '753';
				b.price = b.price === null ? Infinity : parseFloat(b.price);
				b._search = (String(b.name || '') + '\t' + String(b.game || '') + '\t' + b.appid).toLowerCase();
				b._rand = String(b.name || '').hashCode();
				if (b.price < 1000 && b.price > maxPrice)
					maxPrice = b.price;
			}

			$scope.limits.maxPrice = maxPrice;
			$scope.bg = data;
			$scope.genDates();
			applyFilterAndSort();
		});
	}, function(){});

	CFG.getDatasetJson($http, 'data/dates.json').then(function(data){
		$scope.$applyAsync(function() {
			if (!data || typeof data !== 'object') return;
			$scope.dates = data;
			$scope.genDates();
			applyFilterAndSort();
		});
	}, function(){});

	$scope.owned = {};
	$scope.loggedIn = false;
	$scope.user_status = "Login or Import Inventory to filter owned items";
	$scope.userLogin = function(steamid64) {
		var cleanId = String(steamid64 || '').trim();
		if (!cleanId) {
			$scope.user_status = "Invalid SteamID — please login or use Import Inventory.";
			return;
		}
		$scope.loggedIn = false;
		var path = "/FetchBackgrounds?id=" + encodeURIComponent(cleanId);
		var reqPromise = typeof CFG.httpRequestWithFailover === 'function'
			? CFG.httpRequestWithFailover($http, path, { method: 'GET', withCredentials: true })
			: $http.get(CFG.API_BASE + path, { withCredentials: true });

		reqPromise.then(function(resp){
			$scope.$applyAsync(function() {
				var data = resp && resp.data;
				if (!data || !data.success) {
					$scope.user_status = (data && data.reason ? data.reason : "Unable to load inventory") +
						" — try Import Inventory.";
					return;
				}

				var bgNames = Array.isArray(data.items) ? data.items : [];
				var bgKeys = (Array.isArray(data.urls) && data.urls.length) ? data.urls : bgNames;
				$scope.owned = {};
				$scope.loggedIn = true;
				$scope.user_status = bgNames.length + " items filtered" + (data.stale ? " (cached)" : "");
				for (var i = 0; i < bgKeys.length; i++) {
					$scope.owned[bgKeys[i]] = true;
				}
				applyFilterAndSort();
			});
		}, function(errResp){
			$scope.$applyAsync(function() {
				var errData = errResp && errResp.data;
				$scope.user_status = (errData && errData.reason ? errData.reason : "Could not fetch inventory") +
					" — try Import Inventory.";
			});
		});
	};

	$scope.openInventoryImporter = function() {
		if (!window.SteamToolsImport) return;
		window.SteamToolsImport.openImportDialog({
			mode: 'cards',
			appid: '753',
			contextid: '6',
			title: 'Import Steam Backgrounds (753/6)',
			subtitle: 'Filter owned backgrounds locally without backend limits or Steam login.',
			onImport: function(parsed) {
				$scope.$applyAsync(function() {
					var bgList = parsed && Array.isArray(parsed.backgrounds) ? parsed.backgrounds : [];
					var bgKeys = (parsed && Array.isArray(parsed.background_urls) && parsed.background_urls.length)
						? parsed.background_urls : bgList;
					$scope.owned = {};
					for (var i = 0; i < bgKeys.length; i++) {
						$scope.owned[bgKeys[i]] = true;
					}
					$scope.loggedIn = true;
					$scope.user_status = bgList.length + " items filtered (local import)";
					applyFilterAndSort();
				});
			}
		});
	};

	$scope.reverseOwn = false;
	$scope.ownTest = function(item) {
		if ($scope.reverseOwn)
			return isBgOwned(item);
		else
			return !isBgOwned(item);
	};

	$scope.userLogout = function() {
		CFG.performLogout($http);
		$scope.user_status = "Login or Import Inventory to filter owned items";
		$scope.loggedIn = false;
		$scope.owned = {};
		applyFilterAndSort();
	};

	$scope.genDates = function(){
		if (!$scope.dates || $scope.bg.length === 0) return;

		for (var i = 0; i < $scope.bg.length; i++) {
			var e = $scope.bg[i];
			if ($scope.dates.hasOwnProperty(e.appid)) {
				e.time = $scope.dates[e.appid] - 1368590400;
			} else {
				e.time = $scope.limits.dateRange - 1;
			}
		}
	};

	$scope.getStyle = function(p){
		if (!p || p.length < 3) return {};
		var url = CFG.CDN_BASE + "/backgrounds/" + p[0] + ".jpg?v3";
		var style = {
			backgroundImage: "url(" + url + ")",
			backgroundPosition: (p[1] * -256) + "px " + (p[2] * -160) + "px"
		};
		return style;
	};

	$scope.onTileKeydown = function(b, e) {
		if (!e || (e.target && e.target.tagName === "A")) return;
		var key = e.key || e.keyCode;
		if (key === "Enter" || key === 13) {
			if (typeof e.preventDefault === "function") e.preventDefault();
			$scope.load(b, e);
		} else if (key === " " || key === "Spacebar" || key === 32) {
			if (typeof e.preventDefault === "function") e.preventDefault();
		}
	};

	$scope.onTileKeyup = function(b, e) {
		if (!e || (e.target && e.target.tagName === "A")) return;
		var key = e.key || e.keyCode;
		if (key === " " || key === "Spacebar" || key === 32) {
			if (typeof e.preventDefault === "function") e.preventDefault();
			$scope.load(b, e);
		}
	};

	$scope.load = function(b, e) {
		if (e && e.target && e.target.tagName === "A")
			return;
		if (!b) return;

		if (b.img) {
			$scope.open(b.img, b.name);
			return;
		}

		var path = "/FetchBackgroundImage?url=" + encodeURIComponent(b.url);
		var reqPromise = typeof CFG.httpRequestWithFailover === 'function'
			? CFG.httpRequestWithFailover($http, path, { method: 'GET' })
			: $http.get(CFG.API_BASE + path);
		reqPromise.then(function(resp){
			$scope.$applyAsync(function() {
				var data = resp && resp.data;
				var imgHash = typeof data === "string" ? data : (data && data.img);
				if (imgHash) {
					b.img = imgHash;
					$scope.open(imgHash, b.name);
				} else if (b.url) {
					window.open($scope.BASE_URL + b.url, "_blank", "noopener,noreferrer");
				}
			});
		}, function(){
			if (b.url) {
				window.open($scope.BASE_URL + b.url, "_blank", "noopener,noreferrer");
			}
		});
	};

	$scope.open = function(u, title){
		var prevFocus = document.activeElement;
		var dlg = document.createElement("dialog");
		dlg.className = "st-bg-lightbox";
		dlg.setAttribute("closedby", "any");
		dlg.setAttribute("aria-label", title || "Profile Background Preview");

		var closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.className = "st-import-close";
		closeBtn.setAttribute("aria-label", "Close background preview");
		closeBtn.textContent = "×";

		var img = document.createElement("img");
		img.src = $scope.ECON_URL + String(u || "");
		img.alt = title || "Steam Profile Background";

		dlg.appendChild(closeBtn);
		dlg.appendChild(img);
		document.body.appendChild(dlg);

		closeBtn.addEventListener("click", function() {
			dlg.close("close");
		});
		img.addEventListener("click", function() {
			dlg.close("close");
		});

		if (!("closedBy" in HTMLDialogElement.prototype)) {
			var downOutside = false;
			var isOutside = function(ev) {
				var rect = dlg.getBoundingClientRect();
				return ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom;
			};
			dlg.addEventListener("pointerdown", function(ev) {
				downOutside = isOutside(ev);
			});
			dlg.addEventListener("pointerup", function(ev) {
				if (!downOutside) return;
				downOutside = false;
				if (isOutside(ev)) {
					dlg.close("backdrop");
				}
			});
		}

		dlg.addEventListener("close", function() {
			dlg.returnValue = "";
			if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
			if (prevFocus && typeof prevFocus.focus === "function") {
				try { prevFocus.focus(); } catch (e) {}
			}
		});

		dlg.showModal();
	};

	$scope.byHue = function Hue(e){ return e.hls ? e.hls[0] : 0; };
	$scope.byBrightness = function Brightness(e){ return e.hls ? -e.hls[1] : 0; };
	$scope.bySaturation = function Saturation(e){ return e.hls ? e.hls[2] : 0; };
	$scope.byName = function Name(e){ return (e.name || '').toLowerCase(); };
	$scope.byGame = function Game(e){ return (e.game || '').toLowerCase(); };
	$scope.byPrice = function Price(e){ return e.price; };
	$scope.byRandom = function Random(e){ return e._rand || 0; };
	$scope.byDate = function Date(e){ return e.time; };

	$scope.order = $scope.byDate;
	$scope.showRange = true;
	$scope.rev = true;

	$scope.setOrder = function(orderFun) {
		var t = orderFun.name;
		$scope.limits.type = t;
		if (t === "Random" || t === "Name" || t === "Game") {
			$scope.showRange = false;
		} else {
			$scope.showRange = true;
		}

		$scope.limits.min = 0;
		$scope.limits.max = 100;

		if ($scope.order === orderFun)
			$scope.rev = !$scope.rev;
		else {
			$scope.order = orderFun;
			$scope.rev = false;
		}
		applyFilterAndSort();
	};

	$scope.$watch('filterText', function(path) {
		$location.path(path || '').replace();
		applyFilterAndSort();
	});

	$scope.$watchGroup(['reverseOwn', 'limits.min', 'limits.max', 'limits.type'], function() {
		applyFilterAndSort();
	});

	$scope.$watch(function() {
		return $location.path();
	}, function(path) {
		$scope.filterText = path.substring(1);
	});

	$scope.fixDivSize = function() {
		var bg_count = Math.max(1, Math.floor(window.innerWidth / 256) - 1);
		var page_size = Math.ceil(window.innerHeight / 256);

		$scope.divWidth = (bg_count * (256 + 10) + 10) + "px";
		$scope.itemsPerLine = bg_count;
		$scope.numLines = Math.max(page_size, $scope.numLines);
	};

	$scope.fixDivSize();

	function loadMoreRows() {
		var perLine = Math.max(1, $scope.itemsPerLine || 1);
		if ($scope.numLines * perLine >= $scope.filteredItems.length) return;
		var page_size = Math.max(4, Math.ceil(window.innerHeight / 256));
		$scope.$applyAsync(function() {
			$scope.numLines += page_size;
		});
	}

	var sentinel = document.getElementById('scroll-sentinel');
	if (sentinel && 'IntersectionObserver' in window) {
		var observer = new IntersectionObserver(function(entries) {
			if (entries && entries[0] && entries[0].isIntersecting) {
				loadMoreRows();
			}
		}, { rootMargin: '400px 0px' });
		observer.observe(sentinel);
	} else {
		window.addEventListener('scroll', function() {
			if (window.scrollY + window.innerHeight + 250 >= document.documentElement.scrollHeight) {
				loadMoreRows();
			}
		}, { passive: true });
	}

	window.addEventListener('resize', function() {
		$scope.$applyAsync($scope.fixDivSize);
	}, { passive: true });

	CFG.checkAuthSession($http).then(function(auth) {
		if (auth && auth.authenticated && auth.steamid) {
			$scope.$applyAsync(function() {
				$scope.userLogin(auth.steamid);
			});
		}
	});

}]);

String.prototype.hashCode = function() {
	var hash = 0, i, chr, len;
	if (this.length === 0) return hash;
	for (i = 0, len = this.length; i < len; i++) {
		chr = this.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0;
	}
	return hash;
};

function getCookie(name) {
	var regexp = new RegExp("(?:^" + name + "|;\\s*" + name + ")=(.*?)(?:;|$)", "g");
	var result = regexp.exec(document.cookie);
	return (result === null) ? null : result[1];
}

function deleteCookie(name) {
  document.cookie = name + '=; path=/; domain=.steam.tools; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}
