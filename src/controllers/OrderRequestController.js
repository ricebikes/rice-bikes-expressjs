/*
OrderRequestController.js: handles manipulation of OrderRequests
OrderRequests are individual requests to order a specific part, at a specific quantity.
They can be assigned to Orders, and from there can be marked as ordered.
OrderRequests start as just a request to order an item, and are assigned a specific item
that will be ordered, followed by a specific order they are a part of.
OrderRequests are aware of the order they are assigned to, just as the Order itself is aware what items
it holds. This does not create a circular dependency because mongoose's populate function() is not recursive.
 */

const express = require('express');

const router = express.Router();
const authMiddleware = require('../middleware/AuthMiddleware');
const adminMiddleware = require('../middleware/AdminMiddleware');
const bodyParser = require('body-parser');
const Item = require('./../models/Item');
const Order = require('./../models/Order');
const OrderRequest = require('../models/OrderRequest');
const User = require('../models/User');
const Transaction = require('./../models/Transaction');

router.use(bodyParser.json());


/**
 * Helper function to add logs to OrderRequests. MODIFIES input OrderRequest
 * @param item - OrderRequest object from mongoose
 * @param req - http request object
 * @param description - action description
 * @return Promise<OrderRequest> -- transaction with log on it
 */
async function addLogToOrderRequest(item, req, description) {
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
        item.actions.unshift(action);
        return item;
    } catch (e) {
        // Throw the error, we expect caller to handle it
        throw e;
    }
}

// use authMiddleware to require user to login to use any endpoints
router.use(authMiddleware);

/**
 * GET: / - gets all OrderRequests.
 */
router.get('/', async (req, res) => {
   try {
       const allOrderRequests = await OrderRequest.find();
       return  res.status(200).send(allOrderRequests);
   } catch (err) {
      return res.status(500).send(err);
   }
});


/**
 * GET: /latest/:number - gets latest 'number' OrderRequests.
 * Useful to keep the frontend from having to retrieve the
 * entire order history.
 */
router.get('/latest/:number', async (req, res) => {
    try {
        const allOrderRequests = await OrderRequest.find();
        return res.status(200).send(allOrderRequests
            .slice(allOrderRequests.length - req.params.number , allOrderRequests.length));
    } catch (err) {
       res.status(500).send(err);
    }
});

/**
 * POST: / - creates new OrderRequest
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
        if (req.body.quantity == null) return res.status(400).send("No item quantity specified");
        if (!req.body.request) return res.status(400).send("An empty request string was given, or none at all");
        let item;
        if (req.body.item_id) {
            item = await Item.findById(req.body.item_id);
            if (!item) return res.status(404).send("Item ID specified, but no item found");
        }
        let transaction;
        if (req.body.transaction) {
            transaction = await Transaction.findById(req.body.transaction);
            if (!transaction) return res.status(404).send("Transaction ID given, but no transaction found");
        }
        const quantity = req.body.quantity;
        const request = req.body.request;
        const newOrderReq = await OrderRequest.create({
            item: item,
            request: request,
            transaction: transaction,
            quantity: quantity,
            status: "Not Ordered"
        });
        const loggedOrderReq = await addLogToOrderRequest(newOrderReq, req, "Created part request");
        const savedOrderReq = await loggedOrderReq.save();
        return res.status(200).send(savedOrderReq);
    } catch (err) {
        return res.status(500).send(err);
    }
});

/**
 * PUT: /:id/request - updates an OrderRequest's request string
 *
 * PUT body:
 * {
 *     request: new request string
 * }
 */
router.put('/:id/request', async (req,res) => {
   try {
       const orderRequest = await OrderRequest.findById(req.params.id);
       if (!orderRequest) return res.status(404).send("No matching order request found");
       if (!req.body.request) return res.status(400).send("Empty or malformed request string");
       orderRequest.request = req.body.request;
       const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, "Updated request description");
       const finalOrderReq = await loggedOrderReq.save();
       return res.status(200).send(finalOrderReq);
   } catch (err) {
      res.status(500).send(err);
   }
});


