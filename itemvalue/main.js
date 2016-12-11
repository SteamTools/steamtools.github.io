
var CURRENCY_DATA = [  // Thanks to Enhanced Steam
	{name: "USD", ratio: 1.0,       symbolFormat: "$",     right: false},
	{name: "GBP", ratio: 0.6948,    symbolFormat: "£",     right: false},
	{name: "EUR", ratio: 0.9011,    symbolFormat: "€",     right: true},
	{name: "CHF", ratio: 0.9944,    symbolFormat: "CHF ",  right: false},
	{name: "RUB", ratio: 77.130931, symbolFormat: " pуб.", right: true},
	{name: "BRL", ratio: 3.8904,    symbolFormat: "R$ ",   right: false},
	{name: "JPY", ratio: 116.2214,  symbolFormat: "¥ ",    right: false},
	{name: "NOK", ratio: 8.6098,    symbolFormat: " kr",   right: true},
	{name: "IDR", ratio: 13607.0266,symbolFormat: "Rp ",   right: false},
	{name: "MYR", ratio: 4.1507,    symbolFormat: "RM",    right: false},
	{name: "PHP", ratio: 47.7832,   symbolFormat: "P",     right: false},
	{name: "SGD", ratio: 1.4057,    symbolFormat: "S$",    right: false},
	{name: "THB", ratio: 35.4838,   symbolFormat: "฿",     right: false},
	{name: "KRW", ratio: 1206.5546, symbolFormat: "₩ ",    right: false},
	{name: "TRY", ratio: 2.9385,    symbolFormat: " TL",   right: true},
	{name: "MXN", ratio: 18.5933,   symbolFormat: "Mex$ ", right: false},
	{name: "CAD", ratio: 1.3924,    symbolFormat: "CDN$ ", right: false},
	{name: "NZD", ratio: 1.515,     symbolFormat: "NZ$ ",  right: false},
	{name: "CNY", ratio: 6.5643,    symbolFormat: "¥ ",    right: false},
	{name: "INR", ratio: 67.9272,   symbolFormat: "₹ ",    right: false},
	{name: "CLP", ratio: 708.3067,  symbolFormat: "CLP$ ", right: false},
	{name: "PEN", ratio: 3.4845,    symbolFormat: "S/.",   right: false},
	{name: "COP", ratio: 3361.1656, symbolFormat: "COL$ ", right: false},
	{name: "ZAR", ratio: 16.156,    symbolFormat: "R ",    right: false},
	{name: "HKD", ratio: 7.7799,    symbolFormat: "HK$ ",  right: false},
	{name: "TWD", ratio: 33.3559,   symbolFormat: "NT$ ",  right: false},
	{name: "SAR", ratio: 3.7456,    symbolFormat: " SR",   right: true},
	{name: "AED", ratio: 3.6692,    symbolFormat: " AED",  right: true},

	{name: "PLN", ratio: 3.93,      symbolFormat: "zł",    right: true},
	{name: "VND", ratio: 22286.0,   symbolFormat: "₫",     right: false},
	{name: "UAH", ratio: 25.93,     symbolFormat: "₴",     right: true},
	{name: "AUD", ratio: 1.41,      symbolFormat: "A$ ",   right: false},
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
	$scope.SERVERS = ["item-value", "item-value2", "item-value3", "item-value4", "item-value5",
					  "item-value6", "item-value7", "item-value8", "item-value9", "item-value10"];
	$scope.CDATA = CURRENCY_DATA;
	$scope.ECONOMY = "http://cdn.steamcommunity.com/economy/image/";
	$scope.LISTING = "http://steamcommunity.com/market/listings/";
	$scope.status = "Import your profile";
	$scope.TYPES =["all", "emoticon", "background", "card", "booster"];
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
	$scope.useTable = false;

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

	$scope.apps = [
		"753",
		"440",
		"730",
		"570",
		"295110",
		"433850",
		"252490",
		"304930",
		"218620",
		"238460",
		"321360",
		"232090",
		"437220",
		"322330",
	]

	$scope.typeMap = {
		'753': "Steam",
		'440': "Team Fortress 2",
		'730': "CS:GO",
		'570': "Dota 2",
		'295110': "H1Z1: Just Survive",
		'433850': "H1Z1: King of the Kill",
		'252490': "Rust",
		'304930': "Unturned",
		'218620': "PAYDAY 2",
		'238460': "BattleBlock Theater",
		'321360': "Primal Carnage: Extinction",
		'232090': "Killing Floor 2",
		'437220': "The Culling",
		'322330': "Don't Starve Together",
	};

	$scope.iconMap = {
		'753': "steam",
		'440': "033bdd91842b6aca0633ee1e5f3e6b82f2e8962f",
		'730': "d1159d1a4d0e18da4d74f85dbb4934d7a92ace2b",
		'570': "c0d15684e6c186289b50dfe083f5c562c57e8fb6",
		'295110': "4a3e08aa79d21673a83f223b696916a8e4029f20",
		'433850': "5b84d84ae300bbd409abef5ad0ef09b65383740e",
		'252490': "acf87ad23570b3c81f8c9cfc19544a07edd8b632",
		'304930': "7500f9e8568184afab30645d9fb0d18cdb4100fb",
		'218620': "payday2",
		'238460': "f1e4fa88188fe97c8292b27ff1359e61fdc4bcd7",
		'321360': "acdedc2593c79f1082355e43744c9aa9efe226bf",
		'232090': "98ab6d7da74551839cba1896f012f5e7398072a8",
		'437220': "35718688eb35709cb00790da1cc8e0ff2599920c",
		'322330': "5176d189ff929acc8d29a2e5f0466e18798db436",
	};

	$scope.getIcon = function(appid) {
		var url = $scope.iconMap[appid] + ".ico";
		if (appid !== "753" && appid !== "218620") {
			url = "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/" + appid + "/" + url;
		}
		return url;
	}

	$scope.setCurrency = function(i) {
		$scope.curIndex = i;
	};

	$scope.loadItems = function(){
		if (!$scope.UserID || $scope.UserID.trim() === "")
			return;

		$scope.items = [];
		localStorage.lastUser = $scope.UserID;
		localStorage.lastAppid = $scope.appid.model;
		$scope.fetchItems($scope.UserID, $scope.appid.model);
		$scope.retries = 0;
	};

	$scope.dupesFilter = function(item) {
		if (!$scope.flags.dupes) return true;
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

		$http.get(url).success(function(data){
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
				if (data.retry && $scope.retries < $scope.SERVERS.length) {
					$scope.status = "Something went wrong, retrying...";
					$scope.retries++;
					$scope.fetchItems(user, appid);
				} else {
					$scope.status = "Failed: " + data.reason;
					delete localStorage.lastUser;
				}
				return;
			}

			document.location.hash = '/' + data.name + "-" + $scope.appid.model;

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
				var type = $scope.typeMap[$scope.appid.model];
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
		'440': [0, 1, 4, 6, 7],
		'730': [0, 1, 5, 6, 7],
		'570': [0, 1, 4, 5, 6, 7],
		'295110': [0, 1, 3, 6, 7],
		'433850': [0, 1, 3, 6, 7],
		'252490': [0, 1, 6, 7],
		'218620': [0, 1, 6, 7],
		'304930': [0, 1, 6, 7],
		'238460': [0, 1, 6, 7],
		'321360': [0, 1, 6, 7],
		'232090': [0, 1, 6, 7],
		'437220': [0, 1, 6, 7],
		'322330': [0, 1, 3, 5, 6, 7],
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

			if ($scope.flags.dupes) {
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
		$scope.appid.model = localStorage.lastAppid;
	}

	if (window.localStorage !== undefined && !localStorage.feedbackPrompt) {
		setTimeout(function(){
			FireEvent("feedback", "show");
			localStorage.feedbackPrompt = true;
		}, 100000);
	}

	if (localStorage.curIndex) $scope.curIndex = localStorage.curIndex;
	if (localStorage.appid) $scope.appid.model = localStorage.appid;
	if (localStorage.useTable) $scope.useTable = JSON.parse(localStorage.useTable);
	$scope.$watch('appid', function(){localStorage.appid = $scope.appid.model;});
	$scope.$watch('useTable', function(){localStorage.useTable = $scope.useTable;});
	$scope.$watch('flags.fee', function(){$scope.table.rows().invalidate();});
	$scope.$watch('flags.dupes', function(){$scope.table.draw();});
	$scope.$watch('flags.stack', function(old_value, new_value){
		$scope.table.column(7).visible(new_value);
		$scope.table.column(8).visible(old_value);
		$('#item_table').width("100%");
		$scope.table.draw();
	});
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
		var validIDs = ["753", "570", "440", "730", "295110", "252490", "304930", "218620", "238460", "321360"];
		if (validIDs.indexOf(appid) < 0) return;

		$scope.UserID = name;
		$scope.appid.model = appid;
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
	this.stack_price = data.price * data.count;
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