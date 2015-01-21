var SteamApp = angular.module('Steam', ['ngResource']);

SteamApp
  .config(function($httpProvider){
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
});

SteamApp.config( function($interpolateProvider){
	$interpolateProvider.startSymbol('[[');
	$interpolateProvider.endSymbol(']]');
});

SteamApp.directive('fadey', function() {
	return {
		restrict: 'A',
		link: function(scope, elm, attrs) {
			var duration = parseInt(attrs.fadey, 10);
			if (isNaN(duration))
				duration = 500;

			elm = jQuery(elm);
			elm.hide();
			elm.fadeIn(duration);

			scope.destroy = function(complete) {
				elm.fadeOut(duration, function() {
					if (complete) complete.apply(scope);
				});
			};
		}
	};
});

SteamApp.directive('adjustSize', function() {
	return function(scope, element, attrs) {
		if (scope.$last){
			var h = $(window).height() - 150;
			$("#game-content").height(h);
		}
	};
});

(function($){
	$(window).load(function(){
		$("#game-content").mCustomScrollbar({
			scrollInertia: 500,
			mouseWheelPixels: 200,
			advanced:{
				updateOnContentResize: true,
				updateOnSelectorChange: 'game-content'
			}
		});
		$(window).resize(function(){
			var games = $('.mCSB_container').children();
			if (games.length == 0) return;
			var h = $(window).height() - 150;
			$("#game-content").height(h);
		});
	});
})(jQuery);



var users, ids, privates;
var games = {};
if (!localStorage.users){
	users   = [];
	ids     = [];
	privates= [];
	updateLS();
}
else{
	users    = JSON.parse(localStorage.users);
	ids      = JSON.parse(localStorage.ids);
	privates = JSON.parse(localStorage.privates);
}

//Preload image
$('<img />').attr('src', 'img/loading.gif');

function updateLS(){
	localStorage.users = JSON.stringify(users);
	localStorage.ids   = JSON.stringify(ids);
	localStorage.privates = JSON.stringify(privates);
}

