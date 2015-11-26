var CURRENCY_DATA = [  // Thanks to Enhanced Steam
	{name: "USD", ratio: 1.0,		symbolFormat: "$",     right: false},
	{name: "GBP", ratio: 0.6633,	symbolFormat: "£",     right: false},
	{name: "EUR", ratio: 0.9456,	symbolFormat: "€",     right: true},
	{name: "CHF", ratio: 1.0218,	symbolFormat: "CHF ",  right: false},
	{name: "RUB", ratio: 65.855601,	symbolFormat: " pуб.", right: true},
	{name: "BRL", ratio: 3.7829,	symbolFormat: "R$ ",   right: false},
	{name: "JPY", ratio: 122.6986,	symbolFormat: "¥ ",    right: false},
	{name: "NOK", ratio: 8.6621,	symbolFormat: " kr",   right: true},
	{name: "IDR", ratio: 13685.3509,symbolFormat: "Rp ",   right: false},
	{name: "MYR", ratio: 4.2069,	symbolFormat: "RM",    right: false},
	{name: "PHP", ratio: 46.9515,	symbolFormat: "P",     right: false},
	{name: "SGD", ratio: 1.4062,	symbolFormat: "S$",    right: false},
	{name: "THB", ratio: 35.7106,	symbolFormat: "฿",     right: false},
	{name: "KRW", ratio: 1143.2884,	symbolFormat: "₩ ",    right: false},
	{name: "TRY", ratio: 2.8786,	symbolFormat: " TL",   right: true},
	{name: "MXN", ratio: 16.5746,	symbolFormat: "Mex$ ", right: false},
	{name: "CAD", ratio: 1.3335,	symbolFormat: "CDN$ ", right: false},
	{name: "NZD", ratio: 1.5235,	symbolFormat: "NZ$ ",  right: false},
	{name: "CNY", ratio: 6.3961,	symbolFormat: "¥ ",    right: false},
	{name: "INR", ratio: 66.3192,	symbolFormat: "₹ ",    right: false},
	{name: "CLP", ratio: 714.3439,	symbolFormat: "CLP$ ", right: false},
	{name: "PEN", ratio: 3.3773,	symbolFormat: "S/.",   right: false},
	{name: "COL", ratio: 3100.2591,	symbolFormat: "COL$ ", right: false},
	{name: "ZAR", ratio: 14.113,	symbolFormat: "R ",    right: false},
	{name: "HKD", ratio: 7.7502,	symbolFormat: "HK$ ",  right: false},
	{name: "NTD", ratio: 32.4516,	symbolFormat: "NT$ ",  right: false},
	{name: "SAR", ratio: 3.7604,	symbolFormat: " SR",   right: true},
	{name: "AED", ratio: 3.6766,	symbolFormat: " AED",  right: true},

	{name: "PLN", ratio: 3.87,		symbolFormat: "zł",    right: true},
	{name: "VND", ratio: 22312.50,	symbolFormat: "₫",     right: false},
	{name: "UAH", ratio: 22.75,		symbolFormat: "₴",     right: true},
	{name: "AUD", ratio: 1.39,		symbolFormat: "A$ ",   right: false},
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
});

