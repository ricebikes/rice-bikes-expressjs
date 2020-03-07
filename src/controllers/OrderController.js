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

/**
 * GET /:id: get a specific order by its ID
 * :id: ID of order
 */
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("No order found");
        res.status(200).send(order);
    } catch (err) {
        res.status(500).send(err);
    }

});

// require admin permissions to use the below endpoints
router.use(adminMiddleware);

/**
 * Utility function used by POST and PUT to resolve a list of item IDs to items in the database
 * @param item: item, in the following format:
 *  {item: Item, quantity: Number transaction(optional): Transaction }
 * @return promise which can be resolved to mongodb item object
 */
async function resolveItem(item) {
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
 * }
 */
router.post('/',async (req, res) => {
    if (!req.body.supplier) {
        return res.status(400).send("No supplier provided");
    }
    try {
        const supplier = req.body.supplier;
        // create order using populated item refs
        let newOrder = await Order.create({supplier: supplier, date_created: new Date(), status: "In Cart"});
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
 * @return {Promise<orderItem>}
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
    return restockedItem;
}

/**
 * PUT /:id/supplier: updates supplier
 * put body:
 * {
 *     supplier: new supplier
 * }
 */
router.put('/:id/supplier', async  (req, res) => {
    try {
        if (!req.body.supplier) return res.status(400).send("No supplier specified");
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("No order found");
        order.supplier = req.body.supplier;
        const savedOrder = await order.save();
        return res.status(200).send(savedOrder);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * POST /:id/item: adds item to order
 * post body:
 * {
 *     item: {
 *          item: Item,
 *          quantity: Number
 *          transaction(optional):
 *          Transaction
 *      }
 * }
 */
router.post('/:id/item', async (req, res) => {
    try {
        if (!req.body.item) return res.status(400).send("No item specified");
        console.log(req.body.item)
        if (!req.body.item.item) return res.status(400).send("No item associated with order item");
        if (req.body.item.quantity == null) return res.status(400).send("No quantity associated with order item");
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("No order found");
        // check if the item is already in the order
        let itemInOrder = order.items.reduce((itemFound, currentItem) =>
                            itemFound || (currentItem.item._id.toString() === req.body.item.item._id),
                            false);
        if (itemInOrder) return res.status(403).send("Item is already in order");
        const item = await resolveItem(req.body.item);
        // add item as first in order
        order.items.unshift(item);
        const savedOrder = await order.save();
        res.status(200).send(savedOrder);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * PUT /:id/item/:itemId/stock
 * updates the quantity of an item in an order
 * put body:
 * {
 *     stock: new stock value
 * }
 */
router.put('/:id/item/:itemId/stock', async (req, res) => {
    try {
        if (!req.body.stock) return res.status(400).send("No stock given");
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("No order found");
        order.items.map(orderItem => {
           if (orderItem.item._id.toString() === req.params.itemId) {
               orderItem.quantity = req.body.stock;
           }
        });
        const savedOrder = await order.save();
        return res.status(200).send(savedOrder);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * POST /:id/item/:itemId/transaction
 * updates the attached transaction for an item in an order
 * put body:
 * {
 *     transaction_id: new transaction objectID (small integer)
 * }
 */
router.put('/:id/item/:itemId/transaction', async (req, res) => {
    try {
        if (!req.body.transaction_id) return res.status(400).send("No transaction id given");
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("No order found");
        const locatedTransaction = await Transaction.findById(req.body.transaction_id);
        if (!locatedTransaction) return res.status(404).send("No associated transaction found for that ID");
        order.items.map(orderItem => {
           if (orderItem.item._id.toString() === req.params.itemId) {
               orderItem.transaction = locatedTransaction;
           }
        });
        const savedOrder = await order.save();
        return res.status(200).send(savedOrder);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * DELETE /:id/item/:itemId
 * deletes an item from the order by the given itemId (for the underlying item)
 */
router.delete('/:id/item/:itemId', async (req, res) => {
    try {
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("No order found");
        const item = await Item.findById(req.params.itemId);
        if (!item) return res.status(404).send("Item not found");
        // remove the requested item from the array
        order.items = order.items.filter(candidate => !(candidate.item._id.toString() === item._id.toString()));
        const finalOrder = await order.save();
        return res.status(200).send(finalOrder);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * PUT /:id/tracking_number: updates an order's tracking number
 * put body:
 * {
 *    tracking_number: new order tracking number
 * }
 */
router.put('/:id/tracking_number', async  (req, res) => {
    try {
        if (!req.body.tracking_number) return res.status(400).send("No tracking number specified");
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("No order found");
        order.tracking_number = req.body.tracking_number;
        const savedOrder = await order.save();
        return res.status(200).send(savedOrder);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * DELETE /:id : deletes an order by it's ID
 */
router.delete('/:id', async (req, res) => {
   try {
       let order = await Order.findById(req.params.id);
       if (!order) return res.status(404).send("No order found");
       await order.remove();
       return res.status(200).send("OK")
   } catch (err) {
       res.status(500).send(err);
   }
});

/**
 * PUT /:id/status: updates an order's status
 * If the order is completed, date_completed will be set
 * If the order is Ordered, date_submitted will be set
 * put body:
 * {
 *     status: new status string of the order
 * }
 */
router.put('/:id/status', async  (req, res) => {
    try {
        if (!req.body.status) return res.status(400).send("No status specified");
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("No order found");
        if (req.body.status === "In Cart") {
            // clear out the submission date and completion date
            order.date_completed = null;
            order.date_submitted = null;
        }
        if (req.body.status === "Ordered") {
            order.date_submitted = new Date(); // order was just submitted
            order.date_completed = null; // clear this out to prevent undefined state
        }
        if (req.body.status === "Completed" && order.status !== "Completed") {
            // set date_completed
            order.date_completed = new Date();
            // update item stocks
            const promises = order.items.map(item => updateItemStock(item.item._id, item.quantity));
            await Promise.all(promises);    // await for all promises to resolve
        } else if (req.body.status !== "Completed" && order.status === "Completed") {
            // decrease item stocks
            const promises = order.items.map(item => updateItemStock(item.item._id, -1 * item.quantity));
            await Promise.all(promises);    // await for all promises to resolve
        }
        order.status = req.body.status;
        const savedOrder = await order.save();
        // Find the order again here. The additional query forces the new item stocks to populate.
        const final = await Order.findById(savedOrder._id);
        return res.status(200).send(final);
    } catch (err) {
        res.status(500).send(err);
    }
});

module.exports = router;
