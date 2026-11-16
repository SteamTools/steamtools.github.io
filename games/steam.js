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
	$scope.steamLoginUrl = CFG.getLoginUrl();
	$scope.loggedIn = false;
	$scope.gameSearch = '';

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

	$scope.gameData = {};
	var _gameBucketPromises = Object.create(null);
	var _loadedGameBuckets = Object.create(null);
	var _monolithGameDataPromise = null;

	function normalizeGameName(name) {
		return typeof name === 'string' ? name.replace(/http:\/\//gi, 'https://') : '';
	}

	function mergeGameDataMonolith(data) {
		if (!data || typeof data !== 'object') return;
		var keys = Object.keys(data);
		for (var k = 0; k < keys.length; k++) {
			var aid = keys[k];
			var entry = data[aid];
			if (entry && typeof entry === 'object') {
				$scope.gameData[aid] = {
					name: normalizeGameName(entry.name),
					flags: Array.isArray(entry.flags) ? entry.flags : []
				};
			}
		}
	}

	function decodeGameDataShard(shardDoc) {
		if (!shardDoc || shardDoc.v !== 2 || !Array.isArray(shardDoc.flags) || !shardDoc.apps || typeof shardDoc.apps !== 'object') {
			return false;
		}
		var flagTable = shardDoc.flags;
		var apps = shardDoc.apps;
		var appKeys = Object.keys(apps);
		for (var i = 0; i < appKeys.length; i++) {
			var aid = appKeys[i];
			var rec = apps[aid];
			if (!Array.isArray(rec)) continue;
			var mask = Number(rec[1]) || 0;
			var flags = [];
			for (var bit = 0; bit < flagTable.length; bit++) {
				if ((mask & (1 << bit)) !== 0) {
					flags.push(flagTable[bit]);
				}
			}
			if (Array.isArray(rec[2])) {
				for (var ex = 0; ex < rec[2].length; ex++) {
					flags.push(String(rec[2][ex]));
				}
			}
			$scope.gameData[aid] = {
				name: normalizeGameName(rec[0]),
				flags: flags
			};
		}
		return true;
	}

	function loadGameDataMonolith() {
		if (_monolithGameDataPromise) return _monolithGameDataPromise;
		_monolithGameDataPromise = CFG.getDatasetJson($http, 'data/game_data.json').then(function(data) {
			safeApply(function() {
				mergeGameDataMonolith(data);
				if ($scope.fullGameList.length > 0) {
					applyFlags($scope.f, [], $scope);
				}
			});
		}, function() {});
		return _monolithGameDataPromise;
	}

	function gameDataShardHex(appid) {
		var n = parseInt(String(appid || '').trim(), 10);
		if (isNaN(n)) return '00';
		var b = (n & 0x3F).toString(16);
		return b.length < 2 ? ('0' + b) : b;
	}

	function ensureGameDataForAppids(appids) {
		if (!Array.isArray(appids) || appids.length === 0) return Promise.resolve();
		if (_monolithGameDataPromise) return _monolithGameDataPromise;

		var missingBuckets = [];
		var seenBucket = Object.create(null);
		for (var i = 0; i < appids.length; i++) {
			var aid = String(appids[i]);
			if ($scope.gameData.hasOwnProperty(aid)) continue;
			var hex2 = gameDataShardHex(aid);
			if (!_loadedGameBuckets[hex2] && !seenBucket[hex2]) {
				seenBucket[hex2] = true;
				missingBuckets.push(hex2);
			}
		}
		if (missingBuckets.length === 0) return Promise.resolve();
		if (missingBuckets.length > 24) {
			return loadGameDataMonolith();
		}

		var idx = 0;
		var cap = Math.min(8, missingBuckets.length);
		var shardFailed = false;
		function worker() {
			if (idx >= missingBuckets.length) return Promise.resolve();
			var hex2 = missingBuckets[idx++];
			if (!_gameBucketPromises[hex2]) {
				_gameBucketPromises[hex2] = CFG.getDatasetJson($http, 'data/game_data/' + hex2 + '.json')
					.then(function(doc) {
						if (!decodeGameDataShard(doc)) {
							shardFailed = true;
							return;
						}
						_loadedGameBuckets[hex2] = true;
					}, function() {
						shardFailed = true;
					});
			}
			return _gameBucketPromises[hex2].then(worker);
		}
		var workers = [];
		for (var w = 0; w < cap; w++) {
			workers.push(worker());
		}
		return Promise.all(workers).then(function() {
			if (shardFailed) {
				return loadGameDataMonolith();
			}
			safeApply(function() {
				if ($scope.fullGameList.length > 0) {
					applyFlags($scope.f, [], $scope);
				}
			});
		});
	}

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

	function safeApply(fn) {
		if (!$scope.$$phase) {
			$scope.$apply(fn);
		} else {
			fn();
		}
	}

	function fetchGamesInfo(params) {
		var reqPromise = typeof CFG.httpRequestWithFailover === 'function'
			? CFG.httpRequestWithFailover($http, '/info', { method: 'GET', params: params }, { preferredBase: CFG.GAMES_API_BASE })
			: $http.get(GAMES_INFO_URL, { params: params });
		return reqPromise.then(function(resp) {
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
		"linux":            0,
		"stc":              0,
		"achievements":     0,
		"workshop":         0,
		"free2play":        0
	};

	$scope.$watch('f', applyFlags, true);
	$scope.$watch('gameSearch', function() { applyFlags($scope.f, [], $scope); });

	function applyFlags(f,o,s){
		if (!s.fullGameList || s.fullGameList.length === 0) {
			s.gameList = [];
			return;
		}
		var flags = [];
		for (var k in f)
			if (f.hasOwnProperty(k) && f[k] === 1)
				flags.push(k);

		var q = String(s.gameSearch || '').trim().toLowerCase();
		if (flags.length === 0 && !q) {
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
				var entry = s.gameData[appid];
				if (q) {
					var gname = String((entry && entry.name) || appid).toLowerCase();
					if (gname.indexOf(q) === -1) continue;
				}
				if (flags.length > 0) {
					var res = subtract(flags, (entry && entry.flags) || []);
					if (res.length !== 0) continue;
				}
				newList.push(appid);
			}
		}
		s.gameList = newList;
	}

	$scope.userLogout = function() {
		CFG.performLogout($http);
		$scope.loggedIn = false;
	};

	$scope.addUser = function(){
		if (!$scope.UserID || $scope.UserID.trim() === "")
			return;

		var query = $scope.UserID.trim();
		$scope.UserID = "";
		$scope.userError = "";
		$scope.Users.push( {"name": "Loading","avatar":"img/loading.gif"} );
		fetchGamesInfo({ user: query }).then(function(data) {
			safeApply(function() {
				appendUsers(data);
			});
		}, function(err) {
			safeApply(function() {
				$scope.Users = users.slice();
				var body = err && err.data;
				var msg = (body && body.reason) ? body.reason : "Failed to load user profile.";
				if (body && body.help === 2) {
					msg += " Try pasting your Steam custom URL or full profile link.";
				}
				$scope.userError = msg;
			});
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
			dlg._prevFocus = document.activeElement;
			dlg.showModal();
		}
		fetchGamesInfo({ friends: userid }).then(function(data) {
			safeApply(function() {
				appendFriends(data);
			});
		}, function() {
			safeApply(function() {
				$scope.friendStatus = 2;
			});
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
					safeApply(function() {
						appendGames(data);
					});
				}, function() {
					safeApply(function() {
						$scope.gameStatus = 1;
						$scope.userError = "Failed to load games from server.";
					});
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

		if (typeof CFG.openTextExportDialog === 'function') {
			CFG.openTextExportDialog({
				title: 'Export Filtered Games (' + results.length + ')',
				label: 'Matching Steam games (one per line)',
				text: results.join("\n"),
				filename: 'steam-games.txt'
			});
		}
	};

	$scope.getGameName = function(appid) {
		var e = $scope.gameData && $scope.gameData[appid];
		return (e && e.name) ? e.name : ('App ' + String(appid));
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
			ensureGameDataForAppids(list);
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

	CFG.checkAuthSession($http).then(function(auth) {
		if (!auth || !auth.authenticated || !auth.steamid) return;
		var applyAuth = function() {
			$scope.loggedIn = true;
			if (ids.indexOf(auth.steamid) === -1) {
				fetchGamesInfo({ user: auth.steamid }).then(function(data) {
					safeApply(function() {
						appendUsers(data);
						if ($scope.selectedUsers.indexOf(auth.steamid) === -1 && ids.indexOf(auth.steamid) !== -1) {
							$scope.selectedUsers.push(auth.steamid);
						}
					});
				});
			}
		};
		if (!$scope.$$phase) {
			$scope.$apply(applyAuth);
		} else {
			applyAuth();
		}
	});
}

$(document).ready(function () {
	if ($("[rel=tooltip]").length) {
		$("[rel=tooltip]").tooltip();
	}
	var friendsDialog = document.getElementById('friendListModal');
	if (friendsDialog) {
		friendsDialog.addEventListener('close', function () {
			friendsDialog.returnValue = '';
			var prev = friendsDialog._prevFocus;
			friendsDialog._prevFocus = null;
			if (prev && typeof prev.focus === 'function') {
				try { prev.focus(); } catch (e) {}
			}
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