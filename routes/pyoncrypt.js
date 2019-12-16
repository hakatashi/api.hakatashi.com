const crypto = require('crypto');

const express = require('express');

const router = express.Router();

const config = require('../config.json').pyoncrypt;

// String.prototype.startsWith polyfill
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
if (!String.prototype.startsWith) {
	Object.defineProperty(String.prototype, 'startsWith', {
		enumerable: false,
		configurable: false,
		writable: false,
		value(searchString, position) {
			position = position || 0;
			return this.lastIndexOf(searchString, position) === position;
		},
	});
}

// attach the .equals method to Array's prototype to call it on any array
// http://stackoverflow.com/questions/7837456/
equals = function (array1, array2) {
	// if the other array is a falsy value, return
	if (!array2) {
		return false;
	}

	// compare lengths - can save a lot of time
	if (array1.length != array2.length) {
		return false;
	}

	for (let i = 0, l = array1.length; i < l; i++) {
		// Check if we have nested arrays
		if (Array.isArray(array1[i]) && Array.isArray(array2[i])) {
			// recurse into the nested arrays
			if (!equals(array1[i], array2[i])) {
				return false;
			}
		} else if (array1[i] != array2[i]) {
			// Warning - two different object instances will never be equal: {x:20} != {x:20}
			return false;
		}
	}
	return true;
};

const VOICED = 65536;
const SEMIVOICED = 65537;
const ALTER = 65538;
const ASCIISEQUENCE = 65539;
const UNICODESEQUENCE = 65540;

const deserializationTable = [
	null, 'あ', 'い', 'う', 'え', 'お', 'か', 'き',
	'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ',
	'た', 'ち', 'つ', 'っ', 'て', 'と', 'な', 'に',
	'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ',
	'ま', 'み', 'む', 'め', 'も', 'や', 'ゃ', 'ゆ',
	'ゅ', 'よ', 'ょ', 'ら', 'り', 'る', 'れ', 'ろ',
	'わ', 'を', 'ん', 'ー', '、', '。', '!', '?',
	'(', ')', ' ', VOICED, SEMIVOICED, ALTER,
	ASCIISEQUENCE, UNICODESEQUENCE,
];

const serializationTable = {};

deserializationTable.forEach((char, index) => {
	serializationTable[char] = index;
});

const conversionTable = {
	が: [VOICED, 'か'],
	ぎ: [VOICED, 'き'],
	ぐ: [VOICED, 'く'],
	げ: [VOICED, 'け'],
	ご: [VOICED, 'こ'],
	ざ: [VOICED, 'さ'],
	じ: [VOICED, 'し'],
	ず: [VOICED, 'す'],
	ぜ: [VOICED, 'せ'],
	ぞ: [VOICED, 'そ'],
	だ: [VOICED, 'た'],
	ぢ: [VOICED, 'ち'],
	づ: [VOICED, 'つ'],
	で: [VOICED, 'て'],
	ど: [VOICED, 'と'],
	ば: [VOICED, 'は'],
	び: [VOICED, 'ひ'],
	ぶ: [VOICED, 'ふ'],
	べ: [VOICED, 'へ'],
	ぼ: [VOICED, 'ほ'],
	ぱ: [SEMIVOICED, 'は'],
	ぴ: [SEMIVOICED, 'ひ'],
	ぷ: [SEMIVOICED, 'ふ'],
	ぺ: [SEMIVOICED, 'へ'],
	ぽ: [SEMIVOICED, 'ほ'],
	ぁ: [ALTER, 'あ'],
	ぃ: [ALTER, 'い'],
	ぅ: [ALTER, 'う'],
	ぇ: [ALTER, 'え'],
	ぉ: [ALTER, 'お'],
	ゕ: [ALTER, 'か'],
	ゖ: [ALTER, 'け'],
	ゎ: [ALTER, 'わ'],
	'…': [ALTER, 'ー'],
};

const sanitizationTable = {
	'　': [' '],
	'､': ['、'],
	'｡': ['。'],
};

const BitQueue = function () {
	this._length = 0;
	this._buffer = new Buffer(0);
	this._ptr = 0;
};

BitQueue.prototype.pushInt = function (number, bit) {
	this._length += bit;

	const appendBufferLength = Math.ceil(this._length / 8) - this._buffer.length;

	this._buffer = Buffer.concat([this._buffer, new Buffer(appendBufferLength).fill(0)]);

	// shift number by offset
	ret = number << ((8 - this._length % 8) % 8);

	// loop to write from lower bits
	for (let ptr = this._buffer.length - 1; ret > 0; ptr--) {
		this._buffer[ptr] += ret & 0xff;
		ret >>= 8;
	}

	return this;
};

BitQueue.prototype.pushBuffer = function (buf) {
	this._buffer = Buffer.concat([this._buffer, buf]);
	this._length = this._buffer.length * 8;

	return this;
};

BitQueue.prototype.shiftInt = function (bit) {
	const popByte = Math.floor(this._ptr / 8);
	const popByteEnd = Math.ceil((this._ptr + bit) / 8);

	function bitMask(bit) {
		return (1 << bit) - 1;
	}

	let ret = 0;
	let transcriptionPtr = 0;
	for (let ptr = popByte; ptr < popByteEnd; ptr++) {
		const bitStart = Math.max(ptr * 8, Math.min(this._ptr, (ptr + 1) * 8 - 1)) % 8;
		const bitEnd = Math.max(ptr * 8, Math.min(this._ptr + bit - 1, (ptr + 1) * 8 - 1)) % 8;

		const transcription = this._buffer[ptr] >> (7 - bitEnd) & bitMask(bitEnd - bitStart + 1);
		transcriptionPtr += bitEnd - bitStart + 1;
		ret += transcription << (bit - transcriptionPtr);
	}

	this._ptr += bit;
	return ret;
};

BitQueue.prototype.toBuffer = function () {
	return new Buffer(this._buffer);
};

Object.defineProperty(BitQueue.prototype, 'length', {
	get () {
		return this._length - this._ptr;
	},
});

function serialize(text) {
	const chr = String.fromCharCode;
	const ord = function (char) {
		return char.charCodeAt(0);
	};

	// Katakana to Hiragana
	text = text.replace(/[ァ-ヴ]/g, (match) => chr(ord(match) - ord('ァ') + ord('ぁ')));

	// Fullwidth to Halfwidth
	text = text.replace(/[！-～]/g, (match) => chr(ord(match) - ord('！') + ord('!')));

	let tokens = [];

	for (const char of text.split('')) {
		if (conversionTable[char]) {
			tokens = tokens.concat(conversionTable[char]);
		} else if (sanitizationTable[char]) {
			tokens = tokens.concat(sanitizationTable[char]);
		} else if (typeof serializationTable[char] !== 'undefined') {
			tokens.push(char);
		}
	}

	const bitQueue = new BitQueue();

	for (const token of tokens) {
		bitQueue.pushInt(serializationTable[token], 6);
	}

	return bitQueue.toBuffer();
}

function deserialize(buf) {
	const queue = new BitQueue();
	queue.pushBuffer(buf);

	let tokens = [];

	while (queue.length >= 6) {
		const idx = queue.shiftInt(6);
		tokens.push(deserializationTable[idx]);
	}

	let dest = '';

	while (tokens.length > 0) {
		const token = tokens[0];
		if (token === null) {
			tokens.shift();
		} else if (typeof token === 'string') {
			dest += token;
			tokens.shift();
		} else {
			let isConverted = false;

			for (const char in conversionTable) {
				if (conversionTable.hasOwnProperty(char)) {
					const record = conversionTable[char];
					if (equals(tokens.slice(0, record.length), record)) {
						dest += char;
						tokens = tokens.slice(record.length);
						isConverted = true;
						break;
					}
				}
			}

			if (!isConverted) {
				throw new Error('Unknown token');
			}
		}
	}

	return dest;
}

const substitutionTable = [
	151, 135, 82, 190, 127, 177, 76, 137,
	204, 54, 182, 145, 95, 74, 142, 115,
	132, 136, 78, 233, 65, 64, 13, 126,
	144, 44, 219, 6, 27, 214, 117, 87,
	14, 225, 211, 88, 96, 35, 170, 28,
	241, 1, 209, 231, 80, 47, 118, 178,
	100, 98, 229, 67, 91, 129, 186, 85,
	93, 81, 119, 110, 39, 163, 169, 192,
	234, 86, 18, 122, 94, 242, 29, 201,
	109, 152, 253, 212, 83, 133, 56, 4,
	238, 222, 50, 205, 200, 168, 89, 84,
	160, 104, 249, 251, 173, 213, 230, 73,
	102, 239, 20, 37, 196, 218, 68, 108,
	187, 180, 23, 155, 123, 175, 146, 184,
	22, 103, 90, 41, 166, 60, 217, 185,
	0, 63, 226, 34, 176, 246, 139, 30,
	36, 188, 248, 101, 2, 16, 227, 19,
	161, 21, 203, 49, 157, 7, 150, 61,
	210, 15, 52, 114, 181, 58, 111, 221,
	41, 245, 105, 45, 194, 75, 46, 174,
	224, 17, 193, 116, 165, 125, 120, 244,
	197, 121, 9, 240, 71, 228, 243, 140,
	131, 198, 149, 70, 10, 164, 220, 69,
	143, 59, 128, 53, 202, 106, 92, 195,
	183, 235, 215, 112, 147, 252, 179, 130,
	57, 156, 247, 236, 208, 3, 255, 8,
	138, 51, 77, 148, 189, 24, 154, 124,
	113, 199, 250, 107, 38, 162, 31, 216,
	26, 191, 167, 207, 72, 33, 232, 66,
	5, 40, 159, 55, 223, 42, 99, 97,
	11, 134, 43, 48, 206, 12, 79, 237,
	32, 25, 153, 171, 62, 158, 172, 254,
];

const desubstitutionTable = new Array(substitutionTable.length);
substitutionTable.forEach((record, index) => {
	desubstitutionTable[record] = index;
});

const permutationTable = [
	20, 14, 12, 19, 26, 7, 23, 18,
	10, 31, 3, 11, 27, 25, 6, 21,
	16, 17, 13, 9, 29, 28, 15, 22,
	1, 4, 24, 0, 30, 5, 2, 8,
];

function encrypt(buf, key) {
	const keyHash = crypto.createHash('md5').update(key).digest();
	const keys = [
		new Buffer(keyHash.slice(0, 4)),
		new Buffer(keyHash.slice(4, 8)),
		new Buffer(keyHash.slice(8, 12)),
		new Buffer(keyHash.slice(12, 16)),
	];
	const dest = new Buffer(Math.ceil(buf.length / 4) * 4);

	for (let ptr = 0; ptr < buf.length; ptr += 4) {
		const block = new Buffer(4).fill(0);
		buf.copy(block, 0, ptr, ptr + 4);
		encryptBlock(block, keys).copy(dest, ptr);
	}

	return dest;
}

function encryptBlock(buf, keys) {
	buf = xor(buf, keys[0]);
	buf = substitutionPermutation(buf);
	buf = xor(buf, keys[1]);
	buf = substitutionPermutation(buf);
	buf = xor(buf, keys[2]);
	buf = substitutionPermutation(buf);
	buf = xor(buf, keys[3]);

	return buf;
}

function decrypt(buf, key) {
	const keyHash = crypto.createHash('md5').update(key).digest();
	const keys = [
		new Buffer(keyHash.slice(0, 4)),
		new Buffer(keyHash.slice(4, 8)),
		new Buffer(keyHash.slice(8, 12)),
		new Buffer(keyHash.slice(12, 16)),
	];
	const dest = new Buffer(Math.ceil(buf.length / 4) * 4);

	for (let ptr = 0; ptr < buf.length; ptr += 4) {
		const block = new Buffer(4).fill(0);
		buf.copy(block, 0, ptr, ptr + 4);
		decryptBlock(block, keys).copy(dest, ptr);
	}

	return dest;
}

function decryptBlock(buf, keys) {
	buf = xor(buf, keys[3]);
	buf = desubstitutionPermutation(buf);
	buf = xor(buf, keys[2]);
	buf = desubstitutionPermutation(buf);
	buf = xor(buf, keys[1]);
	buf = desubstitutionPermutation(buf);
	buf = xor(buf, keys[0]);

	return buf;
}

function xor(buf1, buf2) {
	const length = Math.min(buf1.length, buf2.length);
	const dest = new Buffer(length).fill(0);

	for (let i = 0; i < length; i++) {
		dest[i] = buf1[i] ^ buf2[i];
	}

	return dest;
}

