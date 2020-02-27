var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Item = require('../models/Item');
var adminMiddleware = require('../middleware/AdminMiddleware');
var authMiddleware = require('../middleware/AuthMiddleware');

router.use(bodyParser.json());

router.use(authMiddleware);

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
    Item.distinct('brand', function (err, brands) {
        if (err) return res.status(500).send(err);
        res.status(200).send(brands);
    })
});


/**
 * GET: /sizes?category=CATEGORY
 * Gets distinct sizes known to the app for a specific item category
 * CATEGORY: item category, retrieved via GET: /categories
 */
router.get('/sizes', async (req, res) => {
    // Using async notation for cleaner code.
    try {
        const results = await Item.distinct ('size', {category: req.query.category});
        res.status(200).send(results);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * /search accepts the following parameters:
 *  name: the name of the item.
 *  brand: item brand
 *  category: Item category
 *  size: Item size
 *  upc: Item Universal Product Code (used items will lack one)
 */
router.get('/search', function (req, res) {
    // add all basic query parameters into object
    let query_object = {
        brand: req.query.brand,
        size: req.query.size,
        category: req.query.category,
        upc: req.query.upc,
        condition: req.query.condition,
        // explicitly disable showing disabled items
        disabled: false
    };
    // if our query defines a name, add that here. Required since the name portion uses indexed searching (for speed)
    if (req.query.name) {
        query_object["$text"] = {"$search": req.query.name};
    }
    // nifty one liner to delete any null or undefined values so that we don't have to explicitly check earlier
    query_object = Object.entries(query_object).reduce((a,[k,v]) => (v == null ? a : {...a, [k]:v}), {});
    if (Object.keys(query_object).length === 0) {
        // if query object is empty, return an empty array rather than searching
        return res.status(200).send([]);
    }
    console.log(query_object);
    Item.find(query_object, function (err, items) {
        if (err) return res.status(500).send(err);
        res.status(200).send(items);
    });
});

// everything below here is only for admins, so use the admin middleware to block it
router.use(adminMiddleware);

/**
 * POST: /
 * Adds a new item to the database.
 * parameters:
 * name: name of item. should have enough info to uniquely identify item
 * upc: item upc. Required only if condition is new.
 * category: item category
 * brand: item brand
 * condition: item condition ('New' or 'Used')
 * standard_price: retail price of item
 * wholesale_cost: wholesale price we pay for item
 * desired_stock: stock of item that should be in shop
 */
// adds an item to the db. Note that quantity should start at 0
router.post('/', function (req, res) {
    const {name, upc, category, size, brand, condition, standard_price, wholesale_cost, desired_stock} = req.body;
    // validate the request before proceeding
    if (!((condition === 'Used' || upc)
        && name
        && category
        && brand
        && (standard_price != undefined)
        && (wholesale_cost != undefined)
        && (desired_stock != undefined))){
        return res.status(400).send("Malformed request, missing fields");
    }
    Item.create({
        name: name,
        upc: upc,
        category: category,
        size: size,
        brand: brand,
        condition: condition,
        standard_price: standard_price,
        wholesale_cost: wholesale_cost,
        disabled: false,
        managed: false,
        desired_stock: desired_stock,
        stock: 0
    }, function (err, item) {
        if (err) return res.status(500).send(err);
        res.status(200).send(item);
    })
});

/**
 * Lets an item be updated. Simply overwrites the current item with whatever is sent.
 */
router.put('/:id', function (req, res) {
    {
        Item.findByIdAndUpdate(req.params.id, req.body, {new: true}, function (err, item) {
            if (err) return res.status(500).send(err);
            if (!item) return res.status(404).send();
            return res.status(200).send(item);
        });
    }
});

/**
 * Gets all items from the backend. Notably, will NOT return managed items. These items are handled exclusively on the
 * backend, and removing or adding one to a transaction should not be possible.
 */
router.get('/', function (req, res) {
    Item.find({managed: false}, function (err, items) {
        if (err) return res.status(500).send(err);
        return res.status(200).send(items);
    });
});

module.exports = router;
