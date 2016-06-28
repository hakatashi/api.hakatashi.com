const pixiv2html = require('pixiv2html');
const kindlegen = require('kindlegen');
const EventEmitter = require('events');
const nodepub = require('nodepub');
const path = require('path');

class Pixiv2Epub extends EventEmitter {
	constructor(data) {
		super();

		this.data = data;

		process.nextTick(() => {
			this.emit('event', 'Loaded Novel Text');
			this.parse2html();
			this.html2epub((error) => {
				if (error) {
					this.emit('error', error);
				} else {
					this.emit('finish');
				}
			});
		});
	}

	parse2html() {
		this.htmls = pixiv2html(this.data.novel);
		this.emit('event', 'Converted to HTML');
	}

	html2epub(done) {
		const epub = nodepub.document({
			id: `pixiv-${this.data.id}`,
			title: this.data.title,
			series: this.data.series,
			sequence: this.data.sequence,
			author: this.data.author,
			fileAs: this.data.author,
			genre: 'pixiv Novel',
			tags: this.data.tags.join(','),
			copyright: `${this.data.author}, ${this.data.date.getFullYear()}`,
			publisher: 'pixiv2kindle',
			published: `${this.data.date.getFullYear()}-${this.data.date.getMonth() + 1}-${this.data.date.getDate()}`,
			language: 'ja',
			description: this.data.caption,
			contents: '目次',
			source: `http://www.pixiv.net/novel/show.php?id=${this.data.id}`,
			images: [],
		}, path.resolve(__dirname, '../assets/pixiv2kindle/cover.png'));

		this.htmls.forEach((html, index) => {
			epub.addSection(`第${index + 1}章`, html);
		});

		const onError = (error) => {
			done(error);
		};
		const onSuccess = () => {
			done();
		};

		epub.writeEPUB(onError, path.resolve(__dirname, '../assets'), 'test', onSuccess);
	}
}

module.exports = Pixiv2Epub;
