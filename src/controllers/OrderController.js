let express = require('express');

/* Wrap our router in our auth protocol */
let router = express.Router();
let authMiddleware = require('../middleware/AuthMiddleware');
let Order = require('./../models/Order');
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
   let end = isNaN(parseInt(req.query.end)) ? 0 : parseInt(req.query.end);
   Order.find(
   {date_created: { $gt: new Date(start), $lt: new Date(end)}},
       function (err, orders) {
           if (err) return res.status(500);
           return res.status(200).send(orders);
       });
});

// require admin permissions to use the below endpoints
router.use(adminMiddleware);

/**
 * POSTs a new order
 * post body:
 * {
 *   items : [ {item: Item, quantity: Number} ]
 * }
 */
router.post('/',function (req, res) {
    if (!req.body.items) {
        return res.status(400).send("No items provided in request");
    }
    // map item array to array of objectIds
    Item.findById(req.body.items[0].item._id, function (err, fItem) {
        Order.create({
            items: [{item: fItem}],
            date_created: Date.now()
        }, function (err, order) {
            if (err) return res.status(500).send(err);
            return res.status(200).send(order);
        });
    });

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