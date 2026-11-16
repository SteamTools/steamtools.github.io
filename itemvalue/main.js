/* global angular */
/* global $ */

var CURRENCY_DATA = [
	{name: "USD", symbolFormat: "$",     right: false, ratio: 1.0},
	{name: "AED", symbolFormat: " AED",  right: true,  ratio: 3.6772},
	{name: "ARS", symbolFormat: "ARS$",  right: false, ratio: 97.6575},
	{name: "AUD", symbolFormat: "A$ ",   right: false, ratio: 1.3799},
	{name: "BRL", symbolFormat: "R$ ",   right: false, ratio: 5.244},
	{name: "CAD", symbolFormat: "CDN$ ", right: false, ratio: 1.2635},
	{name: "CHF", symbolFormat: "CHF ",  right: false, ratio: 0.9190},
	{name: "CLP", symbolFormat: "CLP$ ", right: false, ratio: 785.5814},
	{name: "CNY", symbolFormat: "¥ ",    right: false, ratio: 6.4934},
	{name: "COP", symbolFormat: "COL$ ", right: false, ratio: 3875.5106},
	{name: "CRC", symbolFormat: "₡",     right: false, ratio: 624.9128},
	{name: "EUR", symbolFormat: "€",     right: true,  ratio: 0.851},
	{name: "GBP", symbolFormat: "£",     right: false, ratio: 0.7293},
	{name: "HKD", symbolFormat: "HK$ ",  right: false, ratio: 7.7957},
	{name: "IDR", symbolFormat: "Rp ",   right: false, ratio: 14434.151},
	{name: "ILS", symbolFormat: "₪",     right: false, ratio: 3.2308},
	{name: "INR", symbolFormat: "₹ ",    right: false, ratio: 74.2201},
	{name: "JPY", symbolFormat: "¥ ",    right: false, ratio: 110.2601},
	{name: "KRW", symbolFormat: "₩ ",    right: false, ratio: 1171.6164},
	{name: "KWD", symbolFormat: " KD",   right: true,  ratio: 0.3017},
	{name: "KZT", symbolFormat: "₸",     right: false, ratio: 427.1962},
	{name: "MXN", symbolFormat: "Mex$ ", right: false, ratio: 20.3632},
	{name: "MYR", symbolFormat: "RM",    right: false, ratio: 4.2012},
	{name: "NOK", symbolFormat: " kr",   right: true,  ratio: 8.8252},
	{name: "NZD", symbolFormat: "NZ$ ",  right: false, ratio: 1.4374},
	{name: "PEN", symbolFormat: "S/.",   right: false, ratio: 4.1061},
	{name: "PHP", symbolFormat: "P",     right: false, ratio: 50.0509},
	{name: "PLN", symbolFormat: "zł",    right: true,  ratio: 3.8976},
	{name: "QAR", symbolFormat: " QR",   right: true,  ratio: 3.6456},
	{name: "RUB", symbolFormat: " pуб.", right: true,  ratio: 74.4343},
	{name: "SAR", symbolFormat: " SR",   right: true,  ratio: 3.7543},
	{name: "SGD", symbolFormat: "S$",    right: false, ratio: 1.3551},
	{name: "THB", symbolFormat: "฿",     right: false, ratio: 32.8027},
	{name: "TRY", symbolFormat: " TL",   right: true,  ratio: 8.4025},
	{name: "TWD", symbolFormat: "NT$ ",  right: false, ratio: 27.9719},
	{name: "UAH", symbolFormat: "₴",     right: true,  ratio: 26.8975},
	{name: "UYU", symbolFormat: "$U",    right: false, ratio: 42.8828},
	{name: "VND", symbolFormat: "₫",     right: false, ratio: 22810.1732},
	{name: "ZAR", symbolFormat: "R ",    right: false, ratio: 14.9625},
];

