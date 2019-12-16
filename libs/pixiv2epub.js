const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const html = require('html-template-tag');
const nodepub = require('nodepub');
const pixiv2html = require('pixiv2html');
const temp = require('temp');

const titlePage = ({title, author}) => html`
	<div class="title-page">
		<h1 class="title">${title}</h1>
		<p class="author">${author}</p>
	</div>
`;

const captionPage = ({title, caption, tags}) => html`
	<div class="caption-page">
		<h2 class="title">${title}</h2>
		<ul class="tags">
			${tags.map((tag) => html`
				<li class="tag">${tag}</li>
			`)}
		</ul>
		<p class="caption">${[caption.replace(/\n/g, '<br>')]}</p>
	</div>
`;

const CSS = `
	body {
		writing-mode: vertical-rl;
		-webkit-writing-mode: vertical-rl;
	}

	p {
		margin: 0;
	}

	.title-page {
		writing-mode: horizontal-tb;
		-webkit-writing-mode: horizontal-tb;
		text-align: center;
	}

	.caption-page {
		writing-mode: vertical-rl;
		-webkit-writing-mode: vertical-rl;
	}

	.tags {
		padding: 0;
		font-family: sans-serif;
	}

	.tags::before {
		content: 'タグ ';
		font-weight: bold;
	}

	.tag {
		display: inline-block;
		margin-right: 0.5em;
		list-style: none;
	}
`;

class Pixiv2Epub extends EventEmitter {
	constructor(data) {
		super();

		this.data = data;

		process.nextTick(() => {
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
		this.chapters = pixiv2html(this.data.novel, {type: 'xhtml'});
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
		}, path.resolve(__dirname, '../assets/pixiv2kindle/cover.jpg'));

		epub.addSection('扉', titlePage({
			title: this.data.title,
			author: this.data.author,
		}));

		epub.addSection('キャプション', captionPage({
			title: this.data.title,
			caption: this.data.caption,
			date: this.data.date,
			tags: this.data.tags,
		}));

		this.chapters.forEach((html, index) => {
			epub.addSection(`第${index + 1}章`, html);
		});

		epub.addCSS(CSS);

		temp.mkdir('pixiv2kindle', (error, dirPath) => {
			if (error) {
				return done(error);
			}

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
