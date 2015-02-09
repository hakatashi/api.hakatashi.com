var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');

var route = {
    index: require('./routes/index'),
    pyoncrypt: require('./routes/pyoncrypt')
};

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use('/', route.index);
app.use('/pyoncrypt', route.pyoncrypt);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Requested resource is not found');
    err.status = 404;
    next(err);
});

// error handlers

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.set('Content-Type', 'application/json');
    res.send(JSON.stringify({
        code: err.status,
        message: err.message,
        error: {}
    }));
});

module.exports = app;