angular.module('valueApp', ['ui.bootstrap'])
.config(['$tooltipProvider', function($tooltipProvider){
	$tooltipProvider.setTriggers({
		'mouseenter': 'mouseleave',
		'click': 'click',
		'focus': 'blur',
		'show': 'mouseleave'
	});
}])
.config(['$locationProvider', function($locationProvider) {
  $locationProvider.hashPrefix('');
}])
.directive('tooltip', function() {
	return {
		restrict: 'A',
		priority: 1000,
		compile: function(tElem, tAttrs) {
			if (!tAttrs.tooltipTrigger) tAttrs.$set('tooltipTrigger', 'mouseenter');
			if (!tAttrs.tooltipPlacement) tAttrs.$set('tooltipPlacement', 'top');
			if (!tAttrs.tooltipAnimation) tAttrs.$set('tooltipAnimation', 'true');
			if (!tAttrs.tooltipPopupDelay) tAttrs.$set('tooltipPopupDelay', '250');
		}
	};
})
.filter('sumByKey', function() {
	return function(data, key, mult, fee) {
		if (data === undefined || key === undefined) {
			return 0;
		}

		var sum = 0;
		for (var i = data.length - 1; i >= 0; i--) {
			if (!data[i][key]) continue;
			var val = data[i][key];
			if (fee) {
				var fee_cost = val * 0.1304;
				fee_cost = Math.max(fee_cost, 0.02);
				val -= fee_cost;
			}

			if (mult === undefined) {
				sum += val;
			} else {
				sum += val * data[i][mult];
			}
		}

		return sum;
	};
})
.filter('currency', function($filter){
	return function(input, ind, fee) {
		if (isNaN(input)) return "N/A";

		// Get symbol and decide if it comes before or after
		var symbol = CURRENCY_DATA[ind].symbolFormat;
		var after = CURRENCY_DATA[ind].right;
		var ratio = CURRENCY_DATA[ind].ratio;

		if (fee) {
			var fee_cost = input * 0.1304;
			fee_cost = Math.max(fee_cost, 0.02);
			input -= fee_cost;
		}

		// Make sure input was valid, then convert and format it
		var out = $filter('number')(input * ratio, 2);

		// Add symbol in the right place
		if (after) return out + symbol;
		else return symbol + out;
	};
}).controller('InvCtrl',
	['$scope', '$http', '$filter', '$timeout',
 		function($scope, $http, $filter, $timeout) {
	var CFG = window.STEAMTOOLS_CONFIG;
	var MAX_AUTO_RETRIES = 2;
	var retryTimer = null;

	$scope.CDATA = CURRENCY_DATA;
	$scope.ECONOMY = CFG.STEAM_ECON_BASE + "/image/";
	$scope.LISTING = "https://steamcommunity.com/market/listings/";
	$scope.status = "Import your profile or use Import Inventory";
	$scope.TYPES = ["all", "emoticon", "background", "card", "booster"];
	$scope.type = "0";
	$scope.appid = {model: "753"};
	$scope.appidLoaded = "0";
	$scope.curIndex = 0;
	$scope.flags = {
		fee: false,
		dupes: false,
		stack: false
	};
	$scope.iconLimit = 54;
	$scope.useTable = true;
	$scope.isLoading = false;
	$scope.showImportCta = false;
	$scope.turnstileConfigured = CFG.isTurnstileConfigured();

	$http.get(CFG.CDN_BASE + '/data/currency.json').then(function(resp) {
		var data = resp && resp.data;
		if (!data) return;
		var count = 0;
		for (var i = 0; i < $scope.CDATA.length; i++) {
			var code = $scope.CDATA[i].name;
			if (Object.prototype.hasOwnProperty.call(data, code)) {
				$scope.CDATA[i].ratio = data[code];
				count++;
			}
		}
		console.log('Updated ' + count + '/' + $scope.CDATA.length + ' currencies');
	});

	$scope.apps = [
		"753",
		"730",
		"440",
		"570",
		"252490",
		"322330"
	];

	$scope.typeMap = {
		'753': "Steam",
		'730': "Counter-Strike 2",
		'440': "Team Fortress 2",
		'570': "Dota 2",
		'252490': "Rust",
		'322330': "Don't Starve Together"
	};

	$scope.iconMap = {
		'753': "135dc1ac1cd9763dfc8ad52f4e880d2ac058a36c",
		'730': "d1159d1a4d0e18da4d74f85dbb4934d7a92ace2b",
		'440': "033bdd91842b6aca0633ee1e5f3e6b82f2e8962f",
		'570': "c0d15684e6c186289b50dfe083f5c562c57e8fb6",
		'252490': "acf87ad23570b3c81f8c9cfc19544a07edd8b632",
		'322330': "5176d189ff929acc8d29a2e5f0466e18798db436"
	};

	$scope.ts = false;
	$scope.key = false;
	$scope.passExpiresAt = 0;
	$scope.turnstileWidgetId = null;
	$scope.turnstileToken = false;

	$scope.hasValidPass = function() {
		return Boolean($scope.key && $scope.ts && Date.now() < $scope.passExpiresAt);
	};

	function resetTurnstileWidget() {
		$scope.turnstileToken = false;
		if (window.turnstile && $scope.turnstileWidgetId !== null) {
			try {
				window.turnstile.reset($scope.turnstileWidgetId);
			} catch (e) {
				// Ignore widget reset race during teardown
			}
		}
	}

	function initTurnstile(attempt) {
		if (!$scope.turnstileConfigured) return;
		var container = document.getElementById('turnstile-container');
		if (!container) return;
		if (window.turnstile && typeof window.turnstile.render === 'function') {
			if ($scope.turnstileWidgetId !== null) return;
			$scope.turnstileWidgetId = window.turnstile.render('#turnstile-container', {
				sitekey: CFG.TURNSTILE_SITEKEY,
				action: 'item_value',
				theme: 'dark',
				callback: function(token) {
					$scope.$applyAsync(function() {
						$scope.turnstileToken = token || false;
					});
				},
				'expired-callback': function() {
					$scope.$applyAsync(function() {
						$scope.turnstileToken = false;
					});
				},
				'error-callback': function() {
					$scope.$applyAsync(function() {
						$scope.turnstileToken = false;
						$scope.status = 'Captcha failed to load. Use Import Inventory (no captcha) or reload.';
						$scope.showImportCta = true;
					});
				}
			});
		} else if ((attempt || 0) < 30) {
			$timeout(function() {
				initTurnstile((attempt || 0) + 1);
			}, 250);
		} else {
			$scope.status = 'Captcha widget was blocked or failed to load — click Import Inventory (no captcha) to load your items.';
			$scope.showImportCta = true;
		}
	}
	$timeout(function() { initTurnstile(0); }, 0);

	$scope.getIcon = function(appid) {
		var ext = appid === '753' ? '.jpg' : '.ico';
		var ico = $scope.iconMap[appid] + ext;
		return "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/" + appid + "/" + ico;
	};

	$scope.setCurrency = function(i) {
		$scope.curIndex = i;
	};

	function cancelPendingRetry() {
		if (retryTimer) {
			$timeout.cancel(retryTimer);
			retryTimer = null;
		}
	}

	function clearHelpBox() {
		var help = document.getElementById("help");
		if (help) help.textContent = "";
		return help;
	}

	function setHelpMode(mode, profileName, loadedAppId) {
		var help = clearHelpBox();
		if (!help) return;
		if (mode === 1) {
			help.appendChild(document.createTextNode("Make sure your "));
			var a1 = document.createElement("a");
			a1.href = "https://steamcommunity.com/my/edit/settings";
			a1.target = "_blank";
			a1.rel = "noopener noreferrer";
			a1.textContent = "inventory privacy";
			help.appendChild(a1);
			help.appendChild(document.createTextNode(" is set to public, or click Import Inventory."));
		} else if (mode === 2) {
			help.appendChild(document.createTextNode("Try pasting the "));
			var a2 = document.createElement("a");
			a2.href = "https://steamcommunity.com/my/";
			a2.target = "_blank";
			a2.rel = "noopener noreferrer";
			a2.textContent = "Steam profile URL";
			help.appendChild(a2);
			help.appendChild(document.createTextNode("."));
		} else if (mode === 'profile' && profileName) {
			var safeName = String(profileName);
			var profileUrl = "https://steamcommunity.com/" +
				(/^\d{17}$/.test(safeName) ? "profiles/" + safeName : "id/" + encodeURIComponent(safeName)) +
				"/inventory/#" + encodeURIComponent(String(loadedAppId || "753"));
			var invLink = document.createElement("a");
			invLink.href = profileUrl;
			invLink.target = "_blank";
			invLink.rel = "noopener noreferrer";
			invLink.textContent = "Inventory";
			help.appendChild(invLink);
			help.appendChild(document.createTextNode(" | "));
			var repLink = document.createElement("a");
			repLink.href = "https://steamrep.com/search?q=" + encodeURIComponent(safeName);
			repLink.target = "_blank";
			repLink.rel = "noopener noreferrer";
			repLink.textContent = "SteamRep";
			help.appendChild(repLink);
		}
	}

	function renderValuedItems(items, appid, options) {
		var opts = options || {};
		$scope.type = "0";
		$scope.appidLoaded = String(appid);
		$scope.items = Array.isArray(items) ? items : [];
		$scope.rows = [];

		if ($scope.items.length > 0) {
			for (var i = 0; i < $scope.items.length; i++) {
				var item = $scope.items[i];
				item.price = parseFloat(item.price) || 0;
				$scope.rows.push(new Item(item));
			}

			$scope.table.clear();
			$scope.table.columns().visible(false);
			$scope.table.columns($scope.visCols[appid] || $scope.visCols['753']).visible(true);
			$scope.table.columns.adjust().draw(false);
			$scope.table.rows.add($scope.rows).draw();

			if (!$scope.items[0].icon) {
				$scope.table.column(0).visible(false);
				$scope.useTable = true;
			}
			$scope.status = opts.statusMessage || "";
			if (opts.profileName) {
				setHelpMode('profile', opts.profileName, $scope.appidLoaded);
			} else {
				clearHelpBox();
			}
		} else {
			var type = $scope.typeMap[$scope.appid.model] || "game";
			$scope.status = "No " + type + " items found.";
		}
	}

	$scope.openImportModal = function() {
		if (!window.SteamToolsImport) return;
		cancelPendingRetry();
		var idHint = String($scope.UserID || '').trim();
		window.SteamToolsImport.openImportDialog({
			mode: 'itemvalue',
			appid: $scope.appid.model,
			steamId: idHint,
			title: 'Import Inventory for ' + ($scope.typeMap[$scope.appid.model] || 'Steam'),
			subtitle: 'Zero captcha & zero server rate limits — prices come directly from SteamTools CDN.',
			onImport: function(parsed) {
				var targetApp = $scope.apps.indexOf(parsed.detected_appid) !== -1
					? parsed.detected_appid
					: $scope.appid.model;
				$scope.$applyAsync(function() {
					$scope.appid.model = targetApp;
					$scope.isLoading = true;
					$scope.showImportCta = false;
					$scope.status = "Pricing " + parsed.items.length + " unique item(s) from SteamTools CDN...";
					clearHelpBox();
				});

				window.SteamToolsImport.valueInventoryClientSide(parsed.items, targetApp, { config: CFG })
					.then(function(valued) {
						$scope.$applyAsync(function() {
							$scope.isLoading = false;
							var msg = "Imported " + valued.items.length + " unique market item(s) across " +
								parsed.page_count + " page(s)";
							if (valued.usedBucketFallback) {
								msg += " (using fallback value/753.json)";
							}
							msg += ".";
							renderValuedItems(valued.items, targetApp, { statusMessage: msg });
						});
					})
					.catch(function(err) {
						$scope.$applyAsync(function() {
							$scope.isLoading = false;
							$scope.status = "CDN pricing failed: " + (err && err.message ? err.message : "Network error");
						});
					});
			}
		});
	};

	$scope.loadItems = function(){
		if (!$scope.UserID || $scope.UserID.trim() === "") {
			$scope.status = "Enter your SteamID64, custom URL name, or Steam profile link first, or click Import Inventory.";
			var idEl = document.getElementById('iv-steamid');
			if (idEl) idEl.focus();
			return;
		}
		if (!$scope.hasValidPass() && !$scope.turnstileToken) {
			$scope.status = $scope.turnstileConfigured
				? "Please complete the Turnstile check first, or click Import Inventory."
				: "Turnstile sitekey is not configured — use Import Inventory instead.";
			$scope.showImportCta = true;
			return;
		}

		cancelPendingRetry();
		$scope.items = [];
		$scope.showImportCta = false;
		window.localStorage.lastUser = $scope.UserID;
		window.localStorage.lastAppid = $scope.appid.model;
		$scope.retries = 0;
		$scope.fetchItems($scope.UserID, $scope.appid.model);
	};

	$scope.dupesFilter = function(item) {
		if (!$scope.flags.dupes) return true;
		return item.count > 1;
	};

	$scope.retries = 0;
	$scope.fetchItems = function(user, appid, huge){
		huge = Boolean(huge);
		$scope.iconLimit = 54;
		$scope.isLoading = true;
		$scope.status = "Loading...";
		clearHelpBox();

		var url = CFG.API_BASE + '/ItemValue?i=1&id=' + encodeURIComponent(user) +
			'&app=' + encodeURIComponent(appid);
		if (huge) {
			url += '&huge=1';
		}

		var usedTurnstile = false;
		if ($scope.hasValidPass()) {
			url += '&ts=' + encodeURIComponent($scope.ts) + '&key=' + encodeURIComponent($scope.key);
		} else if ($scope.turnstileToken) {
			url += '&cf-turnstile-response=' + encodeURIComponent($scope.turnstileToken);
			usedTurnstile = true;
			// Single-use Turnstile token is consumed by this submission; reset immediately so it cannot be reused.
			resetTurnstileWidget();
		} else {
			$scope.isLoading = false;
			$scope.showImportCta = true;
			$scope.status = "Captcha verification required, or use Import Inventory.";
			return;
		}

		$http({method: 'GET', url: url, withCredentials: true}).then(function(response) {
			$scope.isLoading = false;
			var data = response && response.data;
			if (!data) return;

			if (data.help === 1 || data.help === 2) {
				setHelpMode(data.help);
			}

			if (data.key && data.ts) {
				$scope.key = data.key;
				$scope.ts = data.ts;
				$scope.passExpiresAt = Date.now() + (9 * 60 * 1000);
			} else if (usedTurnstile) {
				$scope.key = false;
				$scope.ts = false;
				$scope.passExpiresAt = 0;
			}

			if (data.success === false) {
				var errCode = data.error || '';
				var isRateLimited = errCode === 'rate_limited' || /rate|429/i.test(data.reason || '');
				var isPrivate = errCode === 'private_or_unavailable' || data.help === 1 || /private/i.test(data.reason || '');
				if (isRateLimited || isPrivate) {
					$scope.showImportCta = true;
				}

				var retryAfterSec = typeof data.retry_after === 'number' && data.retry_after > 0
					? data.retry_after
					: null;

				if (data.huge && !huge && ($scope.hasValidPass() || $scope.turnstileToken)) {
					$scope.fetchItems(user, appid, true);
					return;
				}

				if (data.retry && $scope.retries < MAX_AUTO_RETRIES &&
					($scope.hasValidPass()) && (!retryAfterSec || retryAfterSec <= 15)) {
					var attempt = $scope.retries;
					$scope.retries++;
					var baseSec = retryAfterSec || Math.pow(2, attempt);
					var delayMs = Math.min(30000, Math.round(baseSec * 1000 + Math.random() * 400));
					$scope.status = "Steam temporary error — retrying in " + Math.ceil(delayMs / 1000) +
						"s (" + $scope.retries + "/" + MAX_AUTO_RETRIES + ")... Or click Import Inventory.";
					retryTimer = $timeout(function() {
						$scope.fetchItems(user, appid, huge);
					}, delayMs);
					return;
				}

				$scope.status = "Failed: " + (data.reason || errCode || "Request could not complete.");
				if (retryAfterSec) {
					$scope.status += " Retry after " + retryAfterSec + "s, or use Import Inventory.";
				}
				delete window.localStorage.lastUser;
				return;
			}

			if (data.name) {
				document.location.hash = '/' + encodeURIComponent(String(data.name)) + "-" + $scope.appid.model;
			}
			renderValuedItems(data.items, appid, {
				statusMessage: "",
				profileName: data.name
			});
		}, function(response) {
			$scope.isLoading = false;
			var body = response && response.data;
			var status = response && response.status;
			var detailObj = (body && body.detail && typeof body.detail === 'object') ? body.detail : null;
			var errCode = String((body && body.error) || (detailObj && detailObj.error) || '');
			var errReason = (body && (body.reason || body.message)) ||
				(detailObj && (detailObj.reason || detailObj.message || detailObj.detail)) ||
				(body && typeof body.detail === 'string' ? body.detail : '');
			var helpCode = (body && (body.help === 1 || body.help === 2))
				? body.help
				: (detailObj && (detailObj.help === 1 || detailObj.help === 2) ? detailObj.help : 0);

			var retryAfterHeader = response && typeof response.headers === 'function'
				? parseInt(response.headers('Retry-After'), 10)
				: NaN;
			var retryAfterSec = (body && typeof body.retry_after === 'number')
				? body.retry_after
				: (detailObj && typeof detailObj.retry_after === 'number'
					? detailObj.retry_after
					: (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : null));

			var isCaptchaOrPassError = (
				errCode === 'captcha_failed' ||
				errCode === 'captcha_required' ||
				errCode === 'invalid_pass' ||
				(!errCode && status === 403 && /turnstile|captcha|pass/i.test(String(errReason)))
			);

			if (isCaptchaOrPassError) {
				$scope.key = false;
				$scope.ts = false;
				$scope.passExpiresAt = 0;
				resetTurnstileWidget();
				$scope.status = "Verification expired or failed. Complete Turnstile again or use Import Inventory.";
				$scope.showImportCta = true;
				return;
			}

			// Preserve freshly issued session pass attached to non-captcha error responses (e.g. 429/403 private/503) so auto-retries reuse it.
			if (body && body.key && body.ts) {
				$scope.key = body.key;
				$scope.ts = body.ts;
				$scope.passExpiresAt = Date.now() + (9 * 60 * 1000);
			}

			if (helpCode) {
				setHelpMode(helpCode);
			}

			if (errCode === 'private_or_unavailable' || (status === 403 && helpCode === 1)) {
				if (!helpCode) {
					setHelpMode(1);
				}
				$scope.showImportCta = true;
				$scope.status = errReason
					? String(errReason)
					: "Steam inventory is private or unavailable — check privacy settings above or use Import Inventory.";
				delete window.localStorage.lastUser;
				return;
			}

			if (status === 429 || errCode === 'rate_limited') {
				$scope.showImportCta = true;
				if ($scope.retries < MAX_AUTO_RETRIES && $scope.hasValidPass() && (!retryAfterSec || retryAfterSec <= 15)) {
					var attempt = $scope.retries;
					$scope.retries++;
					var baseSec = retryAfterSec || Math.pow(2, attempt);
					var delayMs = Math.min(30000, Math.round(baseSec * 1000 + Math.random() * 400));
					$scope.status = "Rate limited by Steam — retrying in " + Math.ceil(delayMs / 1000) +
						"s (" + $scope.retries + "/" + MAX_AUTO_RETRIES + ")... Or click Import Inventory.";
					retryTimer = $timeout(function() {
						$scope.fetchItems(user, appid, huge);
					}, delayMs);
					return;
				}
				$scope.status = "Rate limited by Steam" + (retryAfterSec ? " (retry after " + retryAfterSec + "s)" : "") +
					" — use Import Inventory below for instant results.";
				return;
			}

			if (body && body.retry && $scope.retries < MAX_AUTO_RETRIES &&
				$scope.hasValidPass() && (!retryAfterSec || retryAfterSec <= 15)) {
				var transientAttempt = $scope.retries;
				$scope.retries++;
				var transientBaseSec = retryAfterSec || Math.pow(2, transientAttempt);
				var transientDelayMs = Math.min(30000, Math.round(transientBaseSec * 1000 + Math.random() * 400));
				$scope.status = "Steam temporary error — retrying in " + Math.ceil(transientDelayMs / 1000) +
					"s (" + $scope.retries + "/" + MAX_AUTO_RETRIES + ")... Or click Import Inventory.";
				retryTimer = $timeout(function() {
					$scope.fetchItems(user, appid, huge);
				}, transientDelayMs);
				return;
			}

			$scope.showImportCta = true;
			$scope.status = errReason
				? String(errReason)
				: "Something went wrong... try again later or use Import Inventory.";
			if (!$scope.hasValidPass()) {
				resetTurnstileWidget();
			}
		});
	};

	$scope.typeFilter = function(q) {
		if ($scope.type === "0") return true;
		else return q.type === $scope.TYPES[$scope.type];
	};

	$scope.formatCurrency = function(data, type) {
		// Only perform if it's for displaying
		if (type !== "display"){
			return isNaN(data) ? 9999999 : data;
		}
		return $filter('currency')(data, $scope.curIndex, $scope.flags.fee);
	};

	$scope.qualitySort = function(data, type) {
		if (type === "sort") return QUALITY_SORT[data[0]] || 0;
		return addColor(data[0], data[1]);
	};

	$scope.raritySort = function(data, type) {
		if (type === "sort") return RARITY_SORT[data[0]] || 0;
		return addColor(data[0], data[1]);
	};

	$scope.tableColumns = [
	/* 0*/ {data: 'image', title: "Image", width: "30px", orderable: false},
	/* 1*/ {data: 'name', title: "Item Name", width: "250px", render: overflow},
	/* 2*/ {data: 'game', title: "Game", width: "250px", render: overflow},
	/* 3*/ {data: 'type', title: "Type", width: "80px"},
	/* 4*/ {data: 'quality', title: "Quality", width: "80px", render: $scope.qualitySort, orderSequence: ['desc', 'asc']},
	/* 5*/ {data: 'rarity', title: "Rarity", width: "80px", render: $scope.raritySort, orderSequence: ['desc', 'asc']},
	/* 6*/ {data: 'count', title: "Count", width: "40px", orderSequence: ['desc', 'asc']},
	/* 7*/ {data: 'price', title: "Price", width: "80px", orderSequence: ['desc', 'asc'], render: $scope.formatCurrency},
	/* 8*/ {data: 'stack_price', title: "Price", width: "80px", orderSequence: ['desc', 'asc'], render: $scope.formatCurrency},
	];

	$scope.visCols = {
		'753': [0, 1, 2, 3, 5, 6, 7],
		'730': [0, 1, 5, 6, 7],
		'440': [0, 1, 4, 6, 7],
		'570': [0, 1, 4, 5, 6, 7],
		'252490': [0, 1, 6, 7],
		'322330': [0, 1, 3, 5, 6, 7]
	};

	// Create the table
	$scope.table = $('#item_table').DataTable({
		dom: "t<'bottomRow'lip>",
		pageLength: 25,
		lengthMenu: [25, 50, 100, 200, 500],
		autoWidth: false,
		scrollX: true,
		scrollY: "auto",
		stateSave: true,
		order: [[3, 'desc']],
		scrollCollapse: true,
		deferRender: true,
		language: {
			emptyTable: "Loading item data..."
		},
		columnDefs: [
			{class: "center", targets: "_all"},
		],
		columns: $scope.tableColumns,
		drawCallback: function() {
			$(".icon:not(.hover-zoom)").thumbPopup();
		}
	});

	// Add custom filter for all the set filtering
	$.fn.dataTableExt.afnFiltering.push(
		function(settings, data, dataIndex) {
			var row = $scope.rows[dataIndex];

			var result = true;

			if ($scope.flags.dupes) {
				result = result && row.count > 1;
			}

			if ($scope.type !== "0") {
				result = result && row.type === $scope.TYPES[$scope.type];
			}

			return result;
		}
	);


	if (window.localStorage.hasOwnProperty("lastUser")) {
		$scope.UserID = window.localStorage.lastUser;
	}

	if (window.localStorage.hasOwnProperty("lastAppid") && $scope.apps.indexOf(window.localStorage.lastAppid) !== -1) {
		$scope.appid.model = window.localStorage.lastAppid;
	}

	if (window.localStorage.curIndex) $scope.curIndex = window.localStorage.curIndex;
	if (window.localStorage.appid && $scope.apps.indexOf(window.localStorage.appid) !== -1) {
		$scope.appid.model = window.localStorage.appid;
	}
	if (window.localStorage.useTable) {
		try {
			$scope.useTable = JSON.parse(window.localStorage.useTable);
		} catch (e) {
			delete window.localStorage.useTable;
		}
	}
	$scope.$watch('appid.model', function(){window.localStorage.appid = $scope.appid.model;});
	$scope.$watch('useTable', function(){window.localStorage.useTable = $scope.useTable;});
	$scope.$watch('flags.fee', function(){$scope.table.rows().invalidate();});
	$scope.$watch('flags.dupes', function(){$scope.table.draw();});
	$scope.$watch('flags.stack', function(newValue){
		var showStack = Boolean(newValue);
		$scope.table.column(7).visible(!showStack);
		$scope.table.column(8).visible(showStack);
		$('#item_table').width("100%");
		$scope.table.draw();
	});
	$scope.$watch('type', function(){$scope.table.draw();});
	$scope.$watch('curIndex', function(){
		window.localStorage.curIndex = $scope.curIndex;
		$scope.table.rows().invalidate();
	});
	$scope.$watch('filterText', function(v){
			$scope.table.search(v);
			$scope.table.draw();
	});

	if (!$scope.CDATA.hasOwnProperty($scope.curIndex))
		$scope.curIndex = 0;

	var hash = document.location.hash.slice(1);
	if (hash && hash.trim().length > 0) {
		hash = hash.replace('/', '');
		var pos = hash.lastIndexOf("-");
		if (pos >= 0) {
			var name = hash.slice(0, pos);
			try {
				name = decodeURIComponent(name);
			} catch (e) {
				// Keep raw name if URI decoding fails
			}
			var appid = hash.slice(pos + 1);
			if ($scope.apps.indexOf(appid) >= 0) {
				$scope.UserID = name;
				$scope.appid.model = appid;
				$scope.status = "Complete the verification check and click Fetch to load " + $scope.UserID + ", or click Import Inventory.";
			}
		}
	}
}]);

