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
    res.redirect("/daterange");
});

// require admin permissions to use the below endpoints
router.use(adminMiddleware);

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
        let supplier = req.body.supplier;
        // for each item populate the reference and any transaction referenced. This function will return promises.
        let itemPromises = req.body.items.map(async item => {
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
        });
        // wait synchronously until all items are populated
        let populatedItems = await Promise.all(itemPromises);
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
 * PUT / - updates existing order
 * Item array will be overwritten
 * put body:
 * {
 *   tracking_number: Number
 *   items : [ {item: Item, quantity: Number} ]
 * }
 */
router.put('/:id',function (req,res) {
    Order.findByIdAndUpdate(req.params.id, req.body, function (err, order) {
        if (err) return res.status(500).send(err);
        return res.status(200).send(order);
    })
});

module.exports = router;
