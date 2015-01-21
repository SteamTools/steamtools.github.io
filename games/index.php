<!DOCTYPE HTML>
<html lang="en-US" ng-app="Steam">
<head>
	<meta charset="UTF-8">
	<meta name="description" content="See the intersection of your Steam games with someone else's, and filter them by categories.">
	<meta name="keywords" content="Steam,games,filter,compare,intersection">
	<meta name="author" content="Ehsan Kia">
	<title>Game Filter</title>

	<script src="//ajax.googleapis.com/ajax/libs/jquery/1.8.0/jquery.min.js"></script>
	<script src="jquery.mCustomScrollbar.concat.min.js"></script>
	<script src="//ajax.googleapis.com/ajax/libs/angularjs/1.0.7/angular.min.js"></script>
	<script src="//ajax.googleapis.com/ajax/libs/angularjs/1.0.7/angular-resource.min.js"></script>
	<script src="http://netdna.bootstrapcdn.com/twitter-bootstrap/2.3.2/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="steam.js"></script>

	<link rel="shortcut icon" href="/favicon.ico">
	<link href="//netdna.bootstrapcdn.com/twitter-bootstrap/2.3.2/css/bootstrap-combined.min.css" rel="stylesheet">
	<link rel="stylesheet" type="text/css" href="jquery.mCustomScrollbar.css" media="all">
	<link rel="stylesheet" type="text/css" href="style.css" media="all">
	<?php include_once("../ga.php") ?>
	<?php include_once("../sc.php") ?>
</head>
<body ng-controller="SteamCtrl">
	<a class="topbutton" style="left: 20px;" href="../">&laquo; Hub</a>
	<a class="topbutton" style="right: 20px;" href="http://steamcommunity.com/id/Ph0X" data-uv-trigger>Feedback</a>

	<script>
	UserVoice=window.UserVoice||[];
	(function(){
		var uv=document.createElement('script');
		uv.type='text/javascript';
		uv.async=true;
		uv.src='//widget.uservoice.com/XTFNtBU14F9kxY4Wh9Wo0A.js';
		var s=document.getElementsByTagName('script')[0];
		s.parentNode.insertBefore(uv,s)
	})();

	// Set colors
	UserVoice.push(['set', {
		accent_color: '#448dd6',
		trigger_color: 'white',
		trigger_background_color: '#448dd6',
		smartvote_enabled: false,
		menu_enabled: false,
		contact_title: "Bugs / Suggestions"
	}]);

	UserVoice.push(['identify', {}]);
	</script>
