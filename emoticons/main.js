angular.module('EmoteApp', ['ui-rangeSlider'])
.controller('EmoteCtrl', ['$scope', '$http', '$location', '$filter',
function($scope, $http, $location, $filter) {
	var CFG = window.STEAMTOOLS_CONFIG;
	$scope.BASE_URL = "https://steamcommunity.com/market/listings/";
	$scope.ECON_URL = CFG.STEAM_ECON_BASE + "/image/";
	$scope.steamLoginUrl = CFG.getLoginUrl();
	$scope.emotes = [];
	$scope.filteredItems = [];
	$scope.numLines = 20;
	$scope.itemsPerLine = 8;
	$scope.curIndex = typeof CFG.getSavedCurIndex === 'function' ? CFG.getSavedCurIndex() : 0;

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

	function applyFilterAndSort() {
		var source = $scope.emotes || [];
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
			} else if (type === "Length") {
				newMin = parseInt(limits.min / 100 * 36, 10);
				newMax = parseInt(limits.max / 100 * 36, 10);
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
				var isOwned = $scope.owned.hasOwnProperty(item.name);
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
				} else if (type === "Length") {
					data = item.name.length - 2;
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

	CFG.getDatasetJson($http, 'data/emote.json').then(function(data){
		$scope.$applyAsync(function() {
			if (!Array.isArray(data)) return;
			var maxPrice = 0;
			for (var i = 0; i < data.length; i++) {
				var e = data[i];
				e._idx = i;
				var appMatch = /^753\/(\d+)-/.exec(e.url || '');
				e.appid = appMatch ? appMatch[1] : '753';
				e.price = e.price === null ? Infinity : parseFloat(e.price);
				e._search = (String(e.name || '') + '\t' + String(e.game || '') + '\t' + e.appid).toLowerCase();
				e._rand = String(e.name || '').hashCode();
				if (e.price < 1000 && e.price > maxPrice)
					maxPrice = e.price;
			}

			$scope.limits.maxPrice = maxPrice;
			$scope.emotes = data;
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
		var url = CFG.API_BASE + "/FetchEmotes?id=" + encodeURIComponent(cleanId);
		$http.get(url, {withCredentials: true}).success(function(data){
			if (!data || !data.success) {
				$scope.user_status = (data && data.reason ? data.reason : "Unable to load inventory") +
					" — try Import Inventory.";
				return;
			}

			$scope.owned = {};
			$scope.loggedIn = true;
			$scope.user_status = data.items.length + " items filtered" + (data.stale ? " (cached)" : "");
			for (var i = 0; i < data.items.length; i++) {
				var name = ":" + data.items[i] + ":";
				$scope.owned[name] = true;
			}
			applyFilterAndSort();
		}).error(function(errData){
			$scope.user_status = (errData && errData.reason ? errData.reason : "Could not fetch inventory") +
				" — try Import Inventory.";
		});
	};

	$scope.openInventoryImporter = function() {
		if (!window.SteamToolsImport) return;
		window.SteamToolsImport.openImportDialog({
			mode: 'emotes',
			appid: '753',
			contextid: '6',
			title: 'Import Steam Emoticons (753/6)',
			subtitle: 'Filter owned emoticons locally without backend limits or Steam login.',
			onImport: function(parsed) {
				$scope.$applyAsync(function() {
					var emotesList = parsed && Array.isArray(parsed.emoticons) ? parsed.emoticons : [];
					$scope.owned = {};
					for (var i = 0; i < emotesList.length; i++) {
						$scope.owned[":" + emotesList[i] + ":"] = true;
					}
					$scope.loggedIn = true;
					$scope.user_status = emotesList.length + " items filtered (local import)";
					applyFilterAndSort();
				});
			}
		});
	};

	$scope.reverseOwn = false;
	$scope.ownTest = function(item) {
		if ($scope.reverseOwn)
			return $scope.owned.hasOwnProperty(item.name);
		else
			return !$scope.owned.hasOwnProperty(item.name);
	};

	$scope.userLogout = function() {
		CFG.performLogout($http);
		$scope.user_status = "Login or Import Inventory to filter owned items";
		$scope.loggedIn = false;
		$scope.owned = {};
		applyFilterAndSort();
	};


	$scope.genDates = function(){
		if (!$scope.dates || $scope.emotes.length === 0) return;

		for (var i = 0; i < $scope.emotes.length; i++) {
			var e = $scope.emotes[i];
			if ($scope.dates.hasOwnProperty(e.appid)) {
				var utime = $scope.dates[e.appid];
				var date = new Date(utime*1000);
				e.date = date.toDateString().substr(4);
				e.time = $scope.dates[e.appid] - 1368590400;
			} else {
				e.date = "???";
				e.time = 0;
			}
		}
	};

	$scope.getEmoteImgSrc = function(e) {
		if (!e) return '';
		if (e.img) {
			return CFG.STEAM_ECON_BASE + "/image/" + String(e.img) + ($scope.small ? "/18fx18f" : "/64fx64f");
		}
		var rawName = String(e.name || '').replace(/^:+|:+$/g, '');
		return CFG.STEAM_ECON_BASE + "/emoticon/" + encodeURIComponent(rawName);
	};

	$scope.getStyle = function(p){
		if (!p || p.length < 3) return {};
		var url = CFG.CDN_BASE + "/emoticons/" + p[0];
		var style;
		if ($scope.small){
			style = {
				backgroundImage: "url(" + url + "s.png?v3)",
				backgroundPosition: (p[1] * -20) + "px " + (p[2] * -20) + "px"
			};
		}
		else{
			style = {
				backgroundImage: "url(" + url + ".png?v3)",
				backgroundPosition: (p[1] * -64) + "px " + (p[2] * -64) + "px"
			};
		}

		return style;
	};

	$scope.byHue = function Hue(e){ return (e.hls || [0,0,0])[0]; };
	$scope.byBrightness = function Brightness(e){ return -(e.hls || [0,0,0])[1]; };
	$scope.bySaturation = function Saturation(e){ return (e.hls || [0,0,0])[2]; };
	$scope.byName = function Name(e){ return (e.name || '').toLowerCase(); };
	$scope.byGame = function Game(e){ return (e.game || '').toLowerCase(); };
	$scope.byPrice = function Price(e){ return e.price; };
	$scope.byLength = function Length(e){ return (e.name || '').length; };
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
		var esize = $scope.small ? 28 : 74;
		var emote_count = Math.max(1, Math.floor(window.innerWidth / esize) - 1);
		var page_size = Math.ceil(window.innerHeight / esize);

		$scope.divWidth = (emote_count * esize + 10) + "px";
		$scope.itemsPerLine = emote_count;
		$scope.numLines = Math.max(page_size, $scope.numLines);
	};

	$scope.$watch('small', $scope.fixDivSize);
	$scope.fixDivSize();

	function loadMoreRows() {
		var perLine = Math.max(1, $scope.itemsPerLine || 1);
		if ($scope.numLines * perLine >= $scope.filteredItems.length) return;
		var esize = $scope.small ? 28 : 74;
		var page_size = Math.max(4, Math.ceil(window.innerHeight / esize));
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