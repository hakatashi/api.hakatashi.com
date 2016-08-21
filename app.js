var express = require('express');
var path = require('path');
var http = require('http');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');

var route = {
    index: require('./routes/index'),
    pyoncrypt: require('./routes/pyoncrypt'),
    pixiv2kindle: require('./routes/pixiv2kindle'),
    sos: require('./routes/sos'),
};

var app = express();

app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(function (req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    return next();
});

app.use('/', route.index);
app.use('/pyoncrypt', route.pyoncrypt);
app.use('/pixiv2kindle', route.pixiv2kindle);
app.use('/sos', route.sos);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Requested resource is not found');
    err.status = 404;
    return next(err);
});

// error handlers

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    var status = err.status || 500;
    res.status(status);
    res.set('Content-Type', 'application/json');
    res.send(JSON.stringify({
        status: status,
        message: http.STATUS_CODES[status],
        error: err.message,
        stacktrace: {}
    }));
});

module.exports = app;
