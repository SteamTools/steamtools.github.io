/* global kdTree */
/* global RGB_to_HSL */
/* global RGB_to_Lab */


angular.module('mosaticonApp', ['ui.bootstrap', 'cfp.hotkeys'])
.config(['$tooltipProvider', function($tooltipProvider){
    $tooltipProvider.setTriggers({
        'mouseenter': 'mouseleave',
        'click': 'click',
        'focus': 'blur',
        'show': 'mouseleave'
	});
}])
.directive('ngRightClick', function($parse) {
		return function(scope, element, attrs) {
				var fn = $parse(attrs.ngRightClick);
				element.bind('contextmenu', function(event) {
						scope.$apply(function() {
								event.preventDefault();
								fn(scope, {$event:event});
						});
				});
		};
})
.filter('charSum', function() {
	return function(data) {
		if (typeof(data) === 'undefined') {
			return 0;
		}

		var sum = 0;
		for (var i = 0; i < data.length; i++) {
			for (var j = 0; j < data[i].length; j++) {
				if (data[i][j] === undefined) continue;
				sum += data[i][j].name.length + 2;
			}
			sum += 1;
		}

		return sum;
	};
})

.controller('mosaticonCtrl', ['$scope', '$http', '$timeout', '$filter', '$modal', 'hotkeys',
function($scope, $http, $timeout, $filter, $modal, hotkeys){
	$scope.CDN = "http://cdn.steam.tools/emotes/";
	$scope.width = new Size(30);
	$scope.height = new Size(30);
	$scope.status = "";
	$scope.compareMode = "rgb";
	$scope.sortMode = "hue";
	$scope.quality = "1";
	$scope.tool = "pen";
	$scope.q = 1;

	if (localStorage.hasOwnProperty("lastUser")) {
		$scope.UserID = localStorage.lastUser;
	}

	if (window.localStorage !== undefined && !localStorage.feedbackPrompt) {
		$timeout(function(){
			FireEvent("feedback", "show");
			localStorage.feedbackPrompt = true;
		}, 100000);
	}

	$scope.emoticons = [];
	$scope.emoteTree = new kdTree([], dist, Array.range(3));
	$scope.processed = 0;
	$scope.loadEmoticons = function(){
		if (!$scope.UserID || $scope.UserID.trim() === "")
			return;

		var u = $scope.UserID;
		if (u[0] === ":" && u.slice(-1) === ":" && u.length > 2) {
			var emote = {'name': u.slice(1, -1)};
			$scope.emoticons.push(emote);
			emote.nsize = emote.name.length;
			$scope.getEmoticonColor(emote);
			emote.disable = false;
			emote.used = false;

			if ($scope.selectedEmote === undefined) {
				$scope.selectedEmote = emote;
				$scope.selectedEmote.select = true;
			}
		} else {
			$scope.emoticons = [];
			$scope.mosaic = [];
			$scope.processed = 0;
			$scope.fetchEmoticons(u);
		}

	};

	$scope.SERVERS = ['mosaticon', 'mosaticon2', 'mosaticon3', 'mosaticon4'];
	$scope.fetchEmoticons = function(user) {
		$scope.status = "Loading...";
		$scope.orderBy = $filter('orderBy');
		$scope.processedEmotes = false;

		var server = $scope.SERVERS[parseInt(Math.random() * 4)];
		var url = "http://" + server + ".appspot.com/FetchEmotes?id=" + user;
		$http.get(url).success(function(data){
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

			if (!data || data.success === false) {
				$scope.status = data.reason;
			} else {
				localStorage.lastUser = user;
				$scope.status = "Processing...";
				var oldLen = $scope.emoticons.length;
				for (var i = 0; i < data.items.length; i++) {
					$scope.emoticons.push({
						'name': data.items[i],
						'index': i
					});
				}

				for (var j = oldLen; j < $scope.emoticons.length; j++) {
					var emote = $scope.emoticons[j];
					emote.nsize = emote.name.length;
					$scope.getEmoticonColor(emote);
					emote.disable = false;
					emote.used = false;
				}

				if ($scope.emoticons.length === 0) {
					$scope.status = "You have no emoticons.";
				} else if ($scope.selectedEmote === undefined) {
					$scope.selectedEmote = $scope.emoticons[0];
					$scope.selectedEmote.select = true;
				}
			}
		});
	};

	$scope.getEmoticonColor = function(e) {
		var emoteCvs = document.createElement('canvas');
		emoteCvs.width = 18;
		emoteCvs.height = 18;

		var ctx = emoteCvs.getContext("2d");
		var img = document.createElement("img");
		img.crossOrigin = "Anonymous";
		img.onload = function() {
			var step, data, rgb, lab, hsl;
			ctx.drawImage(img, 0, 0);
			for (var i = 1; i <= 3; i++) {
				step = 18 / i;
				e['rgb'+i] = [];
				e['lab'+i] = [];
				e['hsl'+i] = [];
				for (var y = 0; y < i; y++) {
					for (var x = 0; x < i; x++) {
						data = ctx.getImageData(y * step, x * step, step, step);
						rgb = $scope.averageColor(data.data);
						lab = RGB_to_Lab(rgb[0], rgb[1], rgb[2]);
						hsl = RGB_to_HSL(rgb[0], rgb[1], rgb[2]);
						Array.prototype.push.apply(e['rgb'+i], rgb);
						Array.prototype.push.apply(e['lab'+i], lab);
						Array.prototype.push.apply(e['hsl'+i], hsl);
					}
				}
			}
			var obj = e.rgb1.toObject();
			obj.emote = e;
			$scope.emoteTree.insert(obj);
			e.hue = $scope.getHue(e.hsl1);
			$scope.process();
		};
		img.onerror = function() {
			$scope.emoticons.remove(e);
			$scope.process();
		};
		img.src = $scope.CDN + e.name;
	};

	$scope.getHue = function(hsl) {
		var hue = hsl[0];
		var sat = hsl[1];

		if (sat < 0.005)
			hue = 0;

		return hue;
	};

	$scope.processedEmotes = false;
	$scope.process = function() {
		$scope.processed += 1;
		if ($scope.processed >= $scope.emoticons.length) {
			$scope.emoticons = $scope.orderBy($scope.emoticons, 'hue');
			$scope.processedEmotes = true;
			$scope.status = "";
			if (!$scope.imageLoaded) {
				$timeout($scope.displayEmoticons, 0);
			} else {
				$timeout($scope.generateMosaic, 0);
			}
		}
	};

	$scope.displayEmoticons = function() {
		$scope.mosaic = [];
		var line = [];
		for (var i=0; i<$scope.emoticons.length; i++) {
			line.push($scope.emoticons[i]);
		}
		$scope.mosaic.push(line);
	};

	$scope.averageColor = function(colors) {
		var reds = 0, greens = 0, blues = 0, count = 0;
		for (var i = 0; i < colors.length; i+=4) {
			var a = colors[i + 3] / 255;
			reds   += colors[i + 0] * a + 25 * (1 - a);
			greens += colors[i + 1] * a + 25 * (1 - a);
			blues  += colors[i + 2] * a + 25 * (1 - a);
			count += 1;
		}
		var div = count * 255;
		return [reds / div, greens / div, blues / div];
	};

	$scope.imageLoaded = false;
	$scope.handleImage = function handleImage(e){
		var reader = new FileReader();
		reader.onload = function(event){
			var img = new Image();
			img.onload = function(){
				$scope.originalCvs.width = img.width;
				$scope.originalCvs.height = img.height;
				var ctx = $scope.originalCvs.getContext("2d");
				ctx.drawImage(img, 0, 0);
				$scope.imageLoaded = true;
				$scope.blankLoaded = false;
				$timeout($scope.updateUpscale, 0);
			};
			img.src = event.target.result;
		};
		reader.readAsDataURL(e.target.files[0]);
	};

	$scope.updateUpscale = function() {
		if ($scope.blankLoaded)	return;

		var ratio = $scope.originalCvs.height / $scope.originalCvs.width;
		$scope.q = parseInt($scope.quality, 10);
		var width = $scope.width.value * $scope.q;
		$scope.height.value = Math.floor($scope.width.value * ratio);
		var height = $scope.height.value * $scope.q;
		var upscaledHeight = Math.floor(200 * ratio);

		$scope.smallCvs.width = width;
		$scope.smallCvs.height = height;

		var smallCtx = $scope.smallCvs.getContext('2d');
		smallCtx.drawImage($scope.originalCvs, 0, 0, width, height);

		$scope.upscaledCvs.height = upscaledHeight;
		var upscaledCtx = $scope.upscaledCvs.getContext('2d');
		upscaledCtx.mozImageSmoothingEnabled = false;
		upscaledCtx.webkitImageSmoothingEnabled = false;
		upscaledCtx.msImageSmoothingEnabled = false;
		upscaledCtx.imageSmoothingEnabled = false;
		upscaledCtx.drawImage($scope.smallCvs, 0, 0, 200, upscaledHeight);

		$scope.generateMosaic();
	};

	$scope.generateMosaic = function() {
		if ($scope.emoticons.length === 0 || !$scope.imageLoaded) return;

		var q = $scope.q;
		var tree = new kdTree([], dist, Array.range(q * 3));

		var emote, obj;
		for (var j = 0; j < $scope.emoticons.length; j++) {
			emote = $scope.emoticons[j];
			emote.used = false;
			if (!emote.disable) {
				obj = emote[$scope.compareMode + q].toObject();
				obj.emote = emote;
				tree.insert(obj);
			}
		}
		$scope.usedEmotes = [];

		var ctx = $scope.smallCvs.getContext("2d");
		$scope.mosaic = [];
		for (var y=0; y < $scope.smallCvs.height; y+=q) {
			var row = [];
			for (var x=0; x < $scope.smallCvs.width; x+=q) {
				var data = ctx.getImageData(x, y, q, q).data;
				var color = [];
				for (var k = 0; k < data.length; k+=4) {
					var r, g, b, a = data[k + 3] / 255;
					r = (data[k + 0] * a + 25 * (1 - a)) / 255;
					g = (data[k + 1] * a + 25 * (1 - a)) / 255;
					b = (data[k + 2] * a + 25 * (1 - a)) / 255;
					if ($scope.compareMode === "rgb") {
						Array.prototype.push.apply(color, [r, g, b]);
					} else if ($scope.compareMode === "lab") {
						var lab = RGB_to_Lab(r, g, b);
						Array.prototype.push.apply(color, lab);
					} else if ($scope.compareMode === "hsl") {
						var hsl = RGB_to_HSL(r, g, b);
						Array.prototype.push.apply(color, hsl);
					}
				}
				var e = tree.nearest(color, 1)[0][0].emote;
				if (!e.used) {
					e.used = true;
					$scope.usedEmotes.push(e);
				}
				row.push(e);
			}
			$scope.mosaic.push(row);
		}
	};

	$scope.toggleEmote = function(emote) {
		emote.disable = !emote.disable;
		$scope.generateMosaic();
	};

	$scope.selectedEmote = undefined;
	$scope.selectEmote = function(event, emote) {
		if ($scope.selectedEmote !== undefined) {
			$scope.selectedEmote.select = false;
		}

		emote.select = true;
		$scope.selectedEmote = emote;
	};

	$scope.editEmote = function(e, y, x) {
		var e2, e1 = $scope.mosaic[y][x];
		var similar = $scope.emoteTree.nearest(e1.rgb1, 6);
		for (var i = 0; i < similar.length; i++) {
			e2 = similar[i][0].emote;
			if (e1 === e2) continue;
			console.log(e2.name);
		}
	};

	$scope.exportMosaic = function() {
		var result = "";
		for (var y = 0; y < $scope.mosaic.length; y++) {
			for (var x = 0; x < $scope.mosaic[y].length; x++) {
				var e = $scope.mosaic[y][x];
				if (e === undefined) break;
				result += ":" + e.name + ":";
			}
			result += "\n";
		}
		var data = "<pre>" + result + "</pre>";
		// window.open("data:text/html," + encodeURIComponent(data), "_blank");
		var exportWin = window.open("", "ExportWindow");
		exportWin.document.write(data);
	};

	$scope.importMenu = function () {
		$modal.open({
			templateUrl: 'importMenu.html',
			controller: ImportMenuCtrl,
			size: 'lg',
			scope: $scope
		});
	};

	$scope.mouseMove = function(e) {
		if (!$scope.clicking) return;

		var container = document.getElementById("container");
		var mdiv = document.getElementById("mosaic");
		var x = e.pageX - container.offsetLeft - mdiv.offsetLeft - 9;
		var y = e.pageY - container.offsetTop - mdiv.offsetTop - 9;
		var x1 = Math.max(0, Math.min(Math.floor(x/18), $scope.mosaic[0].length - 1));
		var y1 = Math.max(0, Math.min(Math.floor(y/18), $scope.mosaic.length - 1));

		var x2 = Math.floor($scope.startX/18);
		var y2 = Math.floor($scope.startY/18);
		x2 = Math.max(0, Math.min(x2, $scope.mosaic[0].length - 1));
		y2 = Math.max(0, Math.min(y2, $scope.mosaic.length - 1));

		var i, j;
		var dx = Math.abs(x2 - x1);
		var dy = Math.abs(y2 - y1);
		var sx = x1 < x2 ? 1 : -1;
		var sy = y1 < y2 ? 1 : -1;

		if ($scope.tool !== "pen") {
			$scope.mosaic = $scope.mosaicCopy.copy();
		}

		if ($scope.tool === "pen") {
			$scope.mosaic[y1][x1] = $scope.selectedEmote;
		} else if ($scope.tool === "line") {
			var err = dx - dy;

			if (e.shiftKey) {
				if (2 * dx < dy) {
					for (i = Math.min(y1, y2); i < Math.max(y1, y2); i++) {
						$scope.mosaic[i][x2] = $scope.selectedEmote;
					}
				} else if (2 * dy < dx) {
					for (i = Math.min(x1, x2); i < Math.max(x1, x2); i++) {
						$scope.mosaic[y2][i] = $scope.selectedEmote;
					}
				} else {
					var px, py;
					for (i = 0; i < Math.max(dx, dy); i++) {
						py = y2 - i * sy;
						px = x2 - i * sx;
						if (py < 0 || py >= $scope.mosaic.length) continue;
						if (px < 0 || px >= $scope.mosaic[py].length) continue;
						$scope.mosaic[py][px] = $scope.selectedEmote;
					}
				}
			} else {
				while (true) {
					$scope.mosaic[y1][x1] = $scope.selectedEmote;
					if (x1 === x2 && y1 === y2) break;
					var e2 = 2 * err;
					if (e2 > -dy) {
						err -= dy;
						x1 += sx;
					}
					if (e2 < dx) {
						err += dx;
						y1 += sy;
					}
				}
			}
		} else if ($scope.tool === "rect") {
			if (e.shiftKey) {
				var md = Math.max(dx, dy);
				x1 = x2 - md * sx;
				y1 = y2 - md * sy;
			}
			for (j = Math.min(y1, y2); j <= Math.max(y1, y2); j++) {
				if (j < 0 || j >= $scope.mosaic.length) continue;
				for (i = Math.min(x1, x2); i <= Math.max(x1, x2); i++) {
					if (i < 0 || i >= $scope.mosaic[j].length) continue;
					$scope.mosaic[j][i] = $scope.selectedEmote;
				}
			}
		} else if ($scope.tool === "circ") {
			var cx = x2 * 18 + 9;
			var cy = y2 * 18 + 9;
			if (e.altKey) {
				cx = Math.round((x1 + x2) / 2) * 18 + 9;
				cy = Math.round((x1 + x2) / 2) * 18 + 9;
			}
			var rx = Math.pow(x - cx, 2);
			var ry = Math.pow(y - cy, 2);
			if (e.shiftKey) rx = ry = Math.max(rx, ry);
			for (j = 0; j < $scope.mosaic.length; j++) {
				for (i = 0; i < $scope.mosaic[j].length; i++) {
					var d = Math.pow(i * 18 + 9 - cx, 2) / rx;
					d += Math.pow(j * 18 + 9 - cy, 2) / ry;
					if (d < 1) $scope.mosaic[j][i] = $scope.selectedEmote;
				}
			}
		} else if ($scope.tool === "move") {
			var emote1 = $scope.mosaic[y1][x1];
			var emote2 = $scope.mosaic[y2][x2];
			if (!e.shiftKey) $scope.mosaic[y1][x1] = emote2;
			if (!e.altKey) $scope.mosaic[y2][x2] = emote1;
		} else if ($scope.tool === "fill") {
			var target = $scope.mosaic[y1][x1];
			for (j = 0; j < $scope.mosaic.length; j++) {
				for (i = 0; i < $scope.mosaic[j].length; i++) {
					if ($scope.mosaic[j][i] === target) {
						$scope.mosaic[j][i] = $scope.selectedEmote;
					}
				}
			}
		}
	};

	$scope.startX = 0;
	$scope.startY = 0;
	$scope.mouseDown = function(e) {
		$scope.clicking = true;
		$scope.mosaicCopy = $scope.mosaic.copy();

		var container = document.getElementById("container");
		var mdiv = document.getElementById("mosaic");
		$scope.startX = e.pageX - container.offsetLeft - mdiv.offsetLeft - 9;
		$scope.startY = e.pageY - container.offsetTop - mdiv.offsetTop - 9;

		$scope.mouseMove(e);
	};

	$scope.mouseUp = function() {
		$scope.clicking = false;
		$scope.undoHistory.push($scope.mosaicCopy);
		$scope.updateUsed();
	};

	$scope.usedEmotes = [];
	$scope.updateUsed = function() {
		if (!$scope.imageLoaded && !$scope.blankLoaded) return;

		var i, j, emote;

		for (i = 0; i < $scope.usedEmotes.length; i++) {
			$scope.usedEmotes[i].used = false;
		}
		$scope.usedEmotes = [];
		for (j = 0; j < $scope.mosaic.length; j++) {
			for (i = 0; i < $scope.mosaic[j].length; i++) {
				emote = $scope.mosaic[j][i];
				if (emote.used) continue;
				$scope.usedEmotes.push(emote);
				emote.used = true;
			}
		}
	};

	$scope.blankLoaded = false;
	$scope.blankCanvas = function() {
		if ($scope.emoticons.length === 0) return;

		$scope.blankLoaded = true;
		$scope.imageLoaded = false;

		$scope.upscaledCvs.width = $scope.upscaledCvs.width;
		var imageLoader = document.getElementById('imageLoader');
		imageLoader.value = "";

		$scope.mosaic = [];
		var row, i, j;
		for (i = 0; i < $scope.height.value; i++) {
			row = [];
			for (j = 0; j < $scope.width.value; j++) {
				row.push($scope.selectedEmote);
			}
			$scope.mosaic.push(row);
		}

		for (i = 0; i < $scope.usedEmotes.length; i++) {
			$scope.usedEmotes[i].used = false;
		}
		$scope.usedEmotes = [];
		$scope.selectedEmote.used = true;
		$scope.usedEmotes.push($scope.selectedEmote);
	};

	$scope.resizeBlank = function() {
		if ($scope.mosaic === undefined) return;

		var oldHeight = $scope.mosaic.length;
		if (oldHeight === 0) return $scope.blankCanvas();
		var oldWidth = $scope.mosaic[0].length;
		if (oldWidth === 0) return $scope.blankCanvas();

		var newWidth = $scope.width.value;
		var newHeight = $scope.height.value;
		var brush = $scope.selectedEmote;
		var diff, i, j, row;

		if (newWidth > oldWidth) {
			diff = newWidth - oldWidth;
			for (i = 0; i < oldHeight; i++) {
				for (j = 0; j < diff; j++) {
					$scope.mosaic[i].push(brush);
				}
			}
		} else if (newWidth < oldWidth) {
			for (i = 0; i < oldHeight; i++) {
				$scope.mosaic[i].splice(newWidth);
			}
		}

		if (newHeight > oldHeight) {
			diff = newHeight - oldHeight;
			for (i = 0; i < diff; i++) {
				row = [];
				for (j = 0; j < newWidth; j++) {
					row.push(brush);
				}
				$scope.mosaic.push(row);
			}
		} else if (newHeight < oldHeight) {
			$scope.mosaic.splice(newHeight);
		}
	};

	$scope.undoHistory = [];
	$scope.undo = function() {
		if ($scope.undoHistory.length === 0) return;
		$scope.mosaic = $scope.undoHistory.pop();
	};

	$scope.disableAll = function() {
		for (var i = 0; i < $scope.emoticons.length; i++) {
			$scope.emoticons[i].disable = true;
		}
	};

	$scope.enableAll = function() {
		for (var i = 0; i < $scope.emoticons.length; i++) {
			$scope.emoticons[i].disable = false;
		}
	};

	$scope.sortByHue = function() {
		$scope.emoticons = $scope.orderBy($scope.emoticons, 'hue');
		if (!$scope.imageLoaded && !$scope.blankLoaded) {
			$timeout($scope.displayEmoticons, 0);
		}
	};

	$scope.sortByLength = function() {
		$scope.emoticons = $scope.orderBy($scope.emoticons, 'nsize');
		if (!$scope.imageLoaded && !$scope.blankLoaded) {
			$timeout($scope.displayEmoticons, 0);
		}
	};

	$scope.sortByGame = function() {
		$scope.emoticons = $scope.orderBy($scope.emoticons, 'index');
		if (!$scope.imageLoaded && !$scope.blankLoaded) {
			$timeout($scope.displayEmoticons, 0);
		}
	};

	// Hotkeys
	hotkeys.add('ctrl+z', 'Undo', $scope.undo);
	hotkeys.add('q', 'Pen Tool', function(){$scope.tool = "pen";});
	hotkeys.add('w', 'Line Tool', function(){$scope.tool = "line";});
	hotkeys.add('e', 'Rectangle Tool', function(){$scope.tool = "rect";});
	hotkeys.add('a', 'Circle Tool', function(){$scope.tool = "circ";});
	hotkeys.add('s', 'Move Tool', function(){$scope.tool = "move";});
	hotkeys.add('d', 'Bucket Tool', function(){$scope.tool = "fill";});

	$scope.wSliderActive = false;
	$scope.hSliderActive = false;

	var imageLoader = document.getElementById('imageLoader');
	imageLoader.addEventListener('change', $scope.handleImage, false);
	$scope.upscaledCvs = document.getElementById('imageCanvas');
	$scope.originalCvs = document.createElement('canvas');
	$scope.smallCvs = document.createElement('canvas');

	$scope.$watch('compareMode', $scope.generateMosaic);
	$scope.$watch('quality', $scope.updateUpscale);
	$scope.$watch('width.value', function() {
		if ($scope.mosaic === undefined || $scope.mosaic.length === 0) {
			return;
		}
		if (!$scope.wSliderActive || !$scope.imageLoaded) {
			$scope.resizeBlank();
		} else if ($scope.width.value < $scope.mosaic[0].length) {
			for (var i = 0; i < $scope.mosaic.length; i++) {
				$scope.mosaic[i].splice($scope.width.value);
			}
		}

	});
	$scope.$watch('height.value', function() {
		if (!$scope.hSliderActive || !$scope.imageLoaded) {
			$scope.resizeBlank();
		}
	});
}]);

