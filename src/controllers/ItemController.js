var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Item = require('../models/Item');

router.use(bodyParser.json());

router.get('/search', function (req, res) {
    Item.find({$text: {$search: req.query.q}}, function (err, items) {
        if (err) return res.status(500);
        res.status(200).send(items);
    });
});

module.exports = router;