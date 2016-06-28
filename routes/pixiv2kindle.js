const express = require('express');
const csvStringify = require('csv-stringify');
const request = require('request');
const cheerio = require('cheerio');
const entities = require('entities');
const fs = require('fs');

const config = require('../config.json').pixiv2kindle;
const jar = require('../libs/jar');
const Pixiv2Epub = require('../libs/pixiv2epub');

const router = express.Router();

const pixivLogin = done => {
    request({
        jar,
        method: 'GET',
        url: 'https://accounts.pixiv.net/login',
    }, (error, response, body) => {
        if (error) {
            return done(error);
        }

        if (response.statusCode !== 200) {
            return done(new Error(`Status code ${response.statusCode} from login`));
        }

        const $ = cheerio.load(body);
        const key = $('input[name=post_key]').attr('value');

        request({
            jar,
            method: 'POST',
            url: 'https://accounts.pixiv.net/api/login?lang=ja',
            form: {
                pixiv_id: config.pixiv.user,
                password: config.pixiv.pass,
                captcha: '',
                g_recaptcha_response: '',
                post_key: key,
                source: 'accounts',
            },
        }, (error, response, body) => {
            if (error) {
                return done(error);
            }

            if (response.statusCode !== 200) {
                return done(new Error(`Status code ${response.statusCode} from login`));
            }

            return done();
        });
    });
};

const getData = (id, done) => {
    request({
        jar,
        method: 'GET',
        url: `http://www.pixiv.net/novel/show.php?id=${id}`,
    }, (error, response, body) => {
        if (error || response.statusCode !== 200) {
            return done(error);
        }

        const $ = cheerio.load(body);

        if ($('body').hasClass('not-logged-in')) {
            return done(new Error('Not logged in'));
        }

        const title = $('section.work-info > .title').text();
        const author = $('.profile-unit .user').text();
        const date = $('section.work-info > ul > li:nth-child(1)').text();
        const caption = entities.decodeHTML($('.work-info > .caption').html()).replace(/<br>/g, '\n');
        const tags = [];
        $('li.tag > .text').each((index, element) => {
            tags.push($(element).text());
        });
        const novel = $('#novel_text').text();

        done(null, {title, author, date, caption, tags, novel});
    });
}

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

    const id = req.body.id;

    if (!id) {
        throw new Error('id not specified');
    }

    if (!isLoggedIn) {
        pixivLogin(error => {
            if (error) {
                throw error;
            }

            emitEvent({event: 'Logged in to pixiv'});

            getData(id, (error, data) => {
                if (error) {
                    throw error;
                }

                onData(data);
            });
        });
    } else {
        getData(id, (error, data) => {
            if (error) {
                pixivLogin(error => {
                    if (error) {
                        throw error;
                    }

                    emitEvent({event: 'Logged in to pixiv'});

                    getData(id, (error, data) => {
                        if (error) {
                            throw error;
                        }

                        onData(data);
                    });
                });
                return;
            }

            onData(data);
        });
    }

    const onData = data => {
        emitEvent({event: 'Retrieved Novel Data'});

        const epub = new Pixiv2Epub(data);
        epub.on('event', (event) => emitEvent({event}));
        epub.on('finish', () => {
            res.end();
        });
    };
});

module.exports = router;