function Size(v) {
	var value = v;

	this.__defineGetter__("value", function () {
		return value;
	});

	this.__defineSetter__("value", function (val) {
		value = parseInt(val, 10);
		value = Math.max(1, Math.min(50, value));
	});
}

Array.prototype.remove = function(obj) {
	this.splice(this.indexOf(obj), 1);
};

Array.prototype.copy = function() {
	var copy = [];
	var row;
	for (var i = 0; i < this.length; i++) {
		row = [];
		for (var j = 0; j < this[i].length; j++) {
			row.push(this[i][j]);
		}
		copy.push(row);
	}
	return copy;
};

Array.prototype.toObject = function(){
	var obj = {};
	for (var i = 0; i < this.length; i++) {
		obj[i] = this[i];
	}
	obj.length = this.length;
	return obj;
};

Array.prototype.max = function(){
	return Math.max.apply(null, this);
};

Array.prototype.min = function(){
	return Math.min.apply(null, this);
};

Array.range = function(start, end) {
	var total = [];
	if (!end) {
		end = start;
		start = 0;
	}

	for (var i = start; i < end; i += 1) {
		total.push(i);
	}

	return total;
};

function dist(a, b){
	var total = 0;
	for (var i = 0; i < a.length; i++) {
		total += Math.pow(a[i] - b[i], 2);
	}
	return total;
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

var ImportMenuCtrl = function($scope, $modalInstance) {
	$scope.data = {text: ""};

	$scope.closeModal = function() {
		$modalInstance.dismiss('close');
	}

	$scope.importMosaic = function() {
		var ms = $scope.$parent;
		var rows = $scope.data.text.split('\n');
		var emoteDict = {};
		var width = 0;
		var i, j;

		for (i = 0; i < ms.emoticons.length; i++) {
			emoteDict[ms.emoticons[i].name] = ms.emoticons[i];
		}

		ms.mosaic = [];
		for (i = 0; i < rows.length; i++) {
			var row = rows[i].trim();
			if (row === "") continue;
			var sep = row.indexOf(":") < 0 ? "ːː" : "::" ;
			var emotes = row.replace(' ', '').slice(1,-1).split(sep);
			var emoteRow = [];
			for (j = 0; j < emotes.length; j++) {
				if (emoteDict.hasOwnProperty(emotes[j]))
					emoteRow.push(emoteDict[emotes[j]]);
				else
					emoteRow.push(ms.selectedEmote);
			}
			width = Math.max(width, emoteRow.length);
			ms.mosaic.push(emoteRow);
		}

		for (i = 0; i < ms.mosaic.length; i++) {
			for (j = 0; j < ms.mosaic[i].length - width; j++) {
				ms.mosaic[i].push(ms.selectedEmote);
			}
		}

		ms.width.value = width;
		ms.height.value = ms.mosaic.length;
		ms.updateUsed();
		ms.blankLoaded = true;
		$modalInstance.dismiss('close');
	};
};