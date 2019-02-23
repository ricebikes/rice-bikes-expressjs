var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Item = require('../models/Item');
var adminMiddleware = require('../middleware/AdminMiddleware');

router.use(bodyParser.json());


// allows frontend to dynamically populate dropdown menu of categories
router.get('/categories',function (req,res) {
  Item.distinct('category',function (err, categories) {
    if (err) return res.status(500).send("Error getting distinct categories!");
    res.status(200).send(categories);
  })
});

// allows dynamic population of size parameter in dropdown
router.get('/sizes',function (req,res) {
  // note: request must have a category query associated with it
  Item.distinct('size',{category:req.query.category},function (err, sizes) {
    if(err) return res.status(500).send(err);
    res.status(200).send(sizes);
  })
});

router.get('/search', function (req, res) {
  // switch to see if our query defines a name
  // TODO: raise the quantity to zero once inventory is managed correctly
  if(req.query.name){
    query_object = {
      $text:{$search:req.query.name},
      category: req.query.category,
      size: req.query.size,
      quantity: { $gt:-100}
    };
  } else{
    query_object = {
      category: req.query.category,
      size: req.query.size,
      quantity: { $gt:-100}
    };
  }
  // now remove any undefined values from query so it will succeed
  Object.keys(query_object).forEach(key => (query_object[key] == null) && delete query_object[key]);
  Item.find(query_object, function (err, items) {
      if (err) return res.status(500);
      res.status(200).send(items);
    });
});

// everything below here is only for admins, so use the admin middleware to block it
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
