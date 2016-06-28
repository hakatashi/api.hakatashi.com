const pixiv2html = require('pixiv2html');

module.exports = (text) => {
	const html = pixiv2html(text);

	return html;
};
