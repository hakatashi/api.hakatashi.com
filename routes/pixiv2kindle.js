const express = require('express');
const csvStringify = require('csv-stringify');
const request = require('request');
const cheerio = require('cheerio');
const entities = require('entities');
const kindlegen = require('kindlegen');
const fs = require('fs');
const Mailgun = require('mailgun-js');

const config = require('../config.json').pixiv2kindle;
const jar = require('../libs/jar');
const Pixiv2Epub = require('../libs/pixiv2epub');

const router = express.Router();
const mailgun = Mailgun({apiKey: config.mailgun.key, domain: config.mailgun.domain});

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
        const dateString = $('section.work-info > ul > li:nth-child(1)').text();
        const date = new Date(dateString.replace(/(年|月|日)/g, '-') + ' GMT+0900')
        const caption = entities.decodeHTML($('.work-info > .caption').html()).replace(/<br>/g, '\n');

        const tags = [];
        $('li.tag > .text').each((index, element) => {
            tags.push($(element).text());
        });

        const $series = $('.area_new .type-series');
        const series = (() => {
            if ($series.length > 0) {
                const $seriesArea = $series.parent().parent();
                return $seriesArea.find('h3').text();
            } else {
                return '';
            }
        })();

        const sequence = (() => {
            if ($series.length > 0) {
                const $seriesItems = $series.children('li');
                return $seriesItems.index($seriesItems.filter(
                    (index, element) => $(element).text() === title
                ).first()) + 1;
            } else {
                return 0;
            }
        })();

        const novel = $('#novel_text').text();

        done(null, {id, title, author, date, caption, tags, series, sequence, novel});
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
        epub.on('error', (error) => emitEvent({event: error, error: true}));
        epub.on('finish', (data) => {
            kindlegen(data, (error, mobi) => {
                if (error) {
                    emitEvent({event: error, error: true});
                    return res.end();
                }

                emitEvent({event: 'Converted to mobi'});
                sendMail(mobi);
            });
        });
    };

    const sendMail = (mobi) => {
        const attachment = new mailgun.Attachment({
            data: mobi,
            filename: `pixiv-${id}.mobi`,
            contentType: 'application/x-mobipocket-ebook',
        });

        mailgun.messages().send({
            from: `pixiv2kindle <${config.kindle.from}>`,
            to: config.kindle.to,
            subject: 'pixiv2kindle delivery',
            text: 'This is an automatic content delivery from pixiv2kindle. Please contact hakatasiloving@gmail.com if you see something.',
            attachment: attachment,
        }, (error, body) => {
            if (error) {
                emitEvent({event: error, error: true});
                return res.end();
            }

            emitEvent({event: 'Delivered Mail to Kindle'});
            res.end();
        });
    };
});

module.exports = router;