/**
 * PUT: /:id/quantity - update request's quantity
 *
 * PUT body:
 * {
 *   quantity: new quantity for OrderRequest
 * }
 */
router.put("/:id/quantity", async (req, res) => {
   try {
       const orderRequest = await OrderRequest.findById(req.params.id);
       if (!orderRequest) return res.status(404).send("No matching order request found");
       if (!req.body.quantity) return  res.status(400).send("No new quantity specified");
       const loggedOrderReq = await addLogToOrderRequest(orderRequest, req,
           `Changed quantity from ${orderRequest.quantity} to ${req.body.quantity}`);
       loggedOrderReq.quantity = req.body.quantity;
       const finalOrderReq = await loggedOrderReq.save();
       return res.status(200).send(finalOrderReq);
   } catch (err) {
      return res.status(500).send(err);
   }
});

/**
 * PUT: /:id/status - update or set the status of the OrderRequest
 *
 * PUT body:
 * {
 *     status: New Status String
 * }
 */
router.put('/:id/status', async (req, res) => {
   try {
       const orderRequest = await OrderRequest.findById(req.params.id);
       if (!orderRequest) return res.status(404).send("No order request found!");
       if (!req.body.status) return res.status(400).send("No status specified with request body");
       orderRequest.status = req.body.status;
       const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, `Updated Status`);
       const finalOrderReq = await loggedOrderReq.save();
       return res.status(200).send(finalOrderReq);
   } catch (err) {
      res.status(500).send(err);
   }
});

/**
 * PUT: /:id/transaction - update or set the transaction associated with an OrderRequest
 *
 * PUT body:
 * {
 *     transaction_id: integer ID of transaction to associate with the OrderRequest
 * }
 */
router.put('/:id/transaction', async (req, res) => {
   try {
       const orderRequest = await OrderRequest.findById(req.params.id);
       if (!orderRequest) return res.status(404).send("No matching order request found");
       if (!req.body.transaction_id) return res.status(400).send("No transaction specified for association");
       const locatedTransaction = await Transaction.findById(req.body.transaction_id);
       if (!locatedTransaction) return res.status(404).send("Transaction ID specified could not be found");
       orderRequest.transaction = locatedTransaction;
       const loggedOrderReq = await addLogToOrderRequest(orderRequest, req,
           `Set transaction to #${locatedTransaction._id}`);
       const finalOrderReq = await loggedOrderReq.save();
       return res.status(200).send(finalOrderReq);
   } catch (err) {
      return res.status(500).send(err);
   }
});

/**
 * DELETE: /:id - deletes an OrderRequest by its ID
 */
router.delete('/:id', async (req, res) => {
   try {
       const orderRequest = await OrderRequest.findById(req.params.id);
       if (!orderRequest) return res.status(404).send("No matching order request found");
       await orderRequest.remove();
       return res.status(200).send("OK");
   } catch (err) {
      return res.status(500).send(err);
   }
});


// All endpoints below here require an admin login.
router.use(adminMiddleware);

/**
 * PUT /:id/item - associates an Item with an OrderRequest
 *
 * PUT Body:
 * {
 *     item_id: ObjectID of item to associate with the OrderRequest
 * }
 */
router.put('/:id/item', async (req, res) => {
   try {
       const orderRequest = await OrderRequest.findById(req.params.id);
       if (!orderRequest) return res.status(404).send("No matching order request found");
       if (!req.body.item_id) return res.status(400).send("No item ID provided to add to order request");
       const locatedItem = await Item.findById(req.body.item_id);
       if (!locatedItem) return res.status(404).send("No item located matching the ID specified");
       orderRequest.item = locatedItem._id;
       const loggedOrderReq = await addLogToOrderRequest(orderRequest, req,
           `Assigned item ${locatedItem.name} to request`);
       const finalOrderReq = await loggedOrderReq.save();
       const populatedOrderReq = await OrderRequest.findById(loggedOrderReq._id);
       return res.status(200).send(populatedOrderReq);
   } catch (err) {
      return res.status(500).send(err);
   }
});

module.exports = router;
