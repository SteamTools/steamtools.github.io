var SteamApp = angular.module('Steam', []);

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
	return function(scope) {
		if (scope.$last){
			var h = $(window).height() - 250;
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
			if (games.length === 0) return;
			var h = $(window).height() - 250;
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
	try {
		users    = JSON.parse(localStorage.users);
		ids      = JSON.parse(localStorage.ids);
		privates = JSON.parse(localStorage.privates);
		if (!Array.isArray(users) || !Array.isArray(ids) || !Array.isArray(privates)) {
			throw new Error('Invalid localStorage format');
		}
	} catch (e) {
		users   = [];
		ids     = [];
		privates= [];
		updateLS();
	}
}

//Preload image
$('<img />').attr('src', 'img/loading.gif');

function updateLS(){
	localStorage.users = JSON.stringify(users);
	localStorage.ids   = JSON.stringify(ids);
	localStorage.privates = JSON.stringify(privates);
}

function SteamCtrl($scope, $http){
	var CFG = window.STEAMTOOLS_CONFIG;
	var GAMES_INFO_URL = CFG.GAMES_API_BASE + '/info';

	for (var u = 0; u < users.length; u++) {
		if (users[u] && users[u].avatar) {
			users[u].avatar = CFG.normalizeSteamAssetUrl(users[u].avatar);
		}
	}

	$scope.gameStatus = 1;
	$scope.gameList = [];
	$scope.fullGameList = [];
	$scope.Users = users.slice();
	$scope.userError = "";

	var url = CFG.CDN_BASE + "/data/game_data.json";
	$http.get(url).success(function(data){
		if (data && typeof data === 'object') {
			var keys = Object.keys(data);
			for (var k = 0; k < keys.length; k++) {
				var entry = data[keys[k]];
				if (entry && typeof entry.name === 'string') {
					entry.name = entry.name.replace(/http:\/\//gi, 'https://');
				}
			}
		}
		$scope.gameData = data;
		if ($scope.fullGameList.length > 0) {
			applyFlags($scope.f, [], $scope);
		}
	});

	function addPrivate(steamid) {
		if (steamid && privates.indexOf(steamid) === -1) {
			privates.push(steamid);
		}
	}

	function removePrivate(steamid) {
		var pIdx = privates.indexOf(steamid);
		if (pIdx !== -1) {
			privates.splice(pIdx, 1);
		}
	}

	function fetchGamesInfo(params) {
		return $http.get(GAMES_INFO_URL, { params: params }).then(function(resp) {
			return resp && resp.data ? resp.data : null;
		});
	}

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
		if (!s.fullGameList || s.fullGameList.length === 0) {
			s.gameList = [];
			return;
		}
		var flags = [];
		for (var k in f)
			if (f.hasOwnProperty(k) && f[k] === 1)
				flags.push(k);

		if (flags.length === 0) {
			s.gameList = s.fullGameList.slice();
			return;
		}
		if (!s.gameData) {
			s.gameList = [];
			return;
		}

		var newList = [];
		for (var i = 0; i < s.fullGameList.length; i++){
			var appid = s.fullGameList[i];
			if (s.gameData.hasOwnProperty(appid)){
				var res = subtract(flags, s.gameData[appid].flags || []);
				if (res.length === 0)
					newList.push(appid);
			}
		}
		s.gameList = newList;
	}

	$scope.addUser = function(){
		if (!$scope.UserID || $scope.UserID.trim() === "")
			return;

		var query = $scope.UserID.trim();
		$scope.UserID = "";
		$scope.userError = "";
		$scope.Users.push( {"name": "Loading","avatar":"img/loading.gif"} );
		fetchGamesInfo({ user: query }).then(function(data) {
			appendUsers(data);
		}, function(err) {
			$scope.Users = users.slice();
			var body = err && err.data;
			var msg = (body && body.reason) ? body.reason : "Failed to load user profile.";
			if (body && body.help === 2) {
				msg += " Try pasting your Steam custom URL or full profile link.";
			}
			$scope.userError = msg;
		});
	};

	$scope.removeUser = function(userid){
		this.destroy(function() {
			var index = ids.indexOf(userid);
			if (index !== -1){
				removePrivate(userid);
				ids.splice(index,1);
				users.splice(index,1);
				$scope.Users = users.slice();
				updateLS();
				index = $scope.selectedUsers.indexOf(userid);
				if (index !== -1)
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
		var dlg = document.getElementById('friendListModal');
		if (dlg && typeof dlg.showModal === 'function' && !dlg.open) {
			dlg.showModal();
		}
		fetchGamesInfo({ friends: userid }).then(function(data) {
			appendFriends(data);
		}, function() {
			$scope.friendStatus = 2;
		});
	};

	$scope.closeFriendsModal = function() {
		var dlg = document.getElementById('friendListModal');
		if (dlg && dlg.open) {
			dlg.close();
		}
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
			if (index !== -1) {
				ids.splice(index,1);
				users.splice(index,1);
			}
			removePrivate(steamid);
		}
		$scope.selectedUsers = [];
		$scope.Users = users.slice();
		updateLS();
	};

	$scope.importGames = function(){
		$scope.gameStatus = 2;
		$scope.userError = "";
		$scope.fullGameList = [];
		$scope.selectedUsers = subtract( $scope.selectedUsers, privates );
		if ($scope.selectedUsers.length === 0) {
			$scope.gameStatus = 1;
			$scope.userError = "No users with public game libraries selected.";
			return;
		}
		for (var i=0; i<$scope.selectedUsers.length ; i++){
			var steamid = $scope.selectedUsers[i];
			if (!steamid || steamid === undefined) return;
			if (!games.hasOwnProperty(steamid)) {
				fetchGamesInfo({ games: steamid }).then(function(data) {
					appendGames(data);
				}, function() {
					$scope.gameStatus = 1;
					$scope.userError = "Failed to load games from server.";
				});
			}
		}
		if (gamesLoaded())
			filterGames();
	};

	$scope.isPrivate = function(userid){
		if (privates.indexOf(userid)!==-1)
			return "private";
	};

	$scope.exportGames = function(){
		var results = [];
		for (var i = 0; i < $scope.gameList.length; i++) {
			var appid = $scope.gameList[i];
			var e = $scope.gameData && $scope.gameData[appid];
			results.push((e && e.name) ? e.name : String(appid));
		}
		results.sort();

		var newPage = window.open("about:blank", "_blank");
		if (newPage && newPage.document) {
			var pre = newPage.document.createElement("pre");
			pre.textContent = results.join("\n");
			newPage.document.body.appendChild(pre);
		}
	};

	$scope.getGameName = function(appid) {
		return ($scope.gameData && $scope.gameData[appid]) ? $scope.gameData[appid].name : String(appid);
	};

	function gamesLoaded(){
		if ($scope.selectedUsers.length === 0) {
			return false;
		}
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
		if (!data) {
			$scope.gameStatus = 1;
			return;
		}
		if (data.hasOwnProperty("private")){
			addPrivate(data.steamid);
			var sIdx = $scope.selectedUsers.indexOf(data.steamid);
			if (sIdx !== -1) {
				$scope.selectedUsers.splice(sIdx, 1);
			}
			updateLS();
			if ($scope.selectedUsers.length === 0) {
				$scope.gameStatus = 1;
				$scope.userError = "Selected profile's game list is private.";
				return;
			}
		}
		else
			games[data.steamid] = data.games;

		if (gamesLoaded())
			filterGames();
	}


	function appendFriends(data){
		if (!data || data.hasOwnProperty("private") || !data.response || !data.response.players){
			$scope.friendStatus = 3;
		}
		else{
			var players = data.response.players;
			for (var i in players){
				if (ids.indexOf(players[i].steamid) === -1){
					var d = {'name':    players[i].personaname,
							'avatar':   CFG.normalizeSteamAssetUrl(players[i].avatarmedium),
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

	function appendUsers(data){
		if (data && data.success !== false && data.response && data.response.players){
			var players = data.response.players;
			for (var i in players){
				if (players.hasOwnProperty(i)){
					if (players[i].communityvisibilitystate !== 3)
						addPrivate(players[i].steamid);
					else
						removePrivate(players[i].steamid);

					if (players[i].steamid === undefined)
						continue;

					if (ids.indexOf(players[i].steamid) === -1){
						var d = {'name':    players[i].personaname,
								'avatar':   CFG.normalizeSteamAssetUrl(players[i].avatarmedium),
								'steamid':  players[i].steamid };
						ids.push(players[i].steamid);
						users.push(d);
					}
				}
			}
		} else {
			$scope.userError = (data && data.reason) ? data.reason : "User not found or unavailable.";
		}
		$scope.Users = users.slice();
		updateLS();
		setTimeout(function() {
			$("[rel=tooltip]").tooltip();
		}, 100);
	}

	function intersect(arr1, arr2) {
		var set2 = new Set(arr2);
		return arr1.filter(function(n) {
			return set2.has(n);
		});
	}

	function subtract(arr1, arr2) {
		var set2 = new Set(arr2);
		return arr1.filter(function(n) {
			return !set2.has(n);
		});
	}
}

$(document).ready(function () {
	if ($("[rel=tooltip]").length) {
		$("[rel=tooltip]").tooltip();
	}
	var friendsDialog = document.getElementById('friendListModal');
	if (friendsDialog) {
		friendsDialog.addEventListener('close', function () {
			friendsDialog.returnValue = '';
		});
		if (!('closedBy' in HTMLDialogElement.prototype)) {
			var downOutside = false;
			var isOutside = function (ev) {
				var rect = friendsDialog.getBoundingClientRect();
				return ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom;
			};
			friendsDialog.addEventListener('pointerdown', function (ev) {
				downOutside = isOutside(ev);
			});
			friendsDialog.addEventListener('pointerup', function (ev) {
				if (!downOutside) return;
				downOutside = false;
				if (isOutside(ev)) {
					friendsDialog.close();
				}
			});
		}
	}
});