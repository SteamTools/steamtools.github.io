angular.module('BGApp', ['ui-rangeSlider'])
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
			}

			if (newMin <= data && data <= newMax)
				newList.push(input[i]);
		}
		return newList;
	};
})
.controller('BGCtrl', ['$scope', '$http', '$location',
function($scope, $http, $location) {
	$scope.BASE_URL = "https://steamcommunity.com/market/listings/";
	$scope.ECON_URL = "https://steamcommunity-a.akamaihd.net/economy/image/";
	$scope.SERVERS = ['mosaticon', 'mosaticon2', 'mosaticon3', 'mosaticon4'];
	$scope.bg = [];
	$scope.numLines = 20;
	$scope.itemsPerLine = 0;

	$scope.limits = {
		min: 0,
		max: 100,
		type: 'Date',
		dateRange: (Date.now()/1000) - 1368590400,
		maxPrice: 400,
	};


	$http.get('https://cdn.steam.tools/data/bg.json').success(function(data){
		var maxPrice = 0;
		for (var i = 0; i < data.length; i++) {
			data[i].appid = data[i].url.split('-')[0].substr(4);
			data[i].price = data[i].price === null ? Infinity : parseFloat(data[i].price);
			if (data[i].price < 1000 && data[i].price > maxPrice)
				maxPrice = data[i].price;
		}

		$scope.limits.maxPrice = maxPrice;
		$scope.bg = data;
		$scope.genDates();
	});

	$http.get('https://cdn.steam.tools/data/dates.json').success(function(data){
		$scope.dates = data;
		$scope.genDates();
	});

	$scope.owned = {};
	$scope.loggedIn = false;
	$scope.user_status = "Login to filter owned items";
	$scope.userLogin = function(steamid64) {
		$scope.loggedIn = false;
		var server = $scope.SERVERS[parseInt(Math.random() * 4)];
		var url = "https://" + server + ".appspot.com/FetchBackgrounds?id=" + steamid64;
		$http.get(url).success(function(data){
			if (!data.success) {
				$scope.user_status = data.reason;
				return;
			}

			$scope.owned = {};
			$scope.loggedIn = true;
			$scope.user_status = data.items.length + " items filtered";
			for (var i = 0; i < data.items.length; i++) {
				$scope.owned[data.items[i]] = true;
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
		var cdn = p[0] > 287 ? "cdn" : "cdn2";
		var host = "https://" + cdn + ".steam.tools";
		var url = host + "/backgrounds/" + p[0] + ".jpg?v2";
		var style = {
			backgroundImage: "url(" + url + ")",
			backgroundPosition: (p[1] * -256) + "px " + (p[2] * -160) + "px"
		};
		return style;
	};

	$scope.load = function(b, e) {
		if (e.target.tagName !== "DIV")
			return;

		var url = "https://mosaticon3.appspot.com/FetchBackgroundImage?url=" + btoa(b.url);
		$http.get(url).success(function(data){
			$scope.open(data)
		}).error(function(){
			console.log('Failed to load image for: ', b);
		});
	};

	$scope.open = function(u){
		var img = document.createElement("img");
		img.src = $scope.ECON_URL + u;
		img.style.position = "fixed";
		img.style.width = parseInt(window.innerWidth * 0.8, 10) + "px";
		img.style.left = parseInt(window.innerWidth * 0.1, 10) + "px";
		img.style.top = "0";
		img.style.opacity = 0;
		img.style.z = 0;
		img.style.zIndex = 999;

		var div = document.createElement("div");
		div.style.position = "fixed";
		div.style.width = "100%";
		div.style.height = "100%";
		div.style.top = "0";
		div.style.left = "0";
		div.style.zIndex = 998;

		img.onload = function(){
			this.style.top = (window.innerHeight - this.height)/2 + "px";
			img.style.opacity = 1;
		};

		div.onclick = img.onclick = function(){
			document.body.removeChild(div);
			document.body.removeChild(img);
		};

		document.body.appendChild(div);
		document.body.appendChild(img);
	};

	$scope.byHue = function Hue(e){ return e.hls ? e.hls[0] : 0; };
	$scope.byBrightness = function Brightness(e){ return e.hls ? -e.hls[1] : 0; };
	$scope.bySaturation = function Saturation(e){ return e.hls ? e.hls[2] : 0; };
	$scope.byName = function Name(e){ return e.name.toLowerCase(); };
	$scope.byGame = function Game(e){ return e.game.toLowerCase(); };
	$scope.byPrice = function Price(e){ return e.price; };
	$scope.byRandom = function Random(e){ return e.name.hashCode(); };
	$scope.byDate = function Date(e){ return e.time;	};

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

	$scope.updateCount = function(){
		var numItem = document.getElementById('numItem');
		var items = document.getElementsByClassName("bg");
		numItem.innerHTML = "<b>Number of items:</b> " + items.length;
		return false;
	};

	$scope.fixDivSize = function() {
		var bg_count = Math.floor(window.innerWidth / 256) - 1;
		var page_size = Math.ceil(window.innerHeight / 256);

		$scope.divWidth = (bg_count * (256 + 10) + 10) + "px";
		$scope.itemsPerLine = bg_count;
		$scope.numLines = Math.max(page_size, $scope.numLines);
	};

	window.onscroll = function(){
		if ($scope.numLines * $scope.itemsPerLine > $scope.bg.length) return;

		var p = window.scrollY + window.innerHeight + 200;
		if (p < document.body.offsetHeight) return;

		var page_size = Math.ceil(window.innerHeight / 256);
		$scope.numLines += page_size;
		$scope.$apply();
	};

	window.onload = window.onresize = function() {
		$scope.fixDivSize();
		$scope.$apply();
	};

	if (getCookie("oauth_steamid") !== null) {
		const oauth = unescape(getCookie("oauth_steamid"))
		const steamid64 = oauth.split('/id/')[1].replace('"', '');
		console.log(oauth, steamid64);
		$scope.userLogin(steamid64);
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
