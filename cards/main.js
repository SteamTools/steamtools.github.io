/* global moment */
/* global angular */
/* global $ */

angular.module('cardApp', ['ui.bootstrap', 'normalizeForSearch'])
.filter('currency', function($filter){
	return function(input, ind, noCurrency) {
		var CFG = window.STEAMTOOLS_CONFIG;
		if (CFG && typeof CFG.formatPriceUsd === 'function') {
			return CFG.formatPriceUsd(input, ind, {
				noCurrency: Boolean(noCurrency),
				formatNumber: function(v, d) { return $filter('number')(v, d); }
			});
		}
		if (isNaN(input)) return "N/A";
		return noCurrency ? $filter('number')(input, 2) : ('$' + $filter('number')(input, 2));
	};
})
.controller('CardCtrl', ['$scope', '$http', '$filter', '$compile', '$modal', '$timeout',
function($scope, $http, $filter, $compile, $modal, $timeout){
	var CFG = window.STEAMTOOLS_CONFIG;
	$scope.CDATA = CFG.CURRENCY_DATA;
	$scope.steamLoginUrl = CFG.getLoginUrl();
	$scope.userStale = false;

	CFG.loadCurrencyRates($http).then(function(){
		$timeout(function() {
			if ($scope.table) {
				$scope.table.rows().invalidate().draw(false);
			}
		}, 0);
	});

	// Formats and converts the prices to selected currency
	$scope.curIndex = 0;
	$scope.formatCurrency = function(data, type) {
		// Only perform if it's for displaying
		if (type !== "display" && type !== "export"){
			return isNaN(data) ? 9999999 : data;
		}
		return $filter('currency')(data, $scope.curIndex, type === "export");
	};

	$scope.percent = function(data, type){
		if (type === "export") return $filter('number')(data[1] * 100, 1);
		if (type === "sort") return data[1] + 10000;
		if (type !== "display") return data[1];
		var value = $filter('number')(data[1] * 100, 1) + "%";
		if (data[0] === 0) return value;
		return "<a href='" + data[0] + "'>" + value + "</a>";
	};
	// Little hack to have overflow ellipsis
	$scope.overflow = function(data, type) {
		var s = (data === null || data === undefined) ? '' : String(data);
		if (type === "export") {
			return typeof CFG.escapeCsvFormula === 'function'
				? CFG.escapeCsvFormula(s)
				: (/^[=+\-@\t\r]/.test(s) ? ("'" + s) : s);
		}
		var game = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		return '<span class="game">' + game + '</span>';
	};

	// Formats timestamp using moment.js
	$scope.date = function(timestamp, type) {
		if (type === "export") return moment(timestamp * 1000).format("YYYY-MM-DD");
		if (type !== "display") return timestamp;
		return moment(timestamp * 1000).format("MMM Do, YYYY");
	};

	$scope.localizeTime = function(time) {
		return moment(time * 1000).fromNow();
	};

	$scope.formatAge = function(seconds) {
		var secs = Math.max(0, Number(seconds) || 0);
		if (secs >= 3600) {
			var hrs = Math.floor(secs / 3600);
			var mins = Math.round((secs % 3600) / 60);
			return hrs + 'h' + (mins > 0 ? ' ' + mins + 'm' : '');
		}
		if (secs >= 60) return Math.round(secs / 60) + 'm';
		return secs + 's';
	};

	$scope.userData = {'games': 1, 'cards': 1, 'badges': 1};
	$scope.labelType = [
		'label-danger',
		'label-default',
		'label-warning',
		'label-success'
	];

	// Fetch data about the user from the server and apply it
	$scope.userLogin = function(steamid) {
		if (!steamid || steamid.trim() === "" || steamid === "undefined") return;

		$scope.userData = {'games': 2, 'cards': 2, 'badges': 2};
		$scope.user_status = "";

		var path = "/UserInfo?id=" + encodeURIComponent(steamid.trim()) + "&slim=1";
		var reqPromise = typeof CFG.httpRequestWithFailover === 'function'
			? CFG.httpRequestWithFailover($http, path, { method: 'GET', withCredentials: true })
			: $http.get(CFG.API_BASE + path, { withCredentials: true });

		reqPromise.then(function(resp){
			$timeout(function() {
			var data = resp && resp.data;
			if (!data || !data.success){
				var sMsg = (data && data.reason) ? String(data.reason) : "Unable to load profile.";
				if (data && data.help === 2) {
					sMsg += " Try pasting your full Steam profile URL.";
				}
				$scope.user_status = sMsg + " Or use Import from Steam below.";
				$scope.userData = {'games': 1, 'cards': 1, 'badges': 1};
				return;
			}

			document.location.hash = '/' + encodeURIComponent($scope.UserID || data.steamid64 || '');
			window.localStorage.lastUser = $scope.UserID;
			$scope.user = data;
			$scope.userStale = Boolean(data.stale);
			$scope.userGames = {};
			if (data.games !== null) {
				for (var i = 0; i < data.games.length; i++) {
					$scope.userGames[data.games[i]] = true;
				}
			}

			$scope.userBadges = (data.badges === null) ? {} : data.badges;
			$scope.userCards = (data.cards === null) ? {} : data.cards;

			$scope.userData.games = (data.games !== null) ? 3 : 0;
			$scope.userData.cards = (data.cards !== null) ? 3 : 0;
			$scope.userData.badges = (data.badges !== null) ? 3 : 0;

			if (data.cards === null) {
				$scope.user_status = data.huge
					? "Inventory has >20,000 items (games & badges loaded) — use Import from Steam below for cards."
					: "Inventory unavailable/private — use Import from Steam below.";
			}

			$scope.importUserData();
			}, 0);
		}, function(errResp){
			$timeout(function() {
				var errData = errResp && errResp.data;
				var msg = (errData && errData.reason)
					? String(errData.reason)
					: "Could not load Steam profile.";
				if (errData && errData.help === 2) {
					msg += " Try pasting your full Steam profile URL.";
				}
				msg += " Or use Import from Steam below.";
				$scope.user_status = msg;
				$scope.userData = {'games': 0, 'cards': 0, 'badges': 0};
			}, 0);
		});
	};

	$scope.loadGameList = function(games) {
		$scope.userGames = {};
		for (var i = 0; i < games.length; i++) {
			$scope.userGames[games[i]] = true;
		}

		if (!$scope.userCards) $scope.userCards = {};
		if (!$scope.userBadges) $scope.userBadges = {};
		$scope.userData.games = 3;
		if (!$scope.user || $scope.user.cards === null || $scope.user.cards === undefined) {
			$scope.userData.cards = 0;
		}
		if (!$scope.user || $scope.user.badges === null || $scope.user.badges === undefined) {
			$scope.userData.badges = 0;
		}
		var prevUser = $scope.user && typeof $scope.user === 'object' ? $scope.user : {};
		var parsedLvl = Number(prevUser.level);
		var parsedXp = Number(prevUser.xp);
		$scope.user = Object.assign({}, prevUser, {
			games: games,
			level: Number.isFinite(parsedLvl) ? Math.max(0, Math.floor(parsedLvl)) : 0,
			xp: Number.isFinite(parsedXp) ? Math.max(0, Math.floor(parsedXp)) : 0
		});

		$scope.importUserData();
	};

	$scope.openInventoryImporter = function(initialJson) {
		if (!window.SteamToolsImport) return;
		var idHint = ($scope.user && $scope.user.steamid64) || String($scope.UserID || '').trim();
		window.SteamToolsImport.openImportDialog({
			mode: 'cards',
			appid: '753',
			contextid: '6',
			steamId: idHint,
			initialJson: typeof initialJson === 'string' ? initialJson : undefined,
			title: 'Import Steam Trading Cards',
			subtitle: 'Load your card sets, foil cards, emotes, and backgrounds directly from Steam.',
			onImport: function(parsed) {
				$timeout(function() {
					var prevUser = $scope.user && typeof $scope.user === 'object' ? $scope.user : {};
					var cardsMap = parsed && parsed.cards ? parsed.cards : {};
					var importedSid = (parsed && /^\d{17}$/.test(String(parsed.steamid64 || '')))
						? String(parsed.steamid64)
						: '';
					var steamIdVal = importedSid ||
						(/^\d{17}$/.test(String(prevUser.steamid64 || '')) ? prevUser.steamid64 : '') ||
						(/^\d{17}$/.test(String($scope.UserID || '').trim()) ? String($scope.UserID).trim() : '');
					if (steamIdVal && !String($scope.UserID || '').trim()) {
						$scope.UserID = steamIdVal;
					}

					var prevLvl = Number(prevUser.level);
					var prevXp = Number(prevUser.xp);
					$scope.user = {
						steamid64: steamIdVal,
						games: prevUser.games || null,
						badges: prevUser.badges || null,
						level: Number.isFinite(prevLvl) ? Math.max(0, Math.floor(prevLvl)) : 0,
						xp: Number.isFinite(prevXp) ? Math.max(0, Math.floor(prevXp)) : 0,
						cards: cardsMap,
						emote_count: parsed.emote_count || 0,
						bg_count: parsed.bg_count || 0
					};
					if (!$scope.userGames) $scope.userGames = {};
					if (!$scope.userBadges) $scope.userBadges = {};
					$scope.userCards = cardsMap;
					$scope.userData.cards = 3;
					if (!prevUser.games) $scope.userData.games = 0;
					if (!prevUser.badges) $scope.userData.badges = 0;
					var stMsg = "Local inventory: " + Object.keys(cardsMap).length +
						" card set(s), " + $scope.user.emote_count + " emote(s), " + $scope.user.bg_count + " bg(s).";
					if (parsed && parsed.more_items) {
						stMsg += ' More pages on Steam — click "Update / Add Inventory Page" to add Page ' + ((parsed.page_count || 1) + 1) + '.';
					}
					$scope.user_status = stMsg;
					$scope.importUserData();
					$scope.userLoaded = true;
				});
			}
		});
	};

	if (typeof CFG.attachSteamIdPasteGuard === 'function') {
		CFG.attachSteamIdPasteGuard(document.getElementById('cards-steamid'), {
			onJsonPaste: function(text) {
				$timeout(function() {
					$scope.openInventoryImporter(text);
				}, 0);
			},
			onOversizedPaste: function() {
				$timeout(function() {
					$scope.user_status = "Pasted text is too long for a SteamID — use Import from Steam below.";
				}, 0);
			}
		});
	}

	// Load user data into rows
	$scope.importUserData = function() {
		// Only perform once we have both user and set data
		if (!$scope.user || !$scope.dataLoaded) return;

		$scope.hasCompleteBadges = false;
		$scope.user.game_count = 0;
		$scope.user.game_worth = 0;
		$scope.user.card_count = 0;
		$scope.user.card_worth = 0;
		$scope.user.badge_count = 0;
		$scope.user.badge_worth = 0;
		$scope.user.badge_unique = 0;

		var row, appid, ind;
		for (var i = 0; i < $scope.rows.length; i++) {
			row = $scope.rows[i];
			row.links = generateLinks(row.game, row.appid, row.foil, $scope.user.steamid64);
			appid = row.appid;

			if ($scope.userGames[appid] === true) {
				row.game_owned = true;
				if (!row.foil){
					$scope.user.game_count += 1;
					$scope.user.game_worth += row.discount;
				}
			} else {
				row.game_owned = false;
			}

			if ($scope.userBadges.hasOwnProperty(appid)) {
				ind = row.foil ? 1 : 0;
				row.badge_lvl = $scope.userBadges[appid][ind];
				if (row.badge_lvl === 5 || (row.foil && row.badge_lvl))
					$scope.hasCompleteBadges = true;
				$scope.user.badge_count += row.badge_lvl;
				if (row.badge_lvl > 0) $scope.user.badge_unique += 1;
				$scope.user.badge_worth += row.price_set * row.badge_lvl;
			} else {
				row.badge_lvl = 0;
			}

			if ($scope.userCards.hasOwnProperty(appid)) {
				ind = row.foil ? 2 : 0;
				row.cards_owned = $scope.userCards[appid][ind];
				row.unique_owned = $scope.userCards[appid][ind + 1];
				$scope.user.card_count += row.cards_owned;

				row.price_diff = Math.max(row.price_set - row.price_avg * row.unique_owned, 0);
				$scope.user.card_worth += row.price_avg * row.cards_owned;
			} else {
				row.cards_owned = 0;
				row.unique_owned = 0;
			}
		}

		$scope.user.card_worth /= 1.15;

		$scope.table.column(2).visible(true);
		$scope.table.column(5).visible(true);
		$scope.visibleCol[2] = true;
		$scope.visibleCol[5] = true;
		$scope.availableCol[2] = true;
		$scope.availableCol[3] = true;
		$scope.availableCol[5] = true;
		$scope.availableCol[7] = true;

		// Refresh rows to show new data
		$scope.table.rows().invalidate();
		$scope.table.draw();

		$scope.userLoaded = true;
	};

	// Unload user data
	$scope.userLogout = function() {
		if (!$scope.dataLoaded) return;

		CFG.performLogout($http);
		$scope.user_status = "";

		var row;
		for (var i = 0; i < $scope.rows.length; i++) {
			row = $scope.rows[i];
			row.links = generateLinks(row.game, row.appid, row.foil);
			row.game_owned = false;
			row.badge_lvl = 0;
			row.cards_owned = 0;
			row.unique_owned = 0;
			row.price_diff = row.price_set;
		}

		$scope.table.column(2).visible(false);
		$scope.table.column(3).visible(false);
		$scope.table.column(5).visible(false);
		$scope.table.column(7).visible(false);
		$scope.visibleCol[2] = false;
		$scope.visibleCol[3] = false;
		$scope.visibleCol[5] = false;
		$scope.visibleCol[7] = false;
		$scope.availableCol[2] = false;
		$scope.availableCol[3] = false;
		$scope.availableCol[5] = false;
		$scope.availableCol[7] = false;

		$scope.userLoaded = false;
		$scope.userStale = false;
		$scope.UserID = "";

		delete window.localStorage.lastUser;
		if (window.history && typeof window.history.replaceState === 'function') {
			window.history.replaceState(null, '', window.location.pathname + window.location.search);
		} else {
			document.location.hash = '';
		}
		delete $scope.userGames;
		delete $scope.userBadges;
		delete $scope.userCards;
		delete $scope.user;

		$scope.userData = {'games': 1, 'cards': 1, 'badges': 1};

		// Refresh rows to show updated data
		$scope.table.rows().invalidate();
		$scope.table.draw();
	};

	$scope.openLevelCalc = function () {
		ensureHighchartsLoaded().catch(function() {});
		$modal.open({
			templateUrl: 'levelCalculator.html',
			controller: LevelCalcCtrl,
			size: 'lg',
			scope: $scope
		});
	};

	$scope.openGameImporter = function () {
		$modal.open({
			templateUrl: 'gameImporter.html',
			controller: GameImporterCtrl,
			size: 'lg',
			scope: $scope
		});
	};

	// Show or hide a table column
	$scope.toggleCol = function(colInd) {
		var c = $scope.table.column(colInd);
		c.visible(!c.visible());
		$('#set_table').width("100%");
		$scope.table.draw();
	};

	// Various filtering variables
	$scope.setType = {'standard': true, 'foil': false};
	$scope.filters = {
		'own_game': false,
		'not_own_game': false,
		'own_cards': false,
		'hide_completed': false,
		'hide_incompleted': false,
		'hide_f2p': false,
		'hide_nonf2p': false,
	};

	if (window.localStorage.setTypeConfig !== undefined) {
		try {
			$scope.setType = JSON.parse(window.localStorage.setTypeConfig);
		} catch (e) {
			delete window.localStorage.setTypeConfig;
		}
	}

	if (window.localStorage.filtersConfig !== undefined) {
		try {
			$scope.filters = JSON.parse(window.localStorage.filtersConfig);
		} catch (e) {
			delete window.localStorage.filtersConfig;
		}
	}

	$scope.tableColumns = [
	/* 0*/ {data: 'game',         title: "Game",        width: "250px", render: $scope.overflow},
	/* 1*/ {data: 'links',        title: "Links",       width: "50px"},
	/* 2*/ {data: 'cards_owned',  title: "# Owned",     width: "50px"},
	/* 3*/ {data: 'unique_owned', title: "# Unique",    width: "50px"},
	/* 4*/ {data: 'count',        title: "# Cards",     width: "50px"},
	/* 5*/ {data: 'badge_lvl',    title: "Badge Lvl",   width: "60px"},
	/* 6*/ {data: 'price_set',    title: "Set Price",   width: "60px"},
	/* 7*/ {data: 'price_diff',   title: "Price Diff",  width: "60px"},
	/* 8*/ {data: 'price_avg',    title: "Card Avg",    width: "60px"},
	/* 9*/ {data: 'booster_avg',  title: "Booster Avg", width: "70px"},
	/*10*/ {data: 'booster_eff',  title: "Booster %",   width: "70px", render: $scope.percent},
	/*11*/ {data: 'emotes_avg',   title: "Emote Avg",   width: "60px"},
	/*12*/ {data: 'bgs_avg',      title: "BG Avg",      width: "60px"},
	/*13*/ {data: 'qty_avg',      title: "Avg Qty",     width: "54px"},
	/*14*/ {data: 'discount',     title: "Discount",    width: "54px"},
	/*15*/ {data: 'added',        title: "Added",       width: "90px", render: $scope.date},
	/*16*/ {data: 'clean_game',   title: "Clean game",  width: "250px"},
	/*17*/ {data: 'appid',        title: "AppId",       width: "50px"},
	];

	$scope.columnHints = [
	/* 0*/ "Name of the set's game",
	/* 1*/ "Useful links for the set",
	/* 2*/ "Number of cards you own for the set",
	/* 3*/ "Number of unique cards you own for the set",
	/* 4*/ "Number of cards in the set",
	/* 5*/ "The level of your badge for the set",
	/* 6*/ "The total price of all the cards for the set",
	/* 7*/ "Difference between price of set and the cards you already own for it",
	/* 8*/ "The average price of a card in the set",
	/* 9*/ "The average price of a card from the set's booster",
	/*10*/ "How many percent cheaper average booster cards are for the set",
	/*11*/ "The average price of the set's emoticons",
	/*12*/ "The average price of the set's backgrounds",
	/*13*/ "The average quantity of items on the market",
	/*14*/ "The money you would make by selling all your drops for that game",
	/*15*/ "The date the set was added",
	];

	// Create the table
	$scope.table = $('#set_table').DataTable({
		dom: "<'row'<'thirds'B><'thirds'<'currency-menu'>><'thirds'f>r>" +
			 "t" +
			 "<'row'<'col-xs-12 center'i>>",
		buttons: [
			{
				extend: 'copy',
				exportOptions: {
					columns: ':visible',
					orthogonal: 'export',
				},
			},
			{
				extend: 'csv',
				title: 'STC_set_data',
				exportOptions: {
					columns: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17],
					orthogonal: 'export',
				},
			},
			{
				extend: 'excel',
				title: 'STC_set_data',
				exportOptions: {
					columns: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17],
					orthogonal: 'export',
				},
			},
		],
		scroller: true,
		deferRender: true,
		autoWidth: false,
		scrollX: true,
		scrollY: "80vh",
		pageLength: 100,
		stateSave: true,
		colReorder: true,
		order: [[15, 'desc']],
		scrollCollapse: true,
		language: {
			emptyTable: "Loading set data..."
		},
		columnDefs: [
			{orderSequence: ['desc', 'asc'], targets: [2, 3, 4, 5, 10, 13, 15]},
			{render: $scope.formatCurrency, targets: [6, 7, 8, 9, 11, 12, 14]},
			{visible: false, targets: [2, 3, 5, 7, 9, 11, 12, 13, 16, 17]},
			{class: "center", targets: "_all"},
			{orderable: false, targets: [1]},
		],
		columns: $scope.tableColumns,
	});

	$scope.tableSettings = $scope.table.settings()[0];
	$scope.visibleCol = $scope.table.columns().visible();
	$scope.availableCol = [true, true, false, false, true, false,
		true, false, true, true, true, true, true, true, true, true];

	// Add custom filter for all the set filtering
	$.fn.dataTableExt.afnFiltering.push(
		function(settings, data, dataIndex) {
			var row = $scope.rows[dataIndex];


			var st = $scope.setType;
			if (row.foil && !st.foil) return false;
			if (!row.foil && !st.standard) return false;

			var f = $scope.filters;
			if (row.f2p && f.hide_f2p) return false;
			if (!row.f2p && f.hide_nonf2p) return false;
			if ($scope.userLoaded) {
				if ($scope.userData.games === 3 && f.own_game && !row.game_owned) return false;
				if ($scope.userData.games === 3 && f.not_own_game && row.game_owned) return false;
				if ($scope.userData.cards === 3 && f.own_cards && row.cards_owned === 0) return false;
				if ($scope.userData.badges === 3 && f.hide_completed) {
					if (!row.foil && row.badge_lvl === 5) return false;
					if (row.foil && row.badge_lvl === 1) return false;
				}
				if ($scope.userData.badges === 3 && f.hide_incompleted) {
					if (!row.foil && row.badge_lvl < 5) return false;
					if (row.foil && row.badge_lvl === 0) return false;
				}
			}

			return true;
		}
	);

	$scope.setCurrency = function(i) {
		$scope.curIndex = i;
	};

	// Add currency bar to table
	var currencyMenuHTML = '<div class="input-group">' +
'   <span class="input-group-addon">Currency</span>' +
'   <div class="input-group-btn dropdown" dropdown>' +
'       <button type="button" class="btn btn-default dropdown-toggle" dropdown-toggle>' +
			'{{ CDATA[curIndex].name }} ' +
		'<span class="caret"></span></button>' +
'       <ul class="dropdown-menu" role="menu">' +
'           <li ng-repeat="currency in CDATA">' +
'               <a href="" ng-click="$event.preventDefault(); setCurrency($index)">{{currency.name}}</a>' +
'           </li>' +
'       </ul>' +
'   </div>' +
'</div>';

	var currencyMenuCompiled = $compile(currencyMenuHTML)($scope);
	$('.currency-menu').html(currencyMenuCompiled);

	// Get and load set data from the server
	$scope.dataLoaded = false;
	var showSetDataError = function() {
		var error = "<br>Error while loading set data. Try the following:<br><br>";
		error += "1. Do a full browser refresh (ctrl+F5)<br>";
		error += "2. Test in a new browser or icognito/private browsing<br>";
		error += "3. If you use HTTPS Everywhere, disable it on this site<br><br>";
		error += "If none of these work, your government/ISP is blocking this site.<br><br>";
		$scope.tableSettings.oLanguage.sEmptyTable = error;
		$scope.table.draw();
	};
	var loadSetDataV2OrLegacy = function() {
		return CFG.getDatasetJson($http, 'data/set_data_v2.json').then(function(doc) {
			var unpacked = (typeof CFG.unpackSetDataV2 === 'function')
				? CFG.unpackSetDataV2(doc)
				: doc;
			if (unpacked && Array.isArray(unpacked.sets)) {
				return unpacked;
			}
			return CFG.getDatasetJson($http, 'data/set_data.json');
		}, function() {
			return CFG.getDatasetJson($http, 'data/set_data.json');
		});
	};
	loadSetDataV2OrLegacy().then(function(data){
		$timeout(function() {
			if (!data || !Array.isArray(data.sets)) {
				showSetDataError();
				return;
			}
			$scope.dataLoaded = true;
			$scope.data = data;
			$scope.rows = [];
			$scope.nameToAppid = {};
			$scope.appidToSet = {};

			// For each set, add the normal and foil row, if they exist
			for (var i = 0; i < $scope.data.sets.length; i++) {
				var set = $scope.data.sets[i];
				set.clean_game = $filter('normalizeForSearch')(set.game);
				if (set.normal !== null) $scope.rows.push(new CardSet(set, false));
				if (set.foil !== null) $scope.rows.push(new CardSet(set, true));
				$scope.nameToAppid[set.clean_game] = set.appid;
				$scope.appidToSet[set.appid] = set;
			}

			// Add rows to table and update
			$scope.importUserData();
			$scope.table.rows.add($scope.rows).draw();
			$scope.table.scroller.measure();
		}, 0);
	}, function() {
		$timeout(showSetDataError, 0);
	});

	if (window.localStorage.hasOwnProperty("curIndex")) {
		$scope.curIndex = parseInt(window.localStorage.curIndex, 10);
		if (!$scope.CDATA.hasOwnProperty($scope.curIndex))
			$scope.curIndex = 0;
	}
	// Update table whenever currency is changed
	$scope.$watch('curIndex', function(newVal, oldVal){
		window.localStorage.curIndex = $scope.curIndex;
		if (newVal !== oldVal && $scope.table) {
			$scope.table.rows().invalidate().draw(false);
		}
	});

	// Update table whenever filters are changed
	$scope.$watch('setType', function(){
		window.localStorage.setTypeConfig = JSON.stringify($scope.setType);
		$scope.table.draw();
	}, true);

	$scope.$watch('filters', function(){
		window.localStorage.filtersConfig = JSON.stringify($scope.filters);
		$scope.table.draw();
	}, true);

	var hash = document.location.hash.slice(1).replace('/', '');
	if (hash && hash.trim().length > 0) {
		try {
			$scope.UserID = decodeURIComponent(hash);
		} catch (e) {
			$scope.UserID = hash;
		}
		$scope.userLogin($scope.UserID);
	} else {
		CFG.checkAuthSession($http).then(function(auth) {
			$timeout(function() {
				if (auth && auth.authenticated && auth.steamid) {
					$scope.UserID = auth.steamid;
					$scope.userLogin($scope.UserID);
				} else if (window.localStorage.hasOwnProperty("lastUser") && window.localStorage.lastUser !== "undefined") {
					$scope.UserID = window.localStorage.lastUser;
					$scope.userLogin($scope.UserID);
				}
			}, 0);
		});
	}

}]);


