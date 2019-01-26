var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Item = require('../models/Item');
var adminMiddleware = require('../middleware/AdminMiddleware');

router.use(bodyParser.json());

router.get('/search', function (req, res) {
  Item.find({$text: {$search: req.query.q}}, function (err, items) {
    if (err) return res.status(500);
    res.status(200).send(items);
  });
});

router.use(adminMiddleware);


// adds an item to the db. Note that quantity should start at 0
router.post('/', function (req, res) {
  Item.create({
    name: req.body.name,
    description: req.body.description,
    price: req.body.price,
    shop_cost: req.body.shop_cost,
    warning_quantity: req.body.warning_quantity
  }, function (err, item) {
    if (err) return res.status(500).send(err);
    res.status(200).send(item);
  })
});

// let an item be updated
router.put('/:id',function (req,res) {
  {
    Item.findByIdAndUpdate(req.params.id,req.body,{new:true},function (err,item) {
      if(err) return res.status(500).send(err);
      if(!item) return res.status(404).send();
      return res.status(200).send(item);
    });
  }
});

// get item list
router.get('/',function (req,res) {
  Item.find({},function (err,items) {
    if (err) return res.status(500).send(err);
    return res.status(200).send(items);
  });
});

module.exports = router;
