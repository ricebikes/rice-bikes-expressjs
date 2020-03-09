/*
OrderItemController.js: handles manipulation of OrderItems
OrderItems are individual requests to order a specific part, at a specific quantity.
They can be assigned to Orders, and from there can be marked as ordered.
OrderItems start as just a request to order an item, and are assigned a specific item
that will be ordered, followed by a specific order they are a part of.
OrderItems are aware of the order they are assigned to, just as the Order itself is aware what items
it holds. This does not create a circular dependency because mongoose's populate function() is not recursive.
 */

const express = require('express');

const router = express.Router();
const authMiddleware = require('../middleware/AuthMiddleware');
const adminMiddleware = require('../middleware/AdminMiddleware');
const bodyParser = require('body-parser');
const Item = require('./../models/Item');
const Order = require('./../models/Order');
const OrderItem = require('../models/OrderItem');
const Transaction = require('./../models/Transaction');

router.use(bodyParser.json());
// use authMiddleware to require user to login to use any endpoints
router.use(authMiddleware);


/**
 * Helper function to add logs to OrderItems. MODIFIES input OrderItem
 * @param item - OrderItem object from mongoose
 * @param req - http request object
 * @param description - action description
 * @return Promise<OrderItem> -- transaction with log on it
 */
async function addLogToTransaction(transaction, req, description) {
    const user_id = req.headers['user-id'];
    if (!user_id) throw {error:'did not find a user-id header'};
    try {
        const user = await User.findById(user_id);
        const action = {
            "employee": user,
            "description": description,
            "time": Date.now()
        };
        // Add this action first in the array
        transaction.actions.unshift(action);
        return transaction;
    } catch (e) {
        // Throw the error, we expect caller to handle it
        throw e;
    }
}


/**
 * GET: / - gets all OrderItems.
 */
router.get('/', async (req, res) => {
   try {
       const allOrderItems = await Order.find();
       return  res.status(200).send(allOrderItems);
   } catch (err) {
      return res.status(500).send(err);
   }
});


/**
 * GET: /latest/:number - gets latest 'number' OrderItems.
 * Useful to keep the frontend from having to retrieve the
 * entire order history.
 */
router.get('/latest/:number', async (req, res) => {
    try {
        const allOrderItems = await Order.find();
        return res.status(200).send(allOrderItems.slice(0,req.params.number));
    } catch (err) {
       res.status(500).send(err);
    }
});


/**
 * PUT: /:id/request - updates an OrderItem's request string
 *
 * PUT body:
 * {
 *     request: new request string
 * }
 */



// All endpoints below here require an admin login.
router.use(adminMiddleware);

/**
 * POST: / - creates new OrderItem
 *
 * POST body:
 * {
 *     item_id: ObjectID of Item Document to associate with this order (can be null)
 *     quantity: quantity of item requested for order (required)
 *     transaction: associated transaction ID for the request (can be null)
 *     request: string describing the request (required)
 * }
 */
router.post('/', async (req, res) => {
   try {
       // request validation
       if (req.body.quantity === null) return res.status(400).send("No item quantity specified");
       if (!req.body.request) return res.status(400).send("An empty request string was given, or none at all");
       let item;
       if (req.body.item_id) {
           item = await Item.findById(req.body.item_id);
       }
       let transaction;
       if (req.body.transaction) {
           transaction = await Transaction.findById(req.body.transaction);
           if (!transaction) return res.status(404).send("Transaction ID given, but no transaction found");
       }
       const quantity = req.body.quantity;
       const request = req.body.request;
       return OrderItem.create({
          item: item,
          request: request,
          transaction: transaction,
          quantity: quantity
       });
   } catch (err) {
      return res.status(500).send(err);
   }
});

