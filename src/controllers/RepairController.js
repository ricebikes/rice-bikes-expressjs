var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Repair = require('../models/Repair');

router.use(bodyParser.urlencoded({ extended: true }));

router.get('/', function (req, res) {
    Repair.find({$text: {$search: req.query.q}}, function (err, repairs) {
        if (err) return res.status(500);
        res.status(200).send(repairs);
    });
});

module.exports = router;