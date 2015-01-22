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
