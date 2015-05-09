angular
.module('BGApp', [])
.controller('BGCtrl', ['$scope', '$http', '$location',
function($scope, $http, $location) {
	$scope.MARKET_URL = "http://steamcommunity.com/market/listings/";
	$scope.ECON_URL = "http://cdn.steamcommunity.com/economy/image/";
	$scope.INV_URL = "http://mosaticon.appspot.com/FetchBackgrounds?id=";
	$scope.bg = [];

	$scope.numLines = 20;
	$scope.itemsPerLine = 0;
	$scope.itemsReady = false;

	$http.get('http://cdn.steam.tools/data/bg.json').success(function(data){
		for (var i = 0; i < data.length; i++) {
			data[i].appid = data[i].url.split('-')[0].substr(4);
			data[i].price = data[i].price === null ? Infinity : parseFloat(data[i].price);
		}

		$scope.bg = data;
		$scope.genDates();
	});

	$http.get('http://cdn.steam.tools/data/dates.json').success(function(data){
		$scope.dates = data;
		$scope.genDates();
	});

	$scope.genDates = function(){
		if (!$scope.dates || !$scope.bg) return;

		for (var i = 0; i < $scope.bg.length; i++) {
			var e = $scope.bg[i];
			if ($scope.dates.hasOwnProperty(e.appid)) {
				e.time = $scope.dates[e.appid];
			} else {
				e.time = 9999999999;
			}
		}
	};

	$scope.owned = {};
	$scope.loggedIn = false;
	$scope.user_status = "Login to filter owned items";
	$scope.userLogin = function(steamid64) {
		$scope.loggedIn = false;
		var url = $scope.INV_URL + steamid64 + "&callback=JSON_CALLBACK";
		$http.jsonp(url).success(function(data){
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

	$scope.ownTest = function(item) {
		return !$scope.owned.hasOwnProperty(item.name);
	};

	$scope.userLogout = function() {
		deleteCookie("oauth_steamid");
		$scope.user_status = "Login to filter owned items";
		$scope.loggedIn = false;
		$scope.owned = {};
	};


	$scope.getStyle = function(p){
		var cdn = p[0] >= 82 ? "cdn" : "cdn2";
		var host = "http://" + cdn + ".steam.tools";
		var url = host + "/backgrounds/" + p[0] + ".jpg";
		var style = {
			backgroundImage: "url(" + url + ")",
			backgroundPosition: (p[1] * -256) + "px " + (p[2] * -160) + "px"
		};
		return style;
	};

	$scope.open = function(u, e){
		if (e.target.tagName !== "DIV")
			return;

		var img = document.createElement("img");
		img.src = $scope.ECON_URL + u;
		img.style.position = "fixed";
		img.style.width = parseInt(window.innerWidth * 0.8, 10) + "px";
		img.style.left = parseInt(window.innerWidth * 0.1, 10) + "px";
		img.style.top = "0";
		img.style.opacity = 0;

		var div = document.createElement("div");
		div.style.position = "fixed";
		div.style.width = "100%";
		div.style.height = "100%";
		div.style.top = "0";
		div.style.left = "0";

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

	$scope.byHue = function(e){ return e.hls[0]; };
	$scope.byBrightness = function(e){ return -e.hls[1]; };
	$scope.bySaturation = function(e){ return e.hls[2]; };
	$scope.byName = function(e){ return e.name.toLowerCase(); };
	$scope.byGame = function(e){ return e.game.toLowerCase(); };
	$scope.byPrice = function(e){ return e.price; };
	$scope.byRandom = function(e){ return e.name.hashCode(); };
	$scope.byDate = function(e){ return e.time;	};

	$scope.order = $scope.byDate;
	$scope.rev = true;

	$scope.setOrder = function(orderFun) {
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
		$scope.itemsReady = true;
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
		$scope.userLogin(getCookie("oauth_steamid"));
	}

}]);

window.onload = window.onresize = function() {
	var itemDiv = document.getElementById("items");
	var width = Math.floor(window.innerWidth / 266) * 266 + 10;
	itemDiv.style.width = width + "px";
};

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