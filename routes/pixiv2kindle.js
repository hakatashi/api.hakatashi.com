const express = require('express');
const csvStringify = require('csv-stringify');
const request = require('request');

const config = require('../config.json').pixiv2kindle;
const jar = require('../libs/jar');

const router = express.Router();

const pixivLogin = done => {
    request({
        jar: jar,
        method: 'POST',
        url: 'https://www.pixiv.net/login.php',
        form: {
            mode: 'login',
            pixiv_id: config.pixiv.user,
            pass: config.pixiv.pass,
            skip: 1,
        },
    }, (error, response, body) => {
        if (error) {
            return done(error);
        }

        if (response.statusCode !== 200 && response.statusCode !== 302) {
            return done(new Error(`Status code ${response.statusCode} from login.php`));
        }

        return done();
    });
};

router.post('/publish', (req, res, next) => {
    res.set('Content-Type', 'text/csv');

    const stringifier = csvStringify();
    stringifier.pipe(res);
    const emitEvent = event => {
        stringifier.write([JSON.stringify(event)]);
    }

    emitEvent({event: 'Remote App Started'});

    const cookies = jar.getCookies('http://www.pixiv.net/');
    const isLoggedIn = cookies.find(cookie => cookie.key === 'PHPSESSID') !== undefined;

    setTimeout(() => {
        stringifier.end();
    }, 1000);
});

module.exports = router;
