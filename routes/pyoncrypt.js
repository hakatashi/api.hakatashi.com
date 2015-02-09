var express = require('express');
var router = express.Router();

router.post('/encode', function (req, res, next) {
    if (!req.body || !req.body.text) {
        var err = new Error('You must specify text parameter');
        err.status = 400;
        return next(err);
    }
    res.send('respond with a resource');
});

module.exports = router;
