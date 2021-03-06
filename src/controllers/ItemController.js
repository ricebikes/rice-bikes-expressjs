var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Item = require('../models/Item');
var adminMiddleware = require('../middleware/AdminMiddleware');
var authMiddleware = require('../middleware/AuthMiddleware');
const OrderRequest = require('./../models/OrderRequest');
const Order = require('../models/Order');

router.use(bodyParser.json());

router.use(authMiddleware);

/**
 * GET: /categories
 * Allows frontend to produce a list of distinct item categories for users to select between when searching
 */
router.get('/categories', function (req, res) {
    Item.distinct('category', function (err, categories) {
        if (err) return res.status(500).json(err);
        res.status(200).json(categories);
    })
});
/**
 * GET: /brands
 * Gets distinct brands known to the app, for use when searching
 */
router.get('/brands', function (req, res) {
    Item.distinct('brand', function (err, brands) {
        if (err) return res.status(500).json(err);
        res.status(200).json(brands);
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
        const results = await Item.distinct('size', { category: req.query.category });
        res.status(200).json(results);
    } catch (err) {
        res.status(500).json(err);
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
        query_object["$text"] = { "$search": req.query.name };
    }
    // nifty one liner to delete any null or undefined values so that we don't have to explicitly check earlier
    query_object = Object.entries(query_object).reduce((a, [k, v]) => (v == null ? a : { ...a, [k]: v }), {});
    Item.find(query_object, function (err, items) {
        if (err) return res.status(500).json(err);
        res.status(200).json(items);
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
 * minimum_stock: stock of item that *must* be in shop (optional)
 */
// adds an item to the db. Note that quantity should start at 0
router.post('/', function (req, res) {
    const { name, upc, category, size, brand, condition, standard_price, wholesale_cost, desired_stock, minimum_stock } = req.body;
    // validate the request before proceeding
    if (!((condition === 'Used' || upc)
        && name
        && category
        && brand
        && (standard_price != undefined)
        && (wholesale_cost != undefined)
        && (desired_stock != undefined))) {
        return res.status(400).json({ "err": "Malformed request, missing fields", "status": 400 });
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
        minimum_stock: minimum_stock,
        stock: 0
    }, function (err, item) {
        if (err) return res.status(500).json(err);
        res.status(200).json(item);
    })
});

/**
 * Lets an item be updated. Simply overwrites the current item with whatever is sent.
 */
router.put('/:id', function (req, res) {
    const { name, category, standard_price, wholesale_cost, desired_stock } = req.body;
    // validate the request before proceeding. Be less aggressive than we are when validating new items.
    if (!(name
        && category != undefined
        && (standard_price != undefined)
        && (wholesale_cost != undefined)
        && (desired_stock != undefined))) {
        return res.status(400).json({ "err": "Malformed request, missing fields", "status": 400 });
    }
    Item.findByIdAndUpdate(req.params.id, req.body, { new: true }, function (err, item) {
        if (err) return res.status(500).json(err);
        if (!item) return res.status(404).send();
        return res.status(200).json(item);
    });
});

/**
 * Gets all items from the backend. Notably, will NOT return managed items. These items are handled exclusively on the
 * backend, and removing or adding one to a transaction should not be possible.
 */
router.get('/', function (req, res) {
    Item.find({ managed: false }, function (err, items) {
        if (err) return res.status(500).send(err);
        return res.status(200).send(items);
    });
});

/**
 * Adds an item to the active order requests by creating a new order request for it, or if an active
 * order request exists increments the quantity.
 * @param {Item} item Item schema to add order request for (or update an existing one)
 */
async function createOrUpdateOrderRequest(item) {
    // First, check if there is an existing incomplete order request
    let order_request = await OrderRequest.findOne({ itemRef: item._id, status: { $in: ['Not Ordered', 'In Cart'] } });
    if (!order_request) {
        // Assume that no active order request exists, create one.
        order_request = await OrderRequest.create({
            itemRef: item,
            request: item.name,
            quantity: item.desired_stock - item.stock,
            transactions: [],
            partNumber: '',
            notes: 'Automatically Created',
            actions: []
        });
    } else {
        const regex = /[Aa]utomatically ([Cc]reated|[Uu]pdated)/;
        // Update the request's desired quantity.
        if (order_request.quantity < item.desired_stock - item.stock) {
            if (order_request.orderRef) {
                // Update price of the order
                let order = await Order.findById(order_request.orderRef);
                let newPrice = order.total_price + order_request.itemRef.wholesale_cost * ((item.desired_stock - item.stock) - order_request.quantity);
                order.total_price = newPrice;
                await order.save();
            }
            order_request.quantity = item.desired_stock - item.stock;
        }
        if (!regex.test(order_request.notes)) {
            // Order request notes do not include the string "Automatically Updated", so add it.
            order_request.notes += " Automatically Updated";
        }
        await order_request.save();
    }
}

/**
 * Raises the stock of an Item asynchronously
 * @param itemID: ID of Item to update stock of
 * @param quantity: amount to raise stock of item
 * @return {Promise<OrderRequest>}
 */
async function increaseItemStock(itemID, quantity) {
    // not using try/catch because we want errors to be caught by callers
    const itemRef = await Item.findById(itemID);
    if (!itemRef) {
        // throw error so the frontend knows something went wrong
        throw { err: "Stock update requested for invalid item", status: 400 };
    }
    itemRef.stock += quantity;
    /**
     * Check to see if we need to automatically create a new order request for this item.
     * This is done if the item's stock falls below the desired stock level.
     * Only do this if the desired stock is set above 0
     */
    if (itemRef.stock < itemRef.desired_stock && itemRef.desired_stock > 0) {
        await createOrUpdateOrderRequest(itemRef);
    }
    const restockedItem = await itemRef.save();
    if (!restockedItem) {
        throw { err: "Failed to save new stock state of item", status: 500 };
    }
    return restockedItem;
}

/**
 * Lowers the stock of an Item asynchronously
 * @param itemID: ID of Item to update stock of
 * @param quantity: amount to lower stock of item
 * @return {Promise<OrderRequest>}
 */
async function decreaseItemStock(itemID, quantity) {
    let restockedItem = await increaseItemStock(itemID, (-1) * quantity);
    return restockedItem;
}

module.exports = {
    router: router,
    increaseItemStock: increaseItemStock,
    decreaseItemStock: decreaseItemStock,
};
