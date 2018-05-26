/* global moment */
/* global angular */
/* global $ */

var CURRENCY_DATA = [
	{name: "USD", symbolFormat: "$",     right: false, ratio: 1.0},
	{name: "AED", symbolFormat: " AED",  right: true,  ratio: 3.673014},
	{name: "ARS", symbolFormat: "$",     right: false, ratio: 17.476},
	{name: "AUD", symbolFormat: "A$ ",   right: false, ratio: 1.296921},
	{name: "BRL", symbolFormat: "R$ ",   right: false, ratio: 3.2331},
	{name: "CAD", symbolFormat: "CDN$ ", right: false, ratio: 1.278936},
	{name: "CHF", symbolFormat: "CHF ",  right: false, ratio: 0.989012},
	{name: "CLP", symbolFormat: "CLP$ ", right: false, ratio: 630.958442},
	{name: "CNY", symbolFormat: "¥ ",    right: false, ratio: 6.6322},
	{name: "COP", symbolFormat: "COL$ ", right: false, ratio: 2983.25},
	{name: "CRC", symbolFormat: "₡",     right: false, ratio: 567.245059},
	{name: "EUR", symbolFormat: "€",     right: true,  ratio: 0.845344},
	{name: "GBP", symbolFormat: "£",     right: false, ratio: 0.753239},
	{name: "HKD", symbolFormat: "HK$ ",  right: false, ratio: 7.8031},
	{name: "IDR", symbolFormat: "Rp ",   right: false, ratio: 13536.913381},
	{name: "ILS", symbolFormat: "₪",     right: false, ratio: 3.51644},
	{name: "INR", symbolFormat: "₹ ",    right: false, ratio: 64.785},
	{name: "JPY", symbolFormat: "¥ ",    right: false, ratio: 113.44850015},
	{name: "KRW", symbolFormat: "₩ ",    right: false, ratio: 1125.12},
	{name: "KWD", symbolFormat: " KD",   right: true,  ratio: 0.302103},
	{name: "KZT", symbolFormat: "₸",     right: false, ratio: 331.641382},
	{name: "MXN", symbolFormat: "Mex$ ", right: false, ratio: 19.04625},
	{name: "MYR", symbolFormat: "RM",    right: false, ratio: 4.230478},
	{name: "NOK", symbolFormat: " kr",   right: true,  ratio: 8.010029},
	{name: "NZD", symbolFormat: "NZ$ ",  right: false, ratio: 1.451801},
	{name: "PEN", symbolFormat: "S/.",   right: false, ratio: 3.234487},
	{name: "PHP", symbolFormat: "P",     right: false, ratio: 51.78},
	{name: "PLN", symbolFormat: "zł",    right: true,  ratio: 3.58675},
	{name: "QAR", symbolFormat: " QR",   right: true,  ratio: 3.87},
	{name: "RUB", symbolFormat: " pуб.", right: true,  ratio: 57.6858},
	{name: "SAR", symbolFormat: " SR",   right: true,  ratio: 3.75055},
	{name: "SGD", symbolFormat: "S$",    right: false, ratio: 1.359619},
	{name: "THB", symbolFormat: "฿",     right: false, ratio: 33.140017},
	{name: "TRY", symbolFormat: " TL",   right: true,  ratio: 3.754188},
	{name: "TWD", symbolFormat: "NT$ ",  right: false, ratio: 30.235161},
	{name: "UAH", symbolFormat: "₴",     right: true,  ratio: 26.678615},
	{name: "UYU", symbolFormat: "$",     right: false, ratio: 29.515579},
	{name: "VND", symbolFormat: "₫",     right: false, ratio: 22720.786641},
	{name: "ZAR", symbolFormat: "R ",    right: false, ratio: 14.037729},
];