// CardSet class holding all the information about a set
function CardSet(data, isFoil) {
	var info = isFoil ? data.foil : data.normal;
	this.appid = data.appid;
	this.game = data.game + (isFoil ? " (Foil)" : "");
	this.clean_game = data.clean_game + (isFoil ? " foil" : "");
	this.links = generateLinks(data.game, data.appid, isFoil);
	this.count = data.true_count;
	this.price_set = parseFloat(info.price);
	this.price_avg = parseFloat(info.avg);
	this.booster_avg = parseFloat(data.bprice);
	if (data.bprice === null) this.booster_eff = [0, 0];
	else {
		var v1 = this.price_avg;
		var v2 = this.booster_avg;
		var baseGame = encodeURIComponent(data.game).replace(/'/g, "%27");
		var booster_link = "https://steamcommunity.com/market/listings/753/";
		booster_link += data.appid + "-" + baseGame + "%20Booster%20Pack";
		this.booster_eff = [booster_link, v1 > 0 ? (v1 - v2) / v1 : 0];
	}

	this.emotes_avg = parseFloat(data.emotes_avg);
	this.bgs_avg = parseFloat(data.bgs_avg);
	this.qty_avg = Math.ceil(info.quantity / data.true_count);
	this.discount = parseFloat(data.discount);
	this.added = data.added;
	this.foil = isFoil;
	this.f2p = data.f2p;

	// Extra data to be loaded by user
	this.game_owned = false;
	this.badge_lvl = 0;
	this.cards_owned = 0;
	this.unique_owned = 0;
	this.price_diff = this.price_set;
}

// Generates the links for a set
function generateLinks(game, appid, isFoil, steamid) {
	game = encodeURIComponent(game).replace(/'/g, "%27");
	var profile = (steamid && /^\d{17}$/.test(String(steamid))) ? "profiles/" + encodeURIComponent(steamid) : "my";
	var market_link = generateMarketLink(appid, isFoil);
	var badge_link = "https://steamcommunity.com/" + profile + "/gamecards/" + appid;
	var store_link = "https://store.steampowered.com/app/" + appid;
	var cs_link = "https://steam.cards/index.php?gamepage-appid-" + appid;
	if (isFoil) badge_link += "?border=1";

	var links = "";
	links += "<a href='" + badge_link + "' target='_blank'>[B]</a> ";
	links += "<a href='" + store_link + "' target='_blank'>[S]</a> ";
	links += "<a href='" + market_link + "' target='_blank'>[M]</a> ";
	links += "<a href='" + cs_link + "' target='_blank'>[E]</a>";
	return links;
}

function generateMarketLink(appid, foil) {
	var url = "https://steamcommunity.com/market/search";
	url += "?category_753_Game%5B%5D=tag_app_" + appid;
	url += "&category_753_cardborder%5B%5D=tag_cardborder_" + (foil ? 1 : 0);
	url += "&category_753_item_class%5B%5D=tag_item_class_2";
	url += "&appid=753";
	return url;
}


var GameImporterCtrl = function($scope, $modalInstance, $filter) {
	$scope.loaded = false;
	$scope.gameListInput = '';
	$scope.loadedGames = [];
	$scope.error = false;

	$scope.import = function() {
		var appids = [];
		var mainScope = $scope.$parent;
		if (!mainScope.dataLoaded) {
			$scope.error = 'Card data not yet loaded...';
			return;
		}

		var gameList = $scope.gameListInput.split('\n');
		for (var i = 0; i < gameList.length; i++) {
			var game = $filter('normalizeForSearch')(gameList[i].trim());
			if (mainScope.nameToAppid.hasOwnProperty(game)) {
				appids.push(mainScope.nameToAppid[game]);
			} else if (mainScope.appidToSet.hasOwnProperty(game)) {
				appids.push(game);
			}
		}

		for (var i = 0; i < appids.length; i++) {
			var name =mainScope.appidToSet[appids[i]].game;
			$scope.loadedGames.push(name);
		}

		if (appids.length > 0) {
			$scope.$parent.loadGameList(appids);
		} else {
			$scope.error = 'No matching game found...';
		}
	};

	$scope.close = function() {
		$modalInstance.dismiss('close');
	};
};

var _highchartsPromise = null;
function ensureHighchartsLoaded() {
	if (window.Highcharts || (window.jQuery && window.jQuery.fn && typeof window.jQuery.fn.highcharts === 'function')) {
		return Promise.resolve();
	}
	if (_highchartsPromise) return _highchartsPromise;
	_highchartsPromise = new Promise(function(resolve, reject) {
		var s = document.createElement('script');
		s.src = 'highcharts-custom.js';
		s.charset = 'utf-8';
		s.onload = function() { resolve(); };
		s.onerror = function() {
			_highchartsPromise = null;
			reject(new Error('Failed to load Highcharts'));
		};
		document.head.appendChild(s);
	});
	return _highchartsPromise;
}

var LevelCalcCtrl = function($scope, $modalInstance, $timeout) {
	$scope.draw = function() {
		var mainScope = $scope.$parent;
		var rows = Array.isArray(mainScope && mainScope.rows) ? mainScope.rows : [];
		if (rows.length === 0) return;

		var i, j, c, needed, row, price;
		var set_prices = [];

		for (i = 0; i < rows.length; i++) {
			row = rows[i];
			price = Number(row.price_set);
			if (!Number.isFinite(price) || price <= 0) continue;

			c = row.foil ? 1 : 5;
			for (j = 0; j < c - row.badge_lvl; j++)
				set_prices.push(price);
		}

		var loaded = mainScope.userLoaded;
		var user = mainScope.user;
		var rawLevel = (loaded && user) ? Number(user.level) : 0;
		var startLevel = Number.isFinite(rawLevel) ? Math.max(0, Math.floor(rawLevel)) : 0;

		set_prices.sort(function(a, b) { return b - a; });

		var cumCost = [];
		var cumBadge = [];
		var total = 0;
		var badges = 0;
		var level = startLevel + 1;

		for (i = 0; i <= startLevel; i++) {
			cumCost.push(null);
			cumBadge.push(0);
		}

		while (true) {
			needed = Math.ceil(level / 10);
			if (!Number.isFinite(needed) || needed <= 0 || needed > set_prices.length) break;

			for (i = 0; i < needed; i++)
				total += set_prices.pop();

			badges += needed;
			cumCost.push(Math.max(0.01, Math.round(total * 100) / 100));
			cumBadge.push(badges);
			level++;
		}

		ensureHighchartsLoaded().then(function() {
			$timeout(function() {
				$("#graph").css("height", "400px").highcharts({
					chart: {type: 'area'},
					legend: {enabled: false},
					title: {text: null},
					xAxis: {
						min: startLevel + 1,
						title: {text: 'Target Level'}
					},
					yAxis: {
						min: 0.01,
						labels: {
							formatter: function() {
								return mainScope.formatCurrency(this.value, 'display');
							}
						},
						type: 'logarithmic',
						title: {
							offset: 80,
							text: 'Total Cost'
						}
					},
					series: [{data: cumCost}],
					plotOptions: {
						area: {
							marker: {
								enabled: false,
								symbol: 'circle',
								radius: 1,
								states: {
									hover: {
										enabled: true
									}
								}
							}
						}
					},
					tooltip: {
						formatter: function () {
							return '<b>Cost to level ' + this.x + '</b><br>' +
								mainScope.formatCurrency(this.y, 'display') +
								' (' + cumBadge[this.x] + ' badges)';
						},
						useHTML: true
					}
				});
				$scope.graphLoaded = true;
			}, 0);
		}, function() {
			$timeout(function() {
				$("#levelInfo").text("Failed to load chart library — please try again.");
			}, 0);
		});
	};

	$scope.close = function() {
		$modalInstance.dismiss('close');
	};
};

function getCookie(name) {
	var regexp = new RegExp("(?:^" + name + "|;\\s*"+ name + ")=(.*?)(?:;|$)", "g");
	var result = regexp.exec(document.cookie);
	return (result === null) ? null : result[1];
}

function deleteCookie(name) {
  document.cookie = name + '=; path=/; domain=.steam.tools; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}
