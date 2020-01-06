var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Item = require('../models/Item');
var adminMiddleware = require('../middleware/AdminMiddleware');

router.use(bodyParser.json());


/**
 * GET: /categories
 * Allows frontend to produce a list of distinct item categories for users to select between when searching
 */
router.get('/categories', function (req, res) {
    Item.distinct('category', function (err, categories) {
        if (err) return res.status(500).send(err);
        res.status(200).send(categories);
    })
});
/**
 * GET: /brands
 * Gets distinct brands known to the app, for use when searching
 */
router.get('/brands', function (req,res) {
    Item.district('brand',function (err, brands) {
        if (err) return res.status(500).send(err);
        res.status(200).send(brands);
    })
});

/**
 * /search accepts the following parameters:
 *  name: the name of the item.
 *  brand: item brand
 *  category: Item category
 *  upc: Item Universal Product Code (used items will lack one)
 */
router.get('/search', function (req, res) {
    // add all basic query parameters into object
    let query_object = {
        brand: req.query.brand,
        category: req.query.category,
        upc: req.query.upc,
        condition: req.query.condition,
        // explicitly disable showing hidden items
        hidden: false
    };
    // TODO: raise the quantity to zero once inventory is managed correctly
    // if our query defines a name, add that here. Required since the name portion uses indexed searching (for speed)
    if (req.query.name) {
        query_object["$text"] = {"$search": req.query.name};
    }
    // nifty one liner to delete any null or undefined values so that we don't have to explicitly check earlier
    query_object = Object.entries(query_object).reduce((a,[k,v]) => (v == null ? a : {...a, [k]:v}), {});
    console.log(query_object);
    Item.find(query_object, function (err, items) {
        if (err) return res.status(500).send(err);
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
router.put('/:id', function (req, res) {
    {
        Item.findByIdAndUpdate(req.params.id, req.body, {new: true}, function (err, item) {
            if (err) return res.status(500).send(err);
            if (!item) return res.status(404).send();
            return res.status(200).send(item);
        });
    }
});

// get item list
router.get('/', function (req, res) {
    Item.find({}, function (err, items) {
        if (err) return res.status(500).send(err);
        return res.status(200).send(items);
    });
});

module.exports = router;
