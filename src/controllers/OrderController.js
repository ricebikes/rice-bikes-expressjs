let express = require('express');

/* Wrap our router in our auth protocol */
let router = express.Router();
let authMiddleware = require('../middleware/AuthMiddleware');
let Order = require('./../models/Order');

router.use(bodyParser.json());
router.use(authMiddleware);

/**
 * GET: /daterange. Accepts following parameters: start, end.
 * Both should be seconds since UNIX epoch
 */
router.get('/daterange',function (req,res) {
    // set start and end, or use default values if they were not given.
   let start = req.query.start === undefined ? 0 : req.query.start;
   let end = req.query.end === undefined ? 0 : req.query.end;
   Order.find(
   {$and:
       [ {date_created: { $gt: new Date(start) }},
           {date_created: {$lt: new Date(end)}}]},
       function (err, orders) {
           if (err) return res.status(500)
           return res.status(200).send(orders);
       });
});

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
    Order.create({
        items: req.body.items,
        date_created: Date.now()
    }, function (err, order) {
        if (err) return res.status(500).send(err);
        return res.status(200).send(order);
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