function sanitizeHex6(color, fallback) {
	if (typeof color === 'string' && /^[0-9A-Fa-f]{3,8}$/.test(color.trim())) {
		return color.trim();
	}
	return fallback || 'D2D2D2';
}

function escapeValHtml(str) {
	return (window.STEAMTOOLS_CONFIG && window.STEAMTOOLS_CONFIG.escapeHtml)
		? window.STEAMTOOLS_CONFIG.escapeHtml(str)
		: String(str || '').replace(/[&<>"']/g, function(ch) {
			return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
		});
}

// Set class holding all the information about a set
function Item(data) {
	var cfg = window.STEAMTOOLS_CONFIG || { STEAM_ECON_BASE: 'https://community.akamai.steamstatic.com/economy' };
	var safeUrlPath = String(data.url || '').split('/').map(function(seg) {
		try {
			return encodeURIComponent(decodeURIComponent(seg));
		} catch (e) {
			return encodeURIComponent(seg);
		}
	}).join('/');
	var market_link = "https://steamcommunity.com/market/listings/" + escapeValHtml(safeUrlPath);
	var safeColor = sanitizeHex6(data.color, 'D2D2D2');
	var safeName = escapeValHtml(data.name || '');
	this.name = "<a href='" + market_link + "' target='_blank' rel='noopener noreferrer'><span style='color: #" +
		safeColor + "'>" + safeName + "</span></a>";
	this.game = data.game ? escapeValHtml(data.game) : null;
	this.type = data.type ? escapeValHtml(data.type) : null;
	this.rarity = [data.rarity, data.rcolor];
	this.quality = [data.quality, data.qcolor];
	this.count = data.count;
	this.price = data.price;
	this.stack_price = data.price * data.count;
	var safeIcon = String(data.icon || '').replace(/[^A-Za-z0-9_\/.\-]/g, '');
	var image_url = cfg.STEAM_ECON_BASE + "/image/" + safeIcon + "/360fx360f";
	this.image = safeIcon
		? "<i class='icon icon-fullscreen icon-white' src='" + escapeValHtml(image_url) + "'></i>"
		: "";
}

