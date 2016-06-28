const pixiv2html = require('pixiv2html');
const kindlegen = require('kindlegen');
const EventEmitter = require('events');

class Pixiv2Epub extends EventEmitter {
	constructor(data) {
		super();

		this.data = data;

		process.nextTick(() => {
			this.emit('event', 'Loaded Novel Text');
			this.parse2html();
			this.emit('finish');
		});
	}

	parse2html() {
		this.htmls = pixiv2html(this.data.novel);
		this.emit('event', 'Converted to HTML');
	}
}

module.exports = Pixiv2Epub;
