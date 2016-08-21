const express = require('express');
const router = express.Router();

const request = require('request');

const config = require('../config.json').sos;

router.post('/send', function (req, res, next) {
    if (!req.body) {
        const error = new Error('Empty body');
        error.status = 422;
        return next(error);
    }

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
        res.set('Access-Control-Allow-Origin', 'https://sos.hakatashi.com');
        res.send(JSON.stringify({
            status: 200,
            errors,
        }));
    });
});

module.exports = router;
