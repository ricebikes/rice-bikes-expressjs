let express = require('express');

/* Wrap our router in our auth protocol */
let router = express.Router();
let authMiddleware = require('../middleware/AuthMiddleware');
let Order = require('./../models/Order');
let Transaction = require('./../models/Transaction');
let bodyParser = require('body-parser');
let adminMiddleware = require('../middleware/AdminMiddleware');
let Item = require('./../models/Item');

router.use(bodyParser.json());
router.use(authMiddleware);

/**
 * GET: /daterange. Accepts following parameters: start, end.
 * Both should be seconds since UNIX epoch
 */
router.get('/daterange',function (req,res) {
    // set start and end, or use default values if they were not given.
   let start = isNaN(parseInt(req.query.start)) ? 0 : parseInt(req.query.start);
   let end = isNaN(parseInt(req.query.end)) ? Date.now() : parseInt(req.query.end);
   Order.find(
       // require date between two UNIX timestamps
   {date_created: { $gt: new Date(start), $lt: new Date(end)}},
       function (err, orders) {
           if (err) return res.status(500);
           return res.status(200).send(orders);
       });
});

/**
 * GET: /. Alias to GET /daterange (gets all orders)
 */
router.get('/', function (req, res) {
    res.redirect("./daterange");
});

// require admin permissions to use the below endpoints
router.use(adminMiddleware);

/**
 * Utility function used by POST and PUT to resolve a list of item IDs to items in the database
 * @param item: List of items, in the following format:
 *  [ {item: Item, quantity: Number transaction(optional): Transaction } ]
 * @return Array of promises, which can be resolved to mongodb item objects
 */
async function resolveItems(item) {
    let itemRef = await Item.findById(item.item._id);
    if (!itemRef) {
        // throw error
        throw {err: "Item not found!"};
    }
    if (item.transaction) {
        // populate transaction ref
        let transactionRef = await Transaction.findById(item.transaction._id);
        if (!transactionRef) {
            // throw error
            throw {err: "Transaction was not found"};
        }
        return {item: itemRef, transaction: transactionRef, quantity: item.quantity};
    } else {
        return {item: itemRef, quantity: item.quantity};
    }
}

/**
 * POSTs a new order
 * post body:
 * {
 *   supplier: String
 *   items: [ {item: Item, quantity: Number transaction(optional): Transaction } ]
 * }
 */
router.post('/',async (req, res) => {
    if (!req.body.items) {
        return res.status(400).send("No items provided in request");
    }
    if (!req.body.supplier) {
        return res.status(400).send("No supplier provided");
    }
    try {
        const supplier = req.body.supplier;
        // for each item populate the reference and any transaction referenced. This function will return promises.
        const itemPromises = req.body.items.map(resolveItems);
        // wait synchronously until all items are populated
        const populatedItems = await Promise.all(itemPromises);
        // create order using populated item refs
        let newOrder = await Order.create({supplier: supplier, date_created: new Date(), items: populatedItems});
        res.status(200).send(newOrder);
    } catch (err) {
        // push error back to frontend user
        console.log(err);
        res.status(500).send(err);
    }
});

/**
 * Updates the stock of an Item asynchronously
 * used when an order is marked as completed, to increase stock of items in database
 * @param itemID: ID of Item to update stock of
 * @param quantity: quantity of item that has been shipped
 * @return {Promise<void>}
 */
async function updateItemStock(itemID, quantity) {
    // not using try/catch because we want errors to be caught by callers
    const itemRef = await Item.findById(itemID);
    if (!itemRef) {
        // throw error so the frontend knows something went wrong
        throw {err: "Stock update requested for invalid item"};
    }
    itemRef.stock += quantity;
    const restockedItem = await itemRef.save();
    if (!restockedItem) {
        throw {err: "Failed to save new stock state of item"};
    }
}

/**
 * PUT / - updates existing order
 * Item array will be overwritten
 * put body:
 * {
 *   supplier: String
 *   tracking_number: String
 *   items : [ {item: Item, quantity: Number} ]
 *   status: String
 * }
 */
router.put('/:id',async (req,res) => {
    try {
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("No order found!");
        // conditionally update each portion of the order, based on if it is present
        if (req.body.tracking_number) {
            order.tracking_number = req.body.tracking_number;
        }
        if (req.body.items) {
            const promises = req.body.items.map(resolveItems);
            order.items = await Promise.all(promises);
        }
        // update the stock of items in this order if it was just completed
        if (req.body.status === "Completed" && order.status !== "Completed") {
            // we will wait for this to complete for error handling (although not strictly necessary otherwise)
            if (req.body.items) {
                const promises = req.body.items.map(item => updateItemStock(item.item._id,item.quantity));
                await Promise.all(promises);
            } else {
                // use the items in the database for this order
                const promises = order.items.map(item => updateItemStock(item.item._id,item.quantity));
                await Promise.all(promises);
            }
        }
        if (req.body.status) {
            order.status = req.body.status;
        }
        if (req.body.supplier) {
            order.supplier = req.body.supplier;
        }
        // save new order into DB, and return the result
        const updatedOrder = await order.save();
        return res.status(200).send(updatedOrder);
    } catch (err) {
        return res.status(500).send(err);
    }
});

module.exports = router;
