const express = require('express');
const router = express.Router();

const config = require('../config.json').pixiv2kindle;

router.post('/publish', function (req, res, next) {
    res.set('Content-Type', 'text/csv');
    res.end('"hoge","hoge"');
});

module.exports = router;
