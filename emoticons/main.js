angular
.module('EmoteApp', ['ui-rangeSlider'])
.filter('range', function($filter) {
	return function(input, limits) {
		var newMin, newMax;
		if (limits.type === "Random" || limits.type === "Name" || limits.type === "Game") {
			return input;
		} else if (limits.type === "Hue" || limits.type === "Brightness" || limits.type === "Saturation") {
			newMin = limits.min / 100 * 255;
			newMax = limits.max / 100 * 255;
		} else if (limits.type === "Price") {
			newMin = Math.pow(limits.min, 3) / Math.pow(100, 3) * limits.maxPrice;
			newMax = Math.pow(limits.max, 3) / Math.pow(100, 3) * limits.maxPrice;
		} else if (limits.type === "Date") {
			newMin = limits.min / 100 * limits.dateRange;
			newMax = limits.max / 100 * limits.dateRange;
		} else if (limits.type === "Length") {
			newMin = parseInt(limits.min / 100 * 36, 10);
			newMax = parseInt(limits.max / 100 * 36, 10);
		}

		var minLabel, maxLabel;
		if (limits.type === "Price") {
			minLabel = '$' + $filter('number')(newMin, 2);
			maxLabel = '$' + $filter('number')(newMax, 2);
		} else if (limits.type === "Date") {
			minDate = (newMin + 1368590400) * 1000;
			maxDate = (newMax + 1368590400) * 1000;
			minLabel = new Date(minDate).toDateString().substr(4);
			maxLabel = new Date(maxDate).toDateString().substr(4);
		} else {
			minLabel = parseInt(newMin, 10);
			maxLabel = parseInt(newMax, 10);
		}
		limits.rangeLabel = minLabel + ' - ' + maxLabel;

		var data = 0;
		var newList = [];
		for (var i = 0; i < input.length; i++) {
			var hls = input[i].hls || [0, 0, 0]
			if (limits.type === "Hue") {
				data = hls[0];
			} else if (limits.type === "Brightness") {
				data = hls[1];
			} else if (limits.type === "Saturation") {
				data = hls[2];
			} else if (limits.type === "Price") {
				data = input[i].price;
			} else if (limits.type === "Date") {
				data = input[i].time;
			} else if (limits.type === "Length") {
				data = input[i].name.length - 2;
			}

			if (newMin <= data && data <= newMax)
				newList.push(input[i]);
		}
		return newList;
	};
})
.controller('EmoteCtrl', ['$scope', '$http', '$location',
function($scope, $http, $location) {
	$scope.BASE_URL = "http://steamcommunity.com/market/listings/";
	$scope.SERVERS = ['mosaticon', 'mosaticon2', 'mosaticon3', 'mosaticon4'];
	$scope.emotes = [];
	$scope.numLines = 20;
	$scope.itemsPerLine = 0;

	$scope.limits = {
		min: 0,
		max: 100,
		type: 'Date',
		dateRange: (Date.now()/1000) - 1368590400,
		maxPrice: 400,
	};

	$http.get('http://cdn.steam.tools/data/emote.json').success(function(data){
		var maxPrice = 0;
		for (var i = 0; i < data.length; i++) {
			data[i].appid = data[i].url.split('-')[0].substr(4);
			data[i].price = data[i].price === null ? Infinity : parseFloat(data[i].price);
			if (data[i].price < 1000 && data[i].price > maxPrice)
				maxPrice = data[i].price;
		}

		$scope.limits.maxPrice = maxPrice;
		$scope.emotes = data;
		$scope.genDates();
	});

	$http.get('http://cdn.steam.tools/data/dates.json').success(function(data){
		$scope.dates = data;
		$scope.genDates();
	});

	$scope.owned = {};
	$scope.loggedIn = false;
	$scope.user_status = "Login to filter owned items";
	$scope.userLogin = function(steamid64) {
		$scope.loggedIn = false;
		var server = $scope.SERVERS[parseInt(Math.random() * 4)];
		var url = "http://" + server + ".appspot.com/FetchEmotes?id=" + steamid64;
		$http.get(url).success(function(data){
			if (!data.success) {
				$scope.user_status = data.reason;
				return;
			}

			$scope.owned = {};
			$scope.loggedIn = true;
			$scope.user_status = data.items.length + " items filtered";
			for (var i = 0; i < data.items.length; i++) {
				var name = ":" + data.items[i] + ":";
				$scope.owned[name] = true;
			}
		}).error(function(){
			$scope.user_status = "Something went wrong.";
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
		deleteCookie("oauth_steamid");
		$scope.user_status = "Login to filter owned items";
		$scope.loggedIn = false;
		$scope.owned = {};
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

	$scope.getStyle = function(p){
		var cdn = p[0] >= 195 ? "cdn" : "cdn2";
		var host = "http://" + cdn + ".steam.tools";
		var url = host + "/emoticons/" + p[0];
		var style;
		if ($scope.small){
			style = {
				backgroundImage: "url(" + url + "s.png)",
				backgroundPosition: (p[1] * -20) + "px " + (p[2] * -20) + "px"
			};
		}
		else{
			style = {
				backgroundImage: "url(" + url + ".png)",
				backgroundPosition: (p[1] * -64) + "px " + (p[2] * -64) + "px"
			};
		}

		return style;
	};

	$scope.byHue = function Hue(e){ return e.hls[0]; };
	$scope.byBrightness = function Brightness(e){ return -e.hls[1]; };
	$scope.bySaturation = function Saturation(e){ return e.hls[2]; };
	$scope.byName = function Name(e){ return e.name.toLowerCase(); };
	$scope.byGame = function Game(e){ return e.game.toLowerCase(); };
	$scope.byPrice = function Price(e){ return e.price; };
	$scope.byLength = function Length(e){ return e.name.length; };
	$scope.byRandom = function Random(e){ return e.name.hashCode(); };
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
	};

	$scope.$watch('filterText', function(path) {
		$location.path(path).replace();
	});

	$scope.$watch(function() {
		return $location.path();
	}, function(path) {
		$scope.filterText = path.substring(1);
	});

	$scope.$watch('small', $scope.fixDivSize);

	$scope.fixDivSize = function() {
		var esize = $scope.small ? 28 : 74;
		var emote_count = Math.floor(window.innerWidth / esize) - 1;
		var page_size = Math.ceil(window.innerHeight / esize);

		$scope.divWidth = (emote_count * esize + 10) + "px";
		$scope.itemsPerLine = emote_count;
		$scope.numLines = Math.max(page_size, $scope.numLines);
	};

	window.onscroll = function(){
		if ($scope.numLines * $scope.itemsPerLine > $scope.emotes.length) return;

		var p = window.scrollY + window.innerHeight + 200;
		if (p < document.body.offsetHeight) return;

		var esize = $scope.small ? 28 : 74;
		var page_size = Math.ceil(window.innerHeight / esize);
		$scope.numLines += page_size;
		$scope.$apply();
	};

	window.onload = window.onresize = function() {
		$scope.fixDivSize();
		$scope.$apply();
	};

	if (getCookie("oauth_steamid") !== null) {
		$scope.userLogin(getCookie("oauth_steamid"));
	}
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