<!-- 	<div id="help" style="display: none">
		Check out my new Steam Web App: <a target="_blank" href="/steam/itemvalue">Item Value Sorter</a>
		<span style="float: right; margin-right: 10px"><a style="cursor: pointer" onclick="dismiss()"><b>Dismiss</b></a></span>
	</div>
	<script>
		if (localStorage['iv_dismissed'] === undefined){
			document.getElementById("help").style.display = "block";
		}

		function dismiss(){
			document.getElementById("help").style.display = "none";
			localStorage['iv_dismissed'] = true;
		}
	</script>
 -->
	<div id="container">
		<div id="user-selection">
			<a href="#" ng-click="deleteUsers()">
				<i class="left icon-trash icon-white" rel="tooltip" data-placement="left" data-original-title="Remove selected"></i>
			</a>
			<form id="addinput" class="input-prepend input-append form-horizontal">
				<span class="add-on">SteamID</span>
				<input style="width: 250px;" type="text" ng-model="UserID">
				<button class="btn" ng-click="addUser()"><i class="icon-user"></i> Add User</button>
			</form>
			<a href="#">
				<i style="margin-top: -10px" class="right icon-info-sign icon-white" rel="tooltip" data-placement="right"
				data-original-title="This tool allows you to see the intersection of your and your friends' games, and filter them using flags. Red border means profile is private."></i>
			</a>
			<ul>
				<li class="user [[userSelected(user.steamid)]] [[isPrivate(user.steamid)]]" ng-repeat="user in Users" fadey="500" draggable="true" ng-click="selectUser(user.steamid)">
					<a href="#friendListModal" role="button" ng-click="showFriends(user.steamid,user.name)" data-toggle="modal"><i class="left icon-list" rel="tooltip" data-placement="top" data-original-title="Friends list"></i></a>
					<p class="left name">[[user.name]]</p>
					<a href="#" ng-click="removeUser(user.steamid)"><i class="icon-remove" rel="tooltip" data-placement="top" data-original-title="Remove"></i></a>
					<img ng-src="[[user.avatar]]" alt="[[user.name]]'s Avatar" draggable="false"><br>
				</li>
			</ul>
			<form id="importbtn" class="form-horizontal">
				<button  class="btn" ng-click="importGames()" ng-disabled="selectedUsers.length==0">
					<i class="icon-download"></i> Import Games</button>
			</form>
		</div>
		<div id="filter-panel">
			<div id="filter-title">Flags</div>

			<div ng-click="f.singleplayer=0" ng-show="f.singleplayer == 1" class="label label-success"><i class="icon-check"></i> Single-Player</div>
			<div ng-click="f.singleplayer=1" ng-show="f.singleplayer == 0" class="label"><i class="icon-plus-sign"></i> Single-Player</div>

			<div ng-click="f.local_coop=0" ng-show="f.local_coop == 1" class="label label-success"><i class="icon-check"></i>Local Co-op</div>
			<div ng-click="f.local_coop=1" ng-show="f.local_coop == 0" class="label"><i class="icon-plus-sign"></i>Local Co-op</div>

			<div ng-click="f.coop=0" ng-show="f.coop == 1" class="label label-success"><i class="icon-check"></i> Co-op</div>
			<div ng-click="f.coop=1" ng-show="f.coop == 0" class="label"><i class="icon-plus-sign"></i> Co-op</div>

			<div ng-click="f.multiplayer=0" ng-show="f.multiplayer == 1" class="label label-success"><i class="icon-check"></i> Multi-Player</div>
			<div ng-click="f.multiplayer=1" ng-show="f.multiplayer == 0" class="label"><i class="icon-plus-sign"></i> Multi-Player</div>

			<div ng-click="f.controller=0" ng-show="f.controller == 1" class="label label-success"><i class="icon-check"></i> Controller</div>
			<div ng-click="f.controller=1" ng-show="f.controller == 0" class="label"><i class="icon-plus-sign"></i> Controller</div>

			<div ng-click="f.mac=0" ng-show="f.mac == 1" class="label label-success"><i class="icon-check"></i> Mac</div>
			<div ng-click="f.mac=1" ng-show="f.mac == 0" class="label"><i class="icon-plus-sign"></i> Mac</div>

			<div ng-click="f.linux=0" ng-show="f.linux == 1" class="label label-success"><i class="icon-check"></i> Linux</div>
			<div ng-click="f.linux=1" ng-show="f.linux == 0" class="label"><i class="icon-plus-sign"></i> Linux</div>
		</div>
		<div id="game-list">
			<div id="game-title">Filtered Games</div>
			<ng:switch on="!!(gameStatus==1)">
				<div class="game-text" ng:switch-when="true">Add and select at least one user, then import games.</div>
			</ng:switch>
			<ng:switch on="!!(gameStatus==2)">
				<img ng:switch-when="true" src="img/loading2.gif">
			</ng:switch>
			<div id="game-content">
				<a ng-repeat="game in gameList | orderBy:'gameData[game].name'" adjust-size
					ng-href="http://store.steampowered.com/app/[[game]]" target="_blank">
					<div class="game"  draggable="true" ng-bind-html-unsafe="gameData[game].name" scrollbar></div>
				</a>
			</div>
				<button ng-show="gameList.length>0" class="btn btn-inverse" ng-click="exportGames()"
					style="margin: 5px 0 -5px 68px;">Export List</button>
		</div>
	</div>
	<div class="modal hide fade" id="friendListModal" tabindex="-1" role="dialog">
		<div class="modal-header">
			<button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
			<h3 id="myModalLabel">[[selectedName]]'s Friends</h3>
		</div>
		<div class="modal-body nano">
			<ng:switch on="!!(friendStatus==1)">
				<div ng:switch-when="true"> Requesting Friendslist. </div>
			</ng:switch>
			<ng:switch on="!!(friendStatus==2)">
				<div ng:switch-when="true"> No new friends found. </div>
			</ng:switch>
			<ng:switch on="!!(friendStatus==3)">
				<div ng:switch-when="true"> Profile is private. </div>
			</ng:switch>
			<ul>
				<li class="friend [[friendSelected(friend.steamid)]]" ng-repeat="friend in Friends" fadey="500" draggable="true" ng-click="selectFriend(friend.steamid)">
					<p class="left name">[[friend.name]]</p>
					<img ng-src="[[friend.avatar]]" alt="[[friend.name]]'s Avatar" draggable="false">
					<br>
				</li>
			</ul>
		</div>
		<div class="modal-footer">
			<button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
			<button class="btn btn-primary" ng-click="addFriends()" ng-disabled="selectedFriends.length==0">Add Selected</button>
		</div>
	</div>

</body>
</html>