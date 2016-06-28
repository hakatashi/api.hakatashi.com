const pixiv2html = require('pixiv2html');
const EventEmitter = require('events');
const nodepub = require('nodepub');
const path = require('path');
const temp = require('temp');
const fs = require('fs');

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
					this.emit('finish', this.epub);
				}
			});
		});
	}

	parse2html() {
		this.htmls = pixiv2html(this.data.novel, {type: 'xhtml'});
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

		temp.mkdir('pixiv2kindle', (error, dirPath) => {
			if (error) {
				return done(error);
			}

			this.emit('event', 'Created Temp Dir to Write EPUB in');

			const onError = (error) => {
				done(error);
			};
			const onSuccess = () => {
				this.emit('event', 'Created EPUB File');

				fs.readFile(path.resolve(dirPath, 'out.epub'), (error, data) => {
					if (error) {
						done(error);
					} else {
						this.epub = data;
						this.emit('event', 'Retrieved EPUB data');
						done();
					}
				});
			};

			epub.writeEPUB(onError, dirPath, 'out', onSuccess);
		});
	}
}

module.exports = Pixiv2Epub;