function addColor(text, color) {
	if (text)
		return "<span style='color: #" + sanitizeHex6(color, 'D2D2D2') + "'>" + escapeValHtml(text) + "</span>";
	else
		return null;
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

// Little hack to have overflow ellipsis
function overflow(data) {
	return '<span class="name">' + data + '</span>';
}


var RARITY_SORT = {
	"Base Grade": 10,
	"Consumer Grade": 20,
	"Industrial Grade": 30,
	"Mil-Spec Grade": 40,
	"High Grade": 50,
	"Restricted": 60,
	"Remarkable": 70,
	"Classified": 80,
	"Exotic": 85,
	"Covert": 90,
	"Contraband": 95,
	"Extraordinary": 99,

	"Common": 10,
	"Uncommon": 20,
	"Rare": 30,
	"Mythical": 40,
	"Immortal": 50,
	"Legendary": 60,
	"Arcana": 70,
};

var QUALITY_SORT = {
	"Unique": 10,
	"Vintage": 20,
	"Strange": 30,
	"Genuine": 40,
	"Haunted": 50,
	"Decorated Weapon": 60,
	"Unusual": 70,

	"Base": 5,
	"Standard": 10,
	"Inscribed": 20,
	"Genuine": 30,
	"Corrupted": 40,
	"Frozen": 50,
	"Exalted": 60,
	"Heroic": 70,
	"Elder": 80,
	"Unusual": 90,
	"Autographed": 100,
};
