var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Item = require('../models/Item');
var User = require('../models/User');
var adminMiddleware = require('../middleware/AdminMiddleware');

router.use(bodyParser.json());
router.use(adminMiddleware);

router.get('/search', function (req, res) {
  Item.find({$text: {$search: req.query.q}}, function (err, items) {
    if (err) return res.status(500);
    res.status(200).send(items);
  });
});

router.post('/', function (req, res) {
  User.findOne({username: req.userData.user}, function (err, user) {
    if (err) return res.status(500);
    if (!user) return res.status(404);
    if (!user.admin) {
      res.status(401).end();
    }
    Item.create({name: req.body.name, description: req.body.description, price: req.body.price}, function (err, item) {
      if (err) return res.status(500).send();
      res.status(200).send(item);
    })
  });
});

module.exports = router;