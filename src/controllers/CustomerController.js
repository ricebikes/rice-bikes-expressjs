var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Customer = require('../models/Customer');

router.use(bodyParser.json());

router.get('/search', function (req, res) {
    Customer.find({$text: {$search: req.query.q}}, function (err, customers) {
        if (err) return res.status(500);
        res.status(200).send(customers);
    });
});

module.exports = router;