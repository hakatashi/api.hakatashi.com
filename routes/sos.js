const express = require('express');
const router = express.Router();

const request = require('request');

const config = require('../config.json').sos;

const ipTable = Object.create(null);

router.post('/send', function (req, res, next) {
    res.set('Access-Control-Allow-Origin', 'https://sos.hakatashi.com');

    if (!req.body) {
        const error = new Error('Empty body');
        error.status = 422;
        return next(error);
    }

    const requestCount = ipTable[req.ip] || 0;
    if (requestCount >= 3) {
        const error = new Error('SOS request is restricted to 3 times per day');
        error.status = 429;
        return next(error);
    }

    ipTable[req.ip] = requestCount + 1;
    setTimeout(() => {
        ipTable[req.ip]--;
    }, 24 * 60 * 60 * 1000);

    const key = req.body.key;
    const text = req.body.text || '';

    if (typeof key !== 'string' || key !== config.key) {
        const error = new Error('Key mismatch');
        error.status = 422;
        return next(error);
    }

    const ifttt = new Promise((resolve, reject) => {
        const url = `https://maker.ifttt.com/trigger/${config.pushbullet.eventName}/with/key/${config.pushbullet.key}`;

        request({
            url,
            method: 'POST',
            json: true,
            body: {
                value1: text,
            },
        }, (error, response, body) => {
            if (error) {
                reject({type: 'ifttt', error});
            } else if (response.statusCode !== 200) {
                reject({type: 'ifttt', error: new Error(`Status code ${response.statusCode} from IFTTT`)});
            } else {
                resolve();
            }
        });
    });

    const errors = Object.create(null);

    Promise.all([ifttt]).catch(({type, error}) => {
        errors[type] = error.message;
    }).then(() => {
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify({
            status: 200,
            errors,
        }));
    });
});

module.exports = router;
