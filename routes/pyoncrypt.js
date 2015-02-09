var express = require('express');
var router = express.Router();



router.post('/encode', function (req, res, next) {
    if (!req.body || !req.body.text) {
        var err = new Error('You must specify text parameter');
        err.status = 422;
        return next(err);
    }

    var text = req.body.text;


    res.send('respond with a resource');
});

module.exports = router;
