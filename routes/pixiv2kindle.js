const express = require('express');
const csvStringify = require('csv-stringify');

const config = require('../config.json').pixiv2kindle;

const router = express.Router();

router.post('/publish', (req, res, next) => {
    res.set('Content-Type', 'text/csv');

    const stringifier = csvStringify();
    stringifier.pipe(res);

    stringifier.write([JSON.stringify({
        event: 'start',
    })]);

    setTimeout(() => {
        stringifier.write([JSON.stringify({
            event: 'processing',
        })]);

        setTimeout(() => {
            stringifier.write([JSON.stringify({
                event: 'publishing',
            })]);

            setTimeout(() => {
                stringifier.end([JSON.stringify({
                    event: 'end',
                })]);
            }, 1000);
        }, 1000);
    }, 1000)
});

module.exports = router;