angular.module('cardApp', ['ui.bootstrap', 'normalizeForSearch'])
.filter('currency', function($filter){
	return function(input, ind, noCurrency) {
		if (isNaN(input)) return "N/A";

		// Get symbol and decide if it comes before or after
		var symbol = CURRENCY_DATA[ind].symbolFormat;
		var after = CURRENCY_DATA[ind].right;
		var ratio = CURRENCY_DATA[ind].ratio;

		// Make sure input was valid, then convert and format it
		var out = $filter('number')(input * ratio, 2);

		if (noCurrency) return out;

		// Add symbol in the right place
		if (after) return out + symbol;
		else return symbol + out;
	};
})
.controller('CardCtrl', ['$scope', '$http', '$filter', '$compile', '$modal',
function($scope, $http, $filter, $compile, $modal){
	$scope.CDATA = CURRENCY_DATA;

	$http.get('http://cdn.steam.tools/data/currency.json').success(function(data){
		var count = 0;
		for (var i = 0; i < $scope.CDATA.length; i++) {
			var code = $scope.CDATA[i].name;
			if (data.hasOwnProperty(code)) {
				$scope.CDATA[i].ratio = data[code];
				count++;
			}
		}
		console.log('Updated ' + count + '/' + $scope.CDATA.length + ' currencies');
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
		if (type === "export") return data;
		return '<span class="game">' + data + '</span>';
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

		const serverIndex = steamid.slice(-1).charCodeAt(0) % 2;
		const server = ['stc-price', 'stc-price2'][serverIndex]
		var url = "http://" + server + ".appspot.com/UserInfo?id=" + steamid;

		$http.get(url).success(function(data){
			if (!data.success){
				$scope.user_status = data.reason;
				$scope.userData = {'games': 1, 'cards': 1, 'badges': 1};
				return;
			}

			document.location.hash = '/' + $scope.UserID;
			window.localStorage.lastUser = $scope.UserID;
			$scope.user = data;
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
				$scope.user_status = "Private inventory?";
			}

			$scope.importUserData();
		}).error(function(){
			$scope.user_status = "Something went wrong.";
			$scope.userData = {'games': 0, 'cards': 0, 'badges': 0};
		});
	};

	$scope.loadGameList = function(games) {
		$scope.userGames = {};
		for (var i = 0; i < games.length; i++) {
			$scope.userGames[games[i]] = true;
		}

		$scope.userCards = {};
		$scope.userBadges = {};
		$scope.userData.games = 3;
		$scope.userData.cards = 0;
		$scope.userData.badges = 0;
		$scope.user = {games: games};

		$scope.importUserData();
	};

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

		deleteCookie("oauth_steamid");

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
		$scope.UserID = "";

		delete window.localStorage.lastUser;
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
		$scope.setType = JSON.parse(window.localStorage.setTypeConfig);
	}

	if (window.localStorage.filtersConfig !== undefined) {
		$scope.filters = JSON.parse(window.localStorage.filtersConfig);
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
	var currencyMenuHTML = '<div class="input-group btn-group">' +
'   <div class="input-group-addon">Currency</div>' +
'   <div class="dropdown" dropdown>' +
'       <a class="btn btn-default" data-toggle="dropdown" href="#" dropdown-toggle>' +
			'{{ CDATA[curIndex].name }}' +
		'<b class="caret"></b></a>' +
'       <ul class="dropdown-menu" role="menu">' +
'           <li ng-repeat="currency in CDATA">' +
'               <a href="#" ng-click="setCurrency($index)">{{currency.name}}</a>' +
'           </li>' +
'       </ul>' +
'   </div>' +
'</div>';

	var currencyMenuCompiled = $compile(currencyMenuHTML)($scope);
	$('.currency-menu').html(currencyMenuCompiled);

	// Get and load set data from the server
	$scope.dataLoaded = false;
	var url = "http://cdn.steam.tools/data/set_data.json";
	$http.get(url).success(function(data){
		$scope.dataLoaded = true;
		$scope.data = data;
		$scope.rows = [];
		$scope.nameToAppid = {};
		$scope.appidToSet = {};

		// For each set, add the normal and foil row, if they exist
		for (var i = 0; i < $scope.data.sets.length; i++) {
			var set = $scope.data.sets[i];
			set.clean_game = $filter('normalizeForSearch')(set.game);
			if (set.normal !== null) $scope.rows.push(new Set(set, false));
			if (set.foil !== null) $scope.rows.push(new Set(set, true));
			$scope.nameToAppid[set.clean_game] = set.appid;
			$scope.appidToSet[set.appid] = set;
		}

		// Add rows to table and update
		$scope.importUserData();
		$scope.table.rows.add($scope.rows).draw();
		$scope.table.scroller.measure()
	}).error(function() {
		var error = "<br>Error while loading set data. Try the following:<br><br>";
		error += "1. Do a full browser refresh (ctrl+F5)<br>";
		error += "2. Test in a new browser or icognito/private browsing<br>";
		error += "3. If you use HTTPS Everywhere, disable it on this site<br><br>";
		error += "If none of these work, your government/ISP is blocking this site.<br><br>";
		$scope.tableSettings.oLanguage.sEmptyTable = error;
		$scope.table.draw();
	});

	if (window.localStorage.hasOwnProperty("curIndex")) {
		$scope.curIndex = parseInt(window.localStorage.curIndex, 10);
		if (!$scope.CDATA.hasOwnProperty($scope.curIndex))
			$scope.curIndex = 0;
	}
	// Update table whenever currency is changed
	$scope.$watch('curIndex', function(){
		window.localStorage.curIndex = $scope.curIndex;
		$scope.table.rows().invalidate();
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
		$scope.UserID = hash;
		$scope.userLogin($scope.UserID);
	} else if (getCookie("oauth_steamid") !== null) {
		const oauth = unescape(getCookie("oauth_steamid"))
		$scope.UserID = oauth.split('/id/')[1].replace('"', '');
		console.log(oauth, $scope.UserID);
		$scope.userLogin($scope.UserID);
	} else if (window.localStorage.hasOwnProperty("lastUser") && window.localStorage.lastUser !== "undefined") {
		$scope.UserID = window.localStorage.lastUser;
		$scope.userLogin($scope.UserID);
	}

}]);


// Set class holding all the information about a set
function Set(data, isFoil) {
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
		var game = encodeURIComponent(this.game);
		var booster_link = "http://steamcommunity.com/market/listings/753/";
		booster_link += data.appid + "-" + game + "%20Booster%20Pack";
		this.booster_eff = [booster_link, (v1 - v2) / v1];
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
	game = encodeURIComponent(game);
	var profile = !!steamid ? "profiles/" + steamid : "my";
	var market_link = generateMarketLink(appid, isFoil);
	var badge_link = "http://steamcommunity.com/" + profile + "/gamecards/" + appid;
	var store_link = "http://store.steampowered.com/app/" + appid;
	var cs_link = "http://steam.cards/index.php?gamepage-appid-" + appid;
	if (isFoil) badge_link += "?border=1";

	var links = "";
	links += "<a href='" + badge_link + "' target='_blank'>[B]</a> ";
	links += "<a href='" + store_link + "' target='_blank'>[S]</a> ";
	links += "<a href='" + market_link + "' target='_blank'>[M]</a> ";
	links += "<a href='" + cs_link + "' target='_blank'>[E]</a>";
	return links;
}

function generateMarketLink(appid, foil) {
	var url = "http://steamcommunity.com/market/search";
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

var LevelCalcCtrl = function($scope, $modalInstance) {
	$scope.draw = function() {
		var mainScope = $scope.$parent;

		var i, j, c, needed, row, price;
		var set_prices = [];

		for (i = 0; i < mainScope.rows.length; i++) {
			row = mainScope.rows[i];
			price = row.price_set;

			c = row.foil ? 1 : 5;
			for (j = 0; j < c - row.badge_lvl; j++)
				set_prices.push(price);
		}

		var loaded = mainScope.userLoaded;
		var user = mainScope.user;

		set_prices.sort();
		set_prices.reverse();

		var cumCost = [];
		var cumBadge = [];
		var total = 0.01;
		var badges = 0;
		var level = (loaded ? user.level : 0) + 1;

		if (loaded) {
			for (i = 0; i < user.level; i++) {
				cumCost.push(0);
				cumBadge.push(0);
			}
		}

		while (true) {
			cumCost.push(Math.round(total * 100) / 100);
			cumBadge.push(badges);

			needed = Math.ceil(level / 10);
			if (needed > set_prices.length) break;

			for (i = 0; i < needed; i++)
				total += set_prices.pop();

			badges += needed;
			level++;
		}


		var graphHTML = '<div id="graph" style="width:100%; height:400px;"></div>';
		$("#levelInfo").after(graphHTML);
		$("#levelInfo").remove();

		$("#graph").highcharts({
			chart: {type: 'area'},
			legend: {enabled: false},
			title: {text: null},
			xAxis: {
				min: (loaded ? user.level : 0) + 1,
				title: {text: 'Target Level'}
			},
			yAxis: {
				min: 1,
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
			},
		});

		$scope.graphLoaded = true;
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
