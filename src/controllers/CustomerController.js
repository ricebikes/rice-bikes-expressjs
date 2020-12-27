var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Customer = require('../models/Customer');
const authMiddleware = require('../middleware/AuthMiddleware');

router.use(bodyParser.json());
router.use(authMiddleware);

router.get('/search', function (req, res) {
  Customer.find({ $text: { $search: req.query.q } }, function (err, customers) {
    if (err) return res.status(500);
    res.status(200).json(customers);
  });
});

module.exports = { router: router };