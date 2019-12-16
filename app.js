const http = require('http');
const bodyParser = require('body-parser');
const express = require('express');
const logger = require('morgan');
const index = require('./routes/index');
const pyoncrypt = require('./routes/pyoncrypt');
const pixiv2kindle = require('./routes/pixiv2kindle');
const sos = require('./routes/sos');
const pixivwall = require('./routes/pixivwall');

const app = express();

app.enable('trust proxy');

app.set('views', `${__dirname}/views`);
app.engine('html', require('ejs').renderFile);

// uncomment after placing your favicon in /public
// app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use((req, res, next) => {
	res.set('Access-Control-Allow-Origin', '*');
	return next();
});

app.use('/', index);
app.use('/pyoncrypt', pyoncrypt);
app.use('/pixiv2kindle', pixiv2kindle);
app.use('/sos', sos);
app.use('/pixivwall', pixivwall);

// catch 404 and forward to error handler
app.use((req, res, next) => {
	const err = new Error('Requested resource is not found');
	err.status = 404;
	return next(err);
});

// error handlers

// production error handler
// no stacktraces leaked to user
app.use((err, req, res) => {
	const status = err.status || 500;
	res.status(status);
	res.set('Content-Type', 'application/json');
	res.send(JSON.stringify({
		status,
		message: http.STATUS_CODES[status],
		error: err.message,
		stacktrace: {},
	}));
});

module.exports = app;
