(function (root, factory) {
	var api = factory();
	if (typeof module === 'object' && module.exports) {
		module.exports = api;
	}
	if (root) {
		root.RGB_to_HSL = api.RGB_to_HSL;
		root.RGB_to_Lab = api.RGB_to_Lab;
		root.color_dist = api.color_dist;
		root.cie1994 = api.cie1994;
		root.MosaticonColors = api;
	}
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

function RGB_to_HSL(r, g, b) {
	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;

	if (max === min) {
		h = s = 0; // achromatic
	} else {
		var d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = (g - b) / d ; break;
			case g: h = 2 + ( (b - r) / d); break;
			case b: h = 4 + ( (r - g) / d); break;
		}
		h *= 60;
		if (h < 0) {
			h += 360;
		}
	}
	return [h / 360, s, l];
}

function RGB_to_Lab(r, g, b) {
	// RGB to XYZ
	var X, Y, Z;
	if (r > 0.04045) {
		r = Math.pow(((r + 0.055) / 1.055), 2.4);
	}
	else {
		r = r / 12.92;
	}

	if (g > 0.04045) {
		g = Math.pow(((g + 0.055) / 1.055), 2.4);
	}
	else {
		g = g / 12.92;
	}

	if (b > 0.04045) {
		b = Math.pow(((b + 0.055) / 1.055), 2.4);
	}
	else {
		b = b / 12.92;
	}

	r = r * 100;
	g = g * 100;
	b = b * 100;

	X = r * 0.4124 + g * 0.3576 + b * 0.1805;
	Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
	Z = r * 0.0193 + g * 0.1192 + b * 0.9505;

	// XYZ to Lab
	var ref_X =  95.047;
	var ref_Y = 100.000;
	var ref_Z = 108.883;

	var _X = X / ref_X;
	var _Y = Y / ref_Y;
	var _Z = Z / ref_Z;

	if (_X > 0.008856) {
		 _X = Math.pow(_X, (1/3));
	}
	else {
		_X = (7.787 * _X) + (16 / 116);
	}

	if (_Y > 0.008856) {
		_Y = Math.pow(_Y, (1/3));
	}
	else {
	  _Y = (7.787 * _Y) + (16 / 116);
	}

	if (_Z > 0.008856) {
		_Z = Math.pow(_Z, (1/3));
	}
	else {
		_Z = (7.787 * _Z) + (16 / 116);
	}

	var CIE_L = (116 * _Y) - 16;
	var CIE_a = 500 * (_X - _Y);
	var CIE_b = 200 * (_Y - _Z);

	return [CIE_L / 100, CIE_a / 100, CIE_b / 100];
}

function color_dist(c1, c2) {
	var d1 = c1[0] - c2[0];
	var d2 = c1[1] - c2[1];
	var d3 = c1[2] - c2[2];
	return d1 * d1 + d2 * d2 + d3 * d3;
}

function cie1994(l1, l2, isTextile) {
	var kh = 1, kc = 1;
	var k1, k2, kl;
	if (isTextile) {
		k1 = 0.048;
		k2 = 0.014;
		kl = 2;
	} else {
		k1 = 0.045;
		k2 = 0.015;
		kl = 1;
	}

	var c1 = Math.sqrt(l1[1] * l1[1] + l1[2] * l1[2]);
	var c2 = Math.sqrt(l2[1] * l2[1] + l2[2] * l2[2]);

	var sh = 1 + k2 * c1;
	var sc = 1 + k1 * c1;
	var sl = 1;

	var da = l1[1] - l2[1];
	var db = l1[2] - l2[2];
	var dc = c1 - c2;

	var dl = l1[0] - l2[0];
	var dh = Math.sqrt(da * da + db * db - dc * dc);

	return Math.pow((dl/(kl * sl)), 2) + Math.pow((dc/(kc * sc)), 2) + Math.pow((dh/(kh * sh)), 2);
}

function decodeBase64ToBytes(b64) {
	if (typeof b64 !== 'string' || !b64) return null;
	try {
		if (typeof Buffer === 'function') {
			var buf = Buffer.from(b64, 'base64');
			if (!buf || buf.length !== 42) return null;
			var outBuf = new Array(42);
			for (var i = 0; i < 42; i++) {
				outBuf[i] = buf[i];
			}
			return outBuf;
		}
		if (typeof atob === 'function') {
			var bin = atob(b64);
			if (!bin || bin.length !== 42) return null;
			var outBin = new Array(42);
			for (var j = 0; j < 42; j++) {
				outBin[j] = bin.charCodeAt(j) & 0xff;
			}
			return outBin;
		}
	} catch (e) {
		return null;
	}
	return null;
}

function encodeBytesToBase64(bytes) {
	if (!bytes || bytes.length !== 42) {
		throw new Error('Emote color vector must be exactly 42 bytes');
	}
	if (typeof Buffer === 'function') {
		return Buffer.from(bytes).toString('base64');
	}
	if (typeof btoa === 'function') {
		var str = '';
		for (var i = 0; i < bytes.length; i++) {
			str += String.fromCharCode(bytes[i] & 0xff);
		}
		return btoa(str);
	}
	throw new Error('Base64 encoding unavailable');
}

/**
 * Compute integer half-up composited block average [rByte, gByte, bByte] from RGBA pixel buffer.
 * Composite background matches legacy #191919 (25, 25, 25).
 * Matches Python compute_emote_color_b64 byte-for-byte:
 *   per pixel: round((c * a + 25 * (255 - a)) / 255)
 *   per block: (2 * sum + n) // (2 * n)
 */
function extractBlockByteRgbFromRgba(rgbaPixels) {
	var rSum = 0;
	var gSum = 0;
	var bSum = 0;
	var n = rgbaPixels.length / 4;
	if (!n) return [25, 25, 25];
	for (var p = 0; p < rgbaPixels.length; p += 4) {
		var a = rgbaPixels[p + 3];
		var invA = 255 - a;
		rSum += Math.round((rgbaPixels[p + 0] * a + 25 * invA) / 255);
		gSum += Math.round((rgbaPixels[p + 1] * a + 25 * invA) / 255);
		bSum += Math.round((rgbaPixels[p + 2] * a + 25 * invA) / 255);
	}
	return [
		Math.floor((2 * rSum + n) / (2 * n)),
		Math.floor((2 * gSum + n) / (2 * n)),
		Math.floor((2 * bSum + n) / (2 * n))
	];
}

function extractEmoteColorBytesFromRgba(rgbaPixels, width, height) {
	var w = width || 18;
	var h = height || 18;
	var bytes = [];
	for (var grid = 1; grid <= 3; grid++) {
		var stepX = Math.floor(w / grid);
		var stepY = Math.floor(h / grid);
		var n = stepX * stepY;
		for (var gy = 0; gy < grid; gy++) {
			for (var gx = 0; gx < grid; gx++) {
				var rSum = 0;
				var gSum = 0;
				var bSum = 0;
				var yStart = gy * stepY;
				var xStart = gx * stepX;
				for (var py = yStart; py < yStart + stepY; py++) {
					for (var px = xStart; px < xStart + stepX; px++) {
						var idx = (py * w + px) * 4;
						var a = rgbaPixels[idx + 3];
						var invA = 255 - a;
						rSum += Math.round((rgbaPixels[idx + 0] * a + 25 * invA) / 255);
						gSum += Math.round((rgbaPixels[idx + 1] * a + 25 * invA) / 255);
						bSum += Math.round((rgbaPixels[idx + 2] * a + 25 * invA) / 255);
					}
				}
				bytes.push(
					Math.floor((2 * rSum + n) / (2 * n)),
					Math.floor((2 * gSum + n) / (2 * n)),
					Math.floor((2 * bSum + n) / (2 * n))
				);
			}
		}
	}
	return bytes;
}

function encodeEmoteColorB64FromRgba(rgbaPixels, width, height) {
	return encodeBytesToBase64(extractEmoteColorBytesFromRgba(rgbaPixels, width, height));
}

/**
 * Convert 42 quantized bytes (3B rgb1 + 12B rgb2 + 27B rgb3) into normalized [0..1] plain JS Arrays
 * and derived Lab/HSL vectors + hue matching legacy mosaticon kdTree expectations.
 */
function decodeEmoteColorBytes(bytes) {
	if (!bytes || bytes.length !== 42) return null;

	function sliceNormalized(start, count) {
		var rgb = [];
		var lab = [];
		var hsl = [];
		for (var i = 0; i < count; i += 3) {
			var r = (bytes[start + i + 0] & 0xff) / 255;
			var g = (bytes[start + i + 1] & 0xff) / 255;
			var b = (bytes[start + i + 2] & 0xff) / 255;
			rgb.push(r, g, b);
			var labTriplet = RGB_to_Lab(r, g, b);
			var hslTriplet = RGB_to_HSL(r, g, b);
			lab.push(labTriplet[0], labTriplet[1], labTriplet[2]);
			hsl.push(hslTriplet[0], hslTriplet[1], hslTriplet[2]);
		}
		return { rgb: rgb, lab: lab, hsl: hsl };
	}

	var b1 = sliceNormalized(0, 3);
	var b2 = sliceNormalized(3, 12);
	var b3 = sliceNormalized(15, 27);
	var hue = b1.hsl[1] < 0.005 ? 0 : b1.hsl[0];

	return {
		rgb1: b1.rgb,
		lab1: b1.lab,
		hsl1: b1.hsl,
		rgb2: b2.rgb,
		lab2: b2.lab,
		hsl2: b2.hsl,
		rgb3: b3.rgb,
		lab3: b3.lab,
		hsl3: b3.hsl,
		hue: hue
	};
}

function decodeEmoteColorB64(b64) {
	var bytes = decodeBase64ToBytes(b64);
	if (!bytes) return null;
	return decodeEmoteColorBytes(bytes);
}

return {
	RGB_to_HSL: RGB_to_HSL,
	RGB_to_Lab: RGB_to_Lab,
	color_dist: color_dist,
	cie1994: cie1994,
	decodeBase64ToBytes: decodeBase64ToBytes,
	encodeBytesToBase64: encodeBytesToBase64,
	extractBlockByteRgbFromRgba: extractBlockByteRgbFromRgba,
	extractEmoteColorBytesFromRgba: extractEmoteColorBytesFromRgba,
	encodeEmoteColorB64FromRgba: encodeEmoteColorB64FromRgba,
	decodeEmoteColorBytes: decodeEmoteColorBytes,
	decodeEmoteColorB64: decodeEmoteColorB64
};

});