function SteamCtrl($scope, $resource, $http){
	$scope.gameStatus = 1;
	$scope.gameList = [];
	$scope.fullGameList = [];
	$scope.Users = users.slice();

	var url = "http://storage.googleapis.com/stdownloader.appspot.com/game_data.json";
	$http.get(url).success(function(data){
		$scope.gameData = data;
	});

	$scope.userData = $resource('http://app.ehsankia.com/steam/info',
							{callback:'JSON_CALLBACK'},
							{getData: {method:'JSONP'} });

	$scope.f = {
		"singleplayer":     0,
		"local_coop":       0,
		"coop":             0,
		"multiplayer":      0,
		"controller":       0,
		"mac":              0,
		"linux":            0
	};

	$scope.$watch('f', applyFlags, true);

	function applyFlags(f,o,s){
		if (s.fullGameList.length > 0){
			s.gameList = s.fullGameList;
			var flags = [];
			for (var k in f)
				if (f.hasOwnProperty(k) && f[k]===1)
					flags.push(k);

			var newList = [];
			for (var i=0; i<s.gameList.length; i++){
				if (s.gameData.hasOwnProperty(s.gameList[i])){
					var res = subtract(flags, s.gameData[ s.gameList[i] ].flags );
					if (res.length === 0)
						newList.push( s.gameList[i] );
				}
			}
			s.gameList = newList;
		}
	}

	$scope.addUser = function(){
		if (!$scope.UserID || $scope.UserID.trim() === "")
			return;

		$scope.Users.push( {"name": "Loading","avatar":"img/loading.gif"} );
		$scope.result = $scope.userData.getData({user:$scope.UserID}, appendUsers );
		$scope.UserID = "";
	};

	$scope.removeUser = function(userid){
		this.destroy(function() {
			var index = ids.indexOf(userid);
			if (index !== -1){
				if (privates.indexOf(userid) !== -1)
					privates.splice(privates.indexOf(userid), 1);
				ids.splice(index,1);
				users.splice(index,1);
				$scope.Users = users.slice();
				updateLS();
				index = $scope.selectedUsers.indexOf(userid);
				$scope.selectedUsers.splice(index,1);
			}
		});
	};

	$scope.selectedUsers = [];
	$scope.selectUser = function (steamid){
		var index = $scope.selectedUsers.indexOf(steamid);
		if (index === -1)
			$scope.selectedUsers.push(steamid);
		else
			$scope.selectedUsers.splice(index,1);
	};

	$scope.userSelected = function(steamid){
		if ($scope.selectedUsers.indexOf(steamid)!==-1)
			return "selected";
	};

	$scope.showFriends = function(userid,name){
		$scope.selectedFriends = [];
		$scope.friendStatus = 1;
		$scope.selectedName = name;
		$scope.Friends = [];
		$scope.userData.getData({friends:userid}, appendFriends );
	};

	$scope.selectFriend = function (steamid){
		var index = $scope.selectedFriends.indexOf(steamid);
		if (index === -1)
			$scope.selectedFriends.push(steamid);
		else
			$scope.selectedFriends.splice(index,1);
	};

	$scope.friendSelected = function(steamid){
		if ($scope.selectedFriends.indexOf(steamid)!==-1)
			return "selected";
	};

	$scope.addFriends = function(){
		var remaining = [];
		for (var i=0; i<$scope.Friends.length; i++){
			if ($scope.selectedFriends.indexOf($scope.Friends[i].steamid)!==-1){
				users.push( $scope.Friends[i] );
				ids.push( $scope.Friends[i].steamid );
				$scope.Users = users.slice();
				updateLS();
			}
			else
				remaining.push($scope.Friends[i]);
		}

		$scope.selectedFriends = [];
		$scope.Friends = remaining.slice();
	};

	$scope.deleteUsers = function(){
		for (var i=0; i<$scope.selectedUsers.length; i++){
			var steamid = $scope.selectedUsers[i];
			var index = ids.indexOf(steamid);
			ids.splice(index,1);
			users.splice(index,1);
		}
		$scope.selectedUsers = [];
		$scope.Users = users.slice();
		updateLS();
	};

	$scope.importGames = function(){
		$scope.gameStatus = 2;
		$scope.fullGameList = [];
		$scope.selectedUsers = subtract( $scope.selectedUsers, privates );
		for (var i=0; i<$scope.selectedUsers.length ; i++){
			var steamid = $scope.selectedUsers[i];
			if (!steamid || steamid === undefined) return;
			if (!games.hasOwnProperty(steamid))
				$scope.userData.getData({games:steamid}, appendGames);
		}
		if (gamesLoaded())
			filterGames();
	};

	$scope.isPrivate = function(userid){
		if (privates.indexOf(userid)!==-1)
			return "private";
	};

	$scope.exportGames = function(){
		var result = "";
		for (var i = 0; i < $scope.gameList.length; i++) {
			var appid = $scope.gameList[i];
			var e = $scope.gameData[appid];
			if (e === undefined) break;
			result += e.name + "\n";
		}
		var data = "<pre>" + result + "</pre>";
		window.open("data:text/html," + encodeURIComponent(data), "_blank");
	};

	function gamesLoaded(){
		for (var i=0; i<$scope.selectedUsers.length ; i++){
			var steamid = $scope.selectedUsers[i];
			if (!games.hasOwnProperty(steamid))
				return false;
		}
		$scope.gameStatus = 3;
		return true;
	}

	function filterGames(){
		if ($scope.selectedUsers.length > 0){
			var list = games[ $scope.selectedUsers[0] ];
			for (var i=1; i<$scope.selectedUsers.length ; i++){
				var steamid = $scope.selectedUsers[i];
				list = intersect(list, games[steamid]);
			}
			$scope.fullGameList = list;
			applyFlags($scope.f,[],$scope);
		}
	}

	function appendGames(data){
		if (data.hasOwnProperty("private")){
			privates.push(data.steamid);
			updateLS();
		}
		else
			games[data.steamid] = data.games;

		if (gamesLoaded())
			filterGames();
	}


	function appendFriends(data){
		$scope.selectedUsers = [];
		if (data.hasOwnProperty("private")){
			$scope.friendStatus = 3;
			privates.push( data.steamid );
			updateLS();
		}
		else{
			var players = data.response.players;
			for (var i in players){
				if (ids.indexOf(players[i].steamid) === -1){
					var d = {'name':    players[i].personaname,
							'avatar':   players[i].avatarmedium,
							'steamid':  players[i].steamid };
					$scope.Friends.push(d);
				}
			}
			if ($scope.Friends.length === 0){
				$scope.friendStatus = 2;
			}
			else
				$scope.friendStatus = 0;
		}
	}

	function appendUsers(){
		if ($scope.result.success !== false){
			var players = $scope.result.response.players;
			for (var i in players){
				if (players.hasOwnProperty(i)){
					if (players[i].communityvisibilitystate !== 3)
						privates.push(players[i].steamid);

					if (players[i].steamid === undefined)
						continue;

					if (ids.indexOf(players[i].steamid) === -1){
						var d = {'name':    players[i].personaname,
								'avatar':   players[i].avatarmedium,
								'steamid':  players[i].steamid };
						ids.push(players[i].steamid);
						users.push(d);
					}
				}
			}
		}
		$scope.Users = users.slice();
		updateLS();
		setTimeout(function() {
			$("[rel=tooltip]").tooltip();
		}, 100);
	}

	function intersect(arr1,arr2){
		return arr1.filter(function(n) {
					if(arr2.indexOf(n) === -1)
						return false;
					return true;
				});
	}

	function subtract(arr1,arr2){
	return arr1.filter(function(n) {
				if(arr2.indexOf(n) !== -1)
					return false;
				return true;
			});
	}
}

$(document).ready(function () {
	if ($("[rel=tooltip]").length) {
		$("[rel=tooltip]").tooltip();
	}
});