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

const pixiv2text = ({ novel, title, author, date, caption, tags }) => {
    novel = novel.replace(/《/g, '≪').replace(/》/g, '≫');
    novel = novel.replace(/､/g, '、').replace(/｡/g, '。');
    novel = novel.replace(/｢/g, '「').replace(/｣/g, '」');
    novel = novel.replace(/\)/g, '）').replace(/\(/g, '（');
    novel = novel.replace(/!/g, '！').replace(/\?/g, '？');
    novel = novel.replace(/([！？]+)([^！？」』）\s])/g, '$1　$2');
    novel = novel.replace(/([！？]{2,})/g, '［＃縦中横］$1［＃縦中横終わり］');
    novel = novel.replace(/\[\[rb:(.+?)\s*>\s*(.+?)\]\]/g, '｜$1《$2》');
    novel = novel.replace(/\[chapter:(.+?)\]/g, '［＃中見出し］$1［＃中見出し終わり］');
    novel = novel.replace(/\[newpage\]/g, '［＃改ページ］');

    const compiled = `
        ${title}
        ${author}
        ${date}
        ${caption}
        ${tags.join('、')}
        ――――――――――
        ${novel}
    `.replace(/^\n/, '').replace(/^ +/mg, '');
    return compiled;
};

const router = express.Router();
const mailgun = Mailgun({ apiKey: config.mailgun.key, domain: config.mailgun.domain });

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

const getWhitecubeData = (id, done) => {
    request({
        jar,
        json: true,
        method: 'GET',
        followRedirect: false,
        url: `https://www.pixiv.net/rpc/whitecube/index.php?mode=novel_details_modal_whitecube&id=${id}`,
    }, (error, response, data) => {
        if (error) {
            return done(error);
        }

        if (response.statusCode !== 200) {
            return done(new Error(`Status code ${response.statusCode}`));
        }

        const body = data.body.html;

        const $ = cheerio.load(body);

        const title = $('.title-container > ._title').text();
        const author = $('.user-name.user-view-popup').text();
        const dateString = $('.datetime').text();
        const date = new Date(dateString.replace(/日/g, '').replace(/(年|月)/g, '-') + ' GMT+0900')
        const caption = entities.decodeHTML($('.description-text').html()).replace(/<br>/g, '\n');

        const tags = [];
        $('.work-info-container > .tags > .tag').each((index, element) => {
            tags.push($(element).text());
        });

        const $series = $('.series-list');
        const series = (() => {
            if ($series.length > 0) {
                return $('.series-title > a').text();
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

        done(null, { id, title, author, date, caption, tags, series, sequence, novel });
    });
}

const getData = (id, done) => {
    request({
        jar,
        method: 'GET',
        followRedirect: false,
        url: `https://www.pixiv.net/ajax/novel/${id}`,
    }, async (error, response, body) => {
        if (error) {
            return done(error);
        }

        if (response.statusCode === 302 && response.headers.location.match('whitecube')) {
            return getWhitecubeData(id, done);
        }

        if (response.statusCode !== 200) {
            return done(new Error(`Status code ${response.statusCode}`));
        }

        const data = JSON.parse(body);

        const title = data.body.title;
        const author = await new Promise((resolve, reject) => {
            request({
                method: 'GET',
                url: `https://www.pixiv.net/member.php?id=${data.body.userId}`,
                followRedirect: false,
            }, (error, response, body) => {
                if (error) {
                    return reject(error);
                }

                const $ = cheerio.load(body);
                return resolve($('title').text().replace(/^.*「(.+?)」.*$/, '$1'));
            });
        });
        const date = new Date(data.body.createDate);
        const caption = data.body.description;

        const tags = data.body.tags.tags.map(({ tag }) => tag);

        const series = data.body.seriesNavData ? data.body.seriesNavData.title : '';
        const sequence = data.body.seriesNavData ? data.body.seriesNavData.order : 0;
        const novel = data.body.content;

        done(null, { id, title, author, date, caption, tags, series, sequence, novel });
    });
}

router.post('/publish', (req, res, next) => {
    res.set('Content-Type', 'text/csv');

    const stringifier = csvStringify();
    stringifier.pipe(res);
    const emitEvent = event => {
        stringifier.write([JSON.stringify(event)]);
    }

    emitEvent({ event: 'Remote App Started' });

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

            emitEvent({ event: 'Logged in to pixiv' });

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

                    emitEvent({ event: 'Logged in to pixiv' });

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
        emitEvent({ event: 'Retrieved Novel Data' });
        const filename = `${id}_${data.title.replace(/[/\\?%*:|"<>]/g, '-')}`;
        fs.writeFileSync(`${filename}.txt`, pixiv2text(data));

        const epub = new Pixiv2Epub(data);
        epub.on('event', (event) => emitEvent({ event }));
        epub.on('error', (error) => emitEvent({ event: error, error: true }));
        epub.on('finish', (data) => {
            fs.writeFileSync(`${filename}.epub`, data);
            kindlegen(data, (error, mobi) => {
                if (error) {
                    emitEvent({ event: error, error: true });
                    return res.end();
                }

                emitEvent({ event: 'Converted to mobi' });
                fs.writeFileSync(`${filename}.mobi`, mobi);
                res.end('ok');
                next(null)
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
                emitEvent({ event: error, error: true });
                return res.end();
            }

            emitEvent({ event: 'Delivered Mail to Kindle' });
            res.end();
        });
    };
});

module.exports = router;
