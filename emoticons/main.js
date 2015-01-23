angular
.module('EmoteApp', [])
.controller('EmoteCtrl', ['$scope', '$http', '$location',
function($scope, $http, $location) {
	$scope.BASE_URL = "http://steamcommunity.com/market/listings/";
	$scope.INV_URL = "http://mosaticon.appspot.com/FetchEmotes?id=";
	$scope.emotes = [];
	$scope.numLines = 20;
	$scope.itemsPerLine = 0;

	$http.get('data.json').success(function(data){
		$scope.emotes = data;

		for (var i = 0; i < $scope.emotes.length; i++) {
			$scope.emotes[i].appid = $scope.emotes[i].url.split('-')[0].substr(4);
		}

		$scope.genDates();
	});

	$http.get('../dates.json').success(function(data){
		$scope.dates = data;
		$scope.genDates();
	});

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
				var name = ":" + data.items[i] + ":";
				$scope.owned[name] = true;
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


	$scope.genDates = function(){
		if (!!$scope.dates && !!$scope.emotes){
			for (var i = 0; i < $scope.emotes.length; i++) {
				var utime = $scope.dates[$scope.emotes[i].appid];
				var date = new Date(utime*1000);
				$scope.emotes[i].date = date.toDateString().substr(4);
			}
		}
	};

	$scope.getStyle = function(p){
		var url = "http://cdn.steam.tools/emoticons/" + p[0];
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

	$scope.fixDivSize = function() {
		var esize = $scope.small ? 28 : 74;
		var emote_count = Math.floor(window.innerWidth / esize) - 1;
		var page_size = Math.ceil(window.innerHeight / esize);

		$scope.divWidth = (emote_count * esize + 10) + "px";
		$scope.itemsPerLine = emote_count;
		$scope.numLines = Math.max(page_size, $scope.numLines);
	};

	$scope.byHue = function(e){ return e.hls[0]; };
	$scope.byBrightness = function(e){ return -e.hls[1]; };
	$scope.bySaturation = function(e){ return e.hls[2]; };
	$scope.byName = function(e){ return e.name.toLowerCase(); };
	$scope.byGame = function(e){ return e.game.toLowerCase(); };
	$scope.byPrice = function(e){ return e.price; };
	$scope.byLength = function(e){ return e.name.length; };
	$scope.byRandom = function(e){ return e.name.hashCode(); };
	$scope.byDate = function(e){
		if ($scope.dates && $scope.dates.hasOwnProperty(e.appid))
			return -$scope.dates[e.appid];
		else
			return -9999999999;
	};

	$scope.order = $scope.byDate;
	$scope.rev = false;

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

	$scope.$watch('small', $scope.fixDivSize);

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