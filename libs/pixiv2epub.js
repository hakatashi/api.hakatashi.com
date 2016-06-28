const pixiv2html = require('pixiv2html');
const kindlegen = require('kindlegen');
const EventEmitter = require('events');

module.exports = (text) => {
	const html = pixiv2html(text);

	return html;
};