function InvCtrl($scope, $http, $filter) {
	$scope.SERVERS = ["item-value", "item-value2", "item-value3", "item-value4", "item-value5", "item-value6"];
	$scope.CDATA = CURRENCY_DATA;
	$scope.ECONOMY = "http://cdn.steamcommunity.com/economy/image/";
	$scope.LISTING = "http://steamcommunity.com/market/listings/";
	$scope.status = "Import your profile";
	$scope.TYPES =["all", "emoticon", "background", "card", "booster"];
	$scope.type = "0";
	$scope.appid = "753";
	$scope.appidLoaded = "0";
	$scope.curIndex = 0;
	$scope.fee = false;
	$scope.dupes = false;
	$scope.iconLimit = 54;
	$scope.useTable = false;

	$scope.typeMap = {
		'753': "Steam",
		'440': "TF2",
		'730': "CS:GO",
		'570': "Dota 2",
		'295110': "H1Z1",
		'252490': "Rust",
		'304930': "Unturned",
		'218620': "PAYDAY 2",
		'238460': "BBT",
	};

	$scope.setCurrency = function(i) {
		$scope.curIndex = i;
	};

	$scope.loadItems = function(){
		if (!$scope.UserID || $scope.UserID.trim() === "")
			return;

		$scope.items = [];
		localStorage.lastUser = $scope.UserID;
		localStorage.lastAppid = $scope.appid;
		$scope.fetchItems($scope.UserID, $scope.appid);
	};

	$scope.dupesFilter = function(item) {
		if (!$scope.dupes) return true;
		return item.count > 1;
	};

	$scope.retries = 0;
	$scope.fetchItems = function(user, appid){
		$scope.iconLimit = 54;
		$scope.status = "Loading...";
		var help = document.getElementById("help");
		help.innerHTML = "";

		Math.seedrandom(user);
		user = encodeURIComponent(user);
		var ind = Math.floor(Math.random() * $scope.SERVERS.length);
		ind = (ind + $scope.retries) % $scope.SERVERS.length;
		var domain = "http://" + $scope.SERVERS[ind] + ".appspot.com";
		var url = domain + "/ParseInv?id=" + user + "&app=" + appid;
		url += "&callback=JSON_CALLBACK";

		$http.jsonp(url).success(function(data){
			$scope.type = "0";

			if (data.help === 1) {
				help.innerHTML = "Make sure your " +
					"<a href='http://steamcommunity.com/my/edit/settings'" +
					"target='_blank'>inventory privacy</a> " +
					"is set to public.";
			} else if (data.help === 2) {
				help.innerHTML = "Try pasting the " +
					"<a href='http://steamcommunity.com/my/'" +
					"target='_blank'>Steam profile URL</a>.";
			} else {
				help.innerHTML = "";
			}

			if (!data || data.success === false){
				$scope.status = "Failed: " + data.reason;
				delete localStorage.lastUser;
				return;
			}

			document.location.hash = '/' + data.name + "-" + $scope.appid;

			$scope.appidLoaded = appid;
			$scope.items = data.items;
			$scope.rows = [];

			if ($scope.items.length > 0) {
				for (var i = 0; i < $scope.items.length; i++) {
					var item = $scope.items[i];
					item.price = parseFloat(item.price);
					$scope.rows.push(new Item(item));
				}

				$scope.table.clear();
				$scope.table.columns().visible(false);
				$scope.table.columns($scope.visCols[appid]).visible(true);
				$scope.table.columns.adjust().draw(false);
				$scope.table.rows.add($scope.rows).draw();

				var url = "http://steamcommunity.com/";
				if (data.name.length === 17 && !isNaN(data.name)) {
					url += "profiles/" + data.name;
				} else {
					url += "id/" + data.name;
				}
				url += "/inventory/#" + $scope.appidLoaded;
				$scope.status = "";
				var html = "<a href='" + url + "' target='_blank'>Inventory</a> ";
				html += "| <a href='http://steamrep.com/search?q=" + data.name + "' target='_blank'>SteamRep</a>";
				help.innerHTML = html;

			} else {
				var type = $scope.typeMap[$scope.appid];
				$scope.status = "No " + type + " items found.";
			}

		}).error(function(){
			if ($scope.retries < $scope.SERVERS.length) {
				$scope.retries++;
				$scope.fetchItems(user, appid);
			} else {
				$scope.status = "Something went wrong... try again later.";
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
		return $filter('currency')(data, $scope.curIndex, $scope.fee);
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
	/* 1*/ {data: 'image', title: "Image", width: "30px", orderable: false},
	/* 0*/ {data: 'name', title: "Item Name", width: "250px", render: overflow},
	/* 1*/ {data: 'game', title: "Game", width: "250px", render: overflow},
	/* 2*/ {data: 'type', title: "Type", width: "80px"},
	/* 3*/ {data: 'quality', title: "Quality", width: "80px", render: $scope.qualitySort, orderSequence: ['desc', 'asc']},
	/* 4*/ {data: 'rarity', title: "Rarity", width: "80px", render: $scope.raritySort, orderSequence: ['desc', 'asc']},
	/* 5*/ {data: 'count', title: "Count", width: "40px", orderSequence: ['desc', 'asc']},
	/* 6*/ {data: 'price', title: "Price", width: "60px", orderSequence: ['desc', 'asc'], render: $scope.formatCurrency},
	];

	$scope.visCols = {
		'753': [1, 2, 3, 5, 6, 7],
		'440': [0, 1, 4, 6, 7],
		'730': [0, 1, 5, 6, 7],
		'570': [0, 1, 4, 5, 6, 7],
		'295110': [0, 1, 3, 6, 7],
		'252490': [0, 1, 6, 7],
		'218620': [0, 1, 6, 7],
		'304930': [0, 1, 6, 7],
		'238460': [0, 1, 6, 7],
	};

	// Create the table
	$scope.table = $('#item_table').DataTable({
		dom: "t<'row'<'col-xs-6'i><'col-xs-6'p>>",
		pageLength: 40,
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

			if ($scope.dupes) {
				result = result && row.count > 1;
			}

			if ($scope.type !== "0") {
				result = result && row.type === $scope.TYPES[$scope.type];
			}

			return result;
		}
	);


	if (localStorage.hasOwnProperty("lastUser")) {
		$scope.UserID = localStorage.lastUser.replace('/', '');
	}

	if (localStorage.hasOwnProperty("lastAppid")) {
		$scope.appid = localStorage.lastAppid;
	}

	if (window.localStorage !== undefined && !localStorage.feedbackPrompt) {
		setTimeout(function(){
			FireEvent("feedback", "show");
			localStorage.feedbackPrompt = true;
		}, 100000);
	}

	if (localStorage.curIndex) $scope.curIndex = localStorage.curIndex;
	if (localStorage.appid) $scope.appid = localStorage.appid;
	if (localStorage.useTable) $scope.useTable = JSON.parse(localStorage.useTable);
	$scope.$watch('appid', function(){localStorage.appid = $scope.appid;});
	$scope.$watch('useTable', function(){localStorage.useTable = $scope.useTable;});
	$scope.$watch('fee', function(){$scope.table.rows().invalidate();});
	$scope.$watch('dupes', function(){$scope.table.draw();});
	$scope.$watch('type', function(){$scope.table.draw();});
	$scope.$watch('curIndex', function(){
		localStorage.curIndex = $scope.curIndex;
		$scope.table.rows().invalidate();
	});
	$scope.$watch('filterText', function(v){
			$scope.table.search(v);
			$scope.table.draw();
	});

	if (!$scope.CDATA.hasOwnProperty($scope.curIndex))
		$scope.curIndex = 0;




	(function() {
		var hash = document.location.hash.slice(1);
		if (!hash || hash.trim().length === 0) return;

		hash = hash.replace('/', '');

		var pos = hash.lastIndexOf("-");
		if (pos < 0) return;

		var name = hash.slice(0, pos);
		var appid = hash.slice(pos + 1);
		var validIDs = ["753", "570", "440", "730", "295110", "252490", "304930", "218620", "238460"];
		if (validIDs.indexOf(appid) < 0) return;

		$scope.UserID = name;
		$scope.appid = appid;
		$scope.loadItems();
	})();
}

// Set class holding all the information about a set
function Item(data) {
	var market_link = "http://steamcommunity.com/market/listings/" + data.url;
	this.name = "<a href='" + market_link + "' target='_blank'><span style='color: #";
	this.name = this.name +  data.color + "'>" + data.name + "</span></a>";
	this.game = data.game || null;
	this.type = data.type || null;
	this.rarity = [data.rarity, data.rcolor];
	this.quality = [data.quality, data.qcolor];
	this.count = data.count;
	this.price = data.price;
	var image_url = "http://cdn.steamcommunity.com/economy/image/" + data.icon + "/360fx360f";
	this.image = "<i class='icon icon-fullscreen icon-white' src='" + image_url + "'></i>";
}

function addColor(text, color) {
	if (text)
		return "<span style='color: #" + color + "'>" + text + "</span>";
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
	"Common": 10,
	"Uncommon": 20,
	"Rare": 30,

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

var QUALITY_SORT = {
	"Unique": 10,
	"Vintage": 20,
	"Strange": 30,
	"Genuine": 40,
	"Haunted": 50,
	"Decorated Weapon": 60,
	"Unusual": 70,

	"Common": 10,
	"Uncommon": 20,
	"Rare": 30,
	"Mythical": 40,
	"Immortal": 50,
	"Legendary": 60,
	"Arcana": 70,
};