var express = require('express');
var router = express.Router();

var config = require('../config.json').pyoncrypt;

var VOICED = 65536;
var SEMIVOICED = 65537;
var ALTER = 65538;
var ASCIISEQUENCE = 65539;
var UNICODESEQUENCE = 65540;

var deserializationTable = [
    null, 'あ', 'い', 'う', 'え', 'お', 'か', 'き',
    'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ',
    'た', 'ち', 'つ', 'っ', 'て', 'と', 'な', 'に',
    'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ',
    'ま', 'み', 'む', 'め', 'も', 'や', 'ゃ', 'ゆ',
    'ゅ', 'よ', 'ょ', 'ら', 'り', 'る', 'れ', 'ろ',
    'わ', 'を', 'ん', 'ー', '、', '。', '!',  '?',
    '(',  ')',  ' ',  VOICED, SEMIVOICED, ALTER,
    ASCIISEQUENCE, UNICODESEQUENCE,
];

var serializationTable = {};

deserializationTable.forEach(function (char, index) {
    serializationTable[char] = index;
});

var sanitizationTable = {
    'が': [VOICED, 'か'],
    'ぎ': [VOICED, 'き'],
    'ぐ': [VOICED, 'く'],
    'げ': [VOICED, 'け'],
    'ご': [VOICED, 'こ'],
    'ざ': [VOICED, 'さ'],
    'じ': [VOICED, 'し'],
    'ず': [VOICED, 'す'],
    'ぜ': [VOICED, 'せ'],
    'ぞ': [VOICED, 'そ'],
    'だ': [VOICED, 'た'],
    'ぢ': [VOICED, 'ち'],
    'づ': [VOICED, 'つ'],
    'で': [VOICED, 'て'],
    'ど': [VOICED, 'と'],
    'ば': [VOICED, 'は'],
    'び': [VOICED, 'ひ'],
    'ぶ': [VOICED, 'ふ'],
    'べ': [VOICED, 'へ'],
    'ぼ': [VOICED, 'ほ'],
    'ぱ': [SEMIVOICED, 'は'],
    'ぴ': [SEMIVOICED, 'ひ'],
    'ぷ': [SEMIVOICED, 'ふ'],
    'ぺ': [SEMIVOICED, 'へ'],
    'ぽ': [SEMIVOICED, 'ほ'],
    'ぁ': [ALTER, 'あ'],
    'ぃ': [ALTER, 'い'],
    'ぅ': [ALTER, 'う'],
    'ぇ': [ALTER, 'え'],
    'ぉ': [ALTER, 'お'],
    'ゕ': [ALTER, 'か'],
    'ゖ': [ALTER, 'け'],
    'ゎ': [ALTER, 'わ'],
    '…': [ALTER, 'ー'],
    '　': [' '],
    '､':  ['、'],
    '｡':  ['。'],
};

var BitArray = function () {
    this._length = 0;
    this._buffer = new Buffer(0);
};

BitArray.prototype.pushInt = function (number, bit) {
    this._length += bit;

    var appendBufferLength = Math.ceil(this._length / 8) - this._buffer.length;

    this._buffer = Buffer.concat([this._buffer, new Buffer(appendBufferLength).fill(0)]);

    // shift number by offset
    ret = number << ((8 - this._length % 8) % 8);

    // loop to write from lower bits
    for (var ptr = this._buffer.length - 1; ret > 0; ptr--) {
        this._buffer[ptr] += ret & 0xff;
        ret = ret >> 8;
    }

    return this;
};

BitArray.prototype.toBuffer = function () {
    return new Buffer(this._buffer);
};

function serialize(text) {
    var chr = String.fromCharCode;
    var ord = function (char) {
        return char.charCodeAt(0);
    };

    // Katakana to Hiragana
    text = text.replace(/[ァ-ヴ]/g, function (match) {
        return chr(ord(match) - ord('ァ') + ord('ぁ'));
    });

    // HalfWidth to FullWidth
    text = text.replace(/[！-～]/g, function (match) {
        return chr(ord(match) - ord('！') + ord('!'));
    });

    var tokens = [];

    text.split('').forEach(function (char) {
        if (sanitizationTable[char]) {
            tokens = tokens.concat(sanitizationTable[char]);
        } else if (typeof serializationTable[char] !== 'undefined') {
            tokens.push(char);
        }
    });

    var bitArray = new BitArray();

    tokens.forEach(function (token) {
        bitArray.pushInt(serializationTable[token], 6);
    });

    return bitArray.toBuffer();
}

function encrypt(buf) {
    
}

router.post('/encode', function (req, res, next) {
    if (!req.body || !req.body.text) {
        var err = new Error('You must specify text parameter');
        err.status = 422;
        return next(err);
    }

    var text = req.body.text;
    var pass = req.body.pass || config.defaultPass;

    res.send(serialize(text).toJSON());
});

module.exports = router;
