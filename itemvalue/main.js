var CURRENCY_DATA = [  // Thanks to Enhanced Steam
	{name: "USD", ratio: 1.0,		 symbolFormat: "$",     right: false},
	{name: "GBP", ratio: 0.6607,	 symbolFormat: "£",     right: false},
	{name: "EUR", ratio: 0.8512,	 symbolFormat: "€",     right: true},
	{name: "RUB", ratio: 65.7995,	 symbolFormat: " pуб.", right: true},
	{name: "BRL", ratio: 2.648,		 symbolFormat: "R$ ",   right: false},
	{name: "JPY", ratio: 118.5813,	 symbolFormat: "¥ ",    right: false},
	{name: "NOK", ratio: 7.7489,	 symbolFormat: " kr",   right: true},
	{name: "IDR", ratio: 12594.6001, symbolFormat: "Rp ",   right: false},
	{name: "MYR", ratio: 3.5935,	 symbolFormat: "RM",    right: false},
	{name: "PHP", ratio: 44.7655,	 symbolFormat: "P",     right: false},
	{name: "SGD", ratio: 1.3358,	 symbolFormat: "S$",    right: false},
	{name: "THB", ratio: 32.8344,	 symbolFormat: "฿",     right: false},
	{name: "VND", ratio: 21313.1134, symbolFormat: "₫",     right: false},
	{name: "KRW", ratio: 1083.1894,	 symbolFormat: "₩",     right: false},
	{name: "TRY", ratio: 2.283,		 symbolFormat: " TL",   right: true},
	{name: "UAH", ratio: 16.1363,	 symbolFormat: "₴",     right: true},
	{name: "MXN", ratio: 14.6066,	 symbolFormat: "Mex$ ", right: false},
	{name: "CAD", ratio: 1.1954,	 symbolFormat: "CDN$ ", right: false},
	{name: "AUD", ratio: 1.2279,	 symbolFormat: "A$ ",   right: false},
	{name: "NZD", ratio: 1.2953,	 symbolFormat: "NZ$ ",  right: false},
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
	return function(data, key, mult) {
		if (data === undefined || key === undefined) {
			return 0;
		}

		var sum = 0;
		for (var i = data.length - 1; i >= 0; i--) {
			if (!data[i][key]) continue;
			if (mult === undefined) {
				sum += data[i][key];
			} else {
				sum += data[i][key] * data[i][mult];
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

function InvCtrl($scope, $http) {
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
	$scope.pageLimit = 120;

	$scope.typeMap = {
		'753': "Community",
		'440': "TF2",
		'730': "CS:GO",
		'570': "Dota 2"
	};

	if (localStorage.hasOwnProperty("lastUser")) {
		$scope.UserID = localStorage.lastUser.replace('/', '');;
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
	$scope.$watch('curIndex', function(){localStorage.curIndex = $scope.curIndex;});
	$scope.$watch('appid', function(){localStorage.appid = $scope.appid;});

	if (!$scope.CDATA.hasOwnProperty($scope.curIndex))
		$scope.curIndex = 0;

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
	}

	$scope.retries = 0;
	$scope.fetchItems = function(user, appid){
		Math.seedrandom(user);
		user = encodeURIComponent(user);
		var servers = ["item-value", "item-value2", "item-value3", "item-value4"];
		var ind = Math.floor(Math.random() * servers.length);
		ind = (ind + $scope.retries) % servers.length;
		var domain = "http://" + servers[ind] + ".appspot.com";
		var url = domain + "/ParseInv?id=" + user + "&app=" + appid;
		url += "&callback=JSON_CALLBACK";
		$scope.status = "Loading...";
		$http.jsonp(url).success(function(data){
			$scope.type = "0";

			var help = document.getElementById("help");
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

			if ($scope.items.length > 0) {
				for (var i = 0; i < $scope.items.length; i++) {
					var item = $scope.items[i];
					item.price = parseFloat(item.price);
				}
				var url = "http://steamcommunity.com/";
				if (data.name.length === 17 && !isNaN(data.name)) {
					url += "profiles/" + data.name;
				} else {
					url += "id/" + data.name;
				}
				url += "/inventory/#" + $scope.appidLoaded;
				$scope.status = "";
				help.innerHTML = "<a href='" + url + "' target='_blank'>Inventory Loaded</a>";
			} else {
				var type = $scope.typeMap[$scope.appid];
				$scope.status = "No " + type + " items found.";
			}

		}).error(function(){
			if ($scope.retries < 4) {
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

	(function() {
		var hash = document.location.hash.slice(1);
		if (!hash || hash.trim().length === 0) return;

		hash = hash.replace('/', '');

		var pos = hash.lastIndexOf("-");
		if (pos < 0) return;

		var name = hash.slice(0, pos);
		var appid = hash.slice(pos + 1);
		var validIDs = ["753", "570", "440", "730"];
		if (validIDs.indexOf(appid) < 0) return;

		$scope.UserID = name;
		$scope.appid = appid;
		$scope.loadItems();
	})();

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