function substitutionPermutation(buf) {
	for (let i = 0; i < buf.length; i++) {
		buf[i] = substitutionTable[buf[i]];
	}

	const dest = new Buffer(4).fill(0);
	permutationTable.forEach((bitTo, bitFrom) => {
		const byteFrom = Math.floor(bitFrom / 8);
		const byteTo = Math.floor(bitTo / 8);
		const bit = (buf[byteFrom] >> (7 - bitFrom % 8)) & 1;
		dest[byteTo] += bit << (7 - bitTo % 8);
	});

	return dest;
}

function desubstitutionPermutation(buf) {
	const dest = new Buffer(4).fill(0);
	permutationTable.forEach((bitTo, bitFrom) => {
		const byteFrom = Math.floor(bitFrom / 8);
		const byteTo = Math.floor(bitTo / 8);
		const bit = (buf[byteTo] >> (7 - bitTo % 8)) & 1;
		dest[byteFrom] += bit << (7 - bitFrom % 8);
	});

	for (let i = 0; i < dest.length; i++) {
		dest[i] = desubstitutionTable[dest[i]];
	}

	return dest;
}

const pyonTokens = ['ぴょん', 'ぴょ', 'ぴょーん', 'ぴょこ'];
const delimiterTokens = ['、', '。', '! ', '? '];
const finalDelimiterTokens = ['…', '。', '!!!!', '!?'];

function pyonize(buf) {
	let pyonString = '';

	for (let ptr = 0; ptr < buf.length; ptr += 2) {
		const isFinal = (ptr + 2) >= buf.length;
		const block = buf.readUInt16BE(ptr);

		for (let i = 0; i < 7; i++) {
			const number = block >> ((7 - i) * 2) & 0x03;
			pyonString += pyonTokens[number];
		}

		const lastNumber = block & 0x03;
		pyonString += (isFinal ? finalDelimiterTokens : delimiterTokens)[lastNumber];
	}

	return pyonString;
}

function depyonize(pyonString) {
	const dest = new BitQueue();
	let ptr = 0;

	while (pyonString.length > 0) {
		if (finalDelimiterTokens.some((token, index) => {
			if (pyonString === token) {
				dest.pushInt(index, 2);
				pyonString = pyonString.slice(token.length);
				ptr += token.length;
				return true;
			}
			return false;
		})) {
			continue;
		}

		var longestIndex = null,
			longestMatch = null;
		delimiterTokens.forEach((token, index) => {
			if (pyonString.startsWith(token) && (!longestMatch || token.length > longestMatch.length)) {
				longestMatch = token;
				longestIndex = index;
			}
		});

		pyonTokens.forEach((token, index) => {
			if (pyonString.startsWith(token) && (!longestMatch || token.length > longestMatch.length)) {
				longestMatch = token;
				longestIndex = index;
			}
		});

		if (longestMatch) {
			dest.pushInt(longestIndex, 2);
			pyonString = pyonString.slice(longestMatch.length);
			ptr += longestMatch.length;
			continue;
		}

		// if none matches
		throw new Error(`Unknown token at ${ptr}`);
	}

	return dest.toBuffer();
}

router.post('/encode', (req, res, next) => {
	if (!req.body || !req.body.text) {
		const err = new Error('You must specify text parameter');
		err.status = 422;
		return next(err);
	}

	const {text} = req.body;
	const pass = req.body.pass || config.defaultPass;

	const result = pyonize(encrypt(serialize(text), pass));

	res.set('Content-Type', 'application/json');
	res.send(JSON.stringify({
		result,
		text,
	}));
});

router.post('/decode', (req, res, next) => {
	let error = null;
	if (!req.body || !req.body.text) {
		error = new Error('You must specify text parameter');
		error.status = 422;
		return next(error);
	} else if (!req.body.pass) {
		error = new Error('Oh fucking script-kiddie nerds, sad to say that you need `pass` parameter to decrypt text pyonpyon!');
		error.status = 422;
		return next(error);
	}

	const {text} = req.body;
	const {pass} = req.body;

	const result = deserialize(decrypt(depyonize(text), pass));

	res.set('Content-Type', 'application/json');
	res.send(JSON.stringify({
		result,
		text,
	}));
});

module.exports = router;
