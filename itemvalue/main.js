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

angular.module('valueApp', ['ui.bootstrap', 'vcRecaptcha'])
.config(['$tooltipProvider', function($tooltipProvider){
	$tooltipProvider.setTriggers({
		'motaenter': 'mouseleave',
		'click': 'click',
		'focus': 'blur',
		'show': 'mouseleave'
	});
}])
.config(['$locationProvider', function($locationProvider) {
  $locationProvider.hashPrefix('');
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
}).controller('InvCtrl',
	['$scope', '$http', '$filter', 'vcRecaptchaService',
 		($scope, $http, $filter, vcRecaptchaService) => {
	$scope.SERVERS = ["item-value", "item-value2", "item-value3", "item-value4", "item-value5",
					  "item-value6", "item-value7", "item-value8", "item-value9", "item-value10",
					  "item-value11", "item-value12", "item-value13", "item-value14", "item-value15"];
	$scope.CDATA = CURRENCY_DATA;
	$scope.ECONOMY = "https://steamcommunity-a.akamaihd.net/economy/image/";
	$scope.LISTING = "https://steamcommunity.com/market/listings/";
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
	$scope.useTable = true;

	$http.get('https://data.steam.tools/data/currency.json').then(({data}) => {
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
		"583950",
		"433850",
		"252490",
		"304930",
		"218620",
		"238460",
		"321360",
		"232090",
		"322330",
		"578080",
	];

	$scope.typeMap = {
		'753': "Steam",
		'440': "Team Fortress 2",
		'730': "CS:GO",
		'570': "Dota 2",
		'583950': "Artifact",
		'433850': "H1Z1: King of the Kill",
		'252490': "Rust",
		'304930': "Unturned",
		'218620': "PAYDAY 2",
		'238460': "BattleBlock Theater",
		'321360': "Primal Carnage: Extinction",
		'232090': "Killing Floor 2",
		'322330': "Don't Starve Together",
		'578080': "PLAYERUNKNOWN'S BATTLEGROUNDS",
	};

	$scope.iconMap = {
		'753': "135dc1ac1cd9763dfc8ad52f4e880d2ac058a36c",
		'440': "033bdd91842b6aca0633ee1e5f3e6b82f2e8962f",
		'730': "d1159d1a4d0e18da4d74f85dbb4934d7a92ace2b",
		'570': "c0d15684e6c186289b50dfe083f5c562c57e8fb6",
		'583950': "dee44586fb8e07add8b86bfb59c958071d08b0e2",
		'433850': "5b84d84ae300bbd409abef5ad0ef09b65383740e",
		'252490': "acf87ad23570b3c81f8c9cfc19544a07edd8b632",
		'304930': "7500f9e8568184afab30645d9fb0d18cdb4100fb",
		'218620': "a6abc0d0c1e79c0b5b0f5c8ab81ce9076a542414",
		'238460': "f1e4fa88188fe97c8292b27ff1359e61fdc4bcd7",
		'321360': "acdedc2593c79f1082355e43744c9aa9efe226bf",
		'232090': "98ab6d7da74551839cba1896f012f5e7398072a8",
		'322330': "5176d189ff929acc8d29a2e5f0466e18798db436",
		'578080': "ecb8776e4e2b3d962a16b58e1172d5c277a52fa0",
	};

	$scope.ts = false;
	$scope.key = false;
	$scope.captchaId = 0;
	$scope.captchaKey = false;
	$scope.setCaptchaKey = function(key) {
		$scope.captchaKey = key;
		if (key) $scope.loadItems();
	};

	$scope.setCaptchaId = function(id) {
		$scope.captchaId = id;
	};

	$scope.expireCaptcha = function() {
		vcRecaptchaService.reload($scope.captchaId);
		$scope.captchaKey = false;
	};

	$scope.getIcon = function(appid) {
		var ext = ['753', '583950', '218620'].includes(appid) ? '.jpg' : '.ico';
		var ico = $scope.iconMap[appid] + ext;
		return "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/" + appid + "/" + ico;
	};

	$scope.setCurrency = function(i) {
		$scope.curIndex = i;
	};

	$scope.loadItems = function(){
		if (!$scope.captchaKey || !$scope.UserID || $scope.UserID.trim() === "")
			return;

		$scope.items = [];
		window.localStorage.lastUser = $scope.UserID;
		window.localStorage.lastAppid = $scope.appid.model;
		$scope.fetchItems($scope.UserID, $scope.appid.model);
		$scope.retries = 0;
	};

	$scope.dupesFilter = function(item) {
		if (!$scope.flags.dupes) return true;
		return item.count > 1;
	};

	$scope.retries = 0;
	$scope.fetchItems = function(user, appid, huge=false){
		$scope.iconLimit = 54;
		$scope.status = "Loading...";
		var help = document.getElementById("help");
		help.innerHTML = "";

		var domain;
		if (huge) {
			domain = atob('aHR0cHM6Ly9pdGVtLXZhbHVlMTYuYXBwc3BvdC5jb20=');
		} else {
			Math.seedrandom(user);
			var servers = $scope.SERVERS;
			if (appid == '753' || appid == '730') {
				servers = servers.slice(0, 8);
			} else if (appid == '440' || appid == '570') {
				servers = servers.slice(8);
			}

			var ind = Math.floor(Math.random() * servers.length);
			ind = (ind + $scope.retries) % servers.length;
			domain = `https://${servers[ind]}.appspot.com`;
		}

		var url = `${domain}/ItemValue?i=1&id=${encodeURIComponent(user)}&app=${appid}`;

		if ($scope.key && $scope.ts) {
			url += '&ts=' + $scope.ts + '&key=' + $scope.key;
		} else if ($scope.captchaKey) {
			url += '&captcha=' + $scope.captchaKey;
		} else {
			return;
		}

		$http({method: 'GET', url: url}).then((response) => {
			let data = response.data;
			if (!data) return;
			$scope.type = "0";

			if (data.help === 1) {
				help.innerHTML = "Make sure your " +
					"<a href='https://steamcommunity.com/my/edit/settings'" +
					"target='_blank'>inventory privacy</a> " +
					"is set to public.";
			} else if (data.help === 2) {
				help.innerHTML = "Try pasting the " +
					"<a href='https://steamcommunity.com/my/'" +
					"target='_blank'>Steam profile URL</a>.";
			} else {
				help.innerHTML = "";
			}

			if (data.key && data.ts) {
				$scope.key = data.key;
				$scope.ts = data.ts;
			} else {
				vcRecaptchaService.reload($scope.captchaId);
				$scope.captchaKey = false;
				$scope.key = false;
				$scope.ts = false;
				data.retry = false;
			}

			if (data.success === false){
				if (data.huge && !huge) {
					$scope.fetchItems(user, appid, true);
				} else if (data.retry && $scope.retries < $scope.SERVERS.length) {
					$scope.status = "Something went wrong, retrying...";
					$scope.retries++;
					$scope.fetchItems(user, appid);
				} else {
					$scope.status = "Failed: " + data.reason;
					delete window.localStorage.lastUser;
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

				if ($scope.items[0].icon === null) {
					$scope.table.column(0).visible(0);
					$scope.useTable = true;
				}

				var url = "https://steamcommunity.com/";
				if (data.name.length === 17 && !isNaN(data.name)) {
					url += "profiles/" + data.name;
				} else {
					url += "id/" + data.name;
				}
				url += "/inventory/#" + $scope.appidLoaded;
				$scope.status = "";
				var html = "<a href='" + url + "' target='_blank'>Inventory</a> ";
				html += "| <a href='https://steamrep.com/search?q=" + data.name + "' target='_blank'>SteamRep</a>";
				help.innerHTML = html;

			} else {
				var type = $scope.typeMap[$scope.appid.model];
				$scope.status = "No " + type + " items found.";
			}
		}, (response) => {
			$scope.status = "Something went wrong... try again later.";
			vcRecaptchaService.reload($scope.captchaId);
			$scope.captchaKey = false;
			$scope.key = false;
			$scope.ts = false;
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
		'583950': [0, 1, 3, 5, 6, 7],
		'433850': [0, 1, 3, 6, 7],
		'252490': [0, 1, 6, 7],
		'218620': [0, 1, 6, 7],
		'304930': [0, 1, 6, 7],
		'238460': [0, 1, 6, 7],
		'321360': [0, 1, 6, 7],
		'232090': [0, 1, 6, 7],
		'322330': [0, 1, 3, 5, 6, 7],
		'578080': [0, 1, 6, 7],
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

	if (window.localStorage.hasOwnProperty("lastAppid")) {
		$scope.appid.model = window.localStorage.lastAppid;
	}

	// if (window.localStorage !== undefined && !localStorage.feedbackPrompt) {
	// 	setTimeout(function(){
	// 		FireEvent("feedback", "show");
	// 		localStorage.feedbackPrompt = true;
	// 	}, 100000);
	// }

	if (window.localStorage.curIndex) $scope.curIndex = window.localStorage.curIndex;
	if (window.localStorage.appid) $scope.appid.model = window.localStorage.appid;
	if (window.localStorage.useTable) $scope.useTable = JSON.parse(window.localStorage.useTable);
	$scope.$watch('appid', function(){window.localStorage.appid = $scope.appid.model;});
	$scope.$watch('useTable', function(){window.localStorage.useTable = $scope.useTable;});
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
			var appid = hash.slice(pos + 1);
			if ($scope.apps.indexOf(appid) >= 0) {
				$scope.UserID = name;
				$scope.appid.model = appid;
			}
		}
	}
}]);

// Set class holding all the information about a set
function Item(data) {
	var market_link = "https://steamcommunity.com/market/listings/" + data.url;
	this.name = "<a href='" + market_link + "' target='_blank'><span style='color: #";
	this.name = this.name +  data.color + "'>" + data.name + "</span></a>";
	this.game = data.game || null;
	this.type = data.type || null;
	this.rarity = [data.rarity, data.rcolor];
	this.quality = [data.quality, data.qcolor];
	this.count = data.count;
	this.price = data.price;
	this.stack_price = data.price * data.count;
	var image_url = "https://steamcommunity-a.akamaihd.net/economy/image/" + data.icon + "/360fx360f";
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
