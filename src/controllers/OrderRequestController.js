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
    if (!user_id) throw { error: 'did not find a user-id header' };
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
 * Possible parameters:
 * status- status string for order requests
 * active- if true, only return order requests that are in cart, or not ordered
 * supplier- string of supplier name
 */
router.get('/', async (req, res) => {
    let query = {};
    if (req.query.status) {
        query.status = req.query.status;
    }
    if (req.query.supplier) {
        query.supplier = req.query.supplier;
    }
    if (req.query.active) {
        query.status = { $in: ["Not Ordered", "In Cart"] };
    }
    try {
        const allOrderRequests = await OrderRequest.find(query);
        return res.status(200).send(allOrderRequests);
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
        // Slice the returned array to get only latest requests. Reverse array so newest request is first
        if (allOrderRequests.length < req.params.number) {
            return res.status(200).send(allOrderRequests.reverse());
        } else {
            return res.status(200).send(allOrderRequests
                .slice(allOrderRequests.length - req.params.number, allOrderRequests.length).reverse());
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * GET: /distinct-ids: gets all distinct order request IDs
 */
router.get('/distinct-ids', async (req, res) => {
    try {
        const allIDs = await OrderRequest.distinct('_id');
        return res.status(200).send(allIDs);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * POST: / - creates new OrderRequest
 *
 * POST body:
 * {
 *     request: string describing the request (required)
 *     quantity: quantity of item requested for order (required)
 *     partNumber: item part number, if known (optional)
 *     item_id: ObjectID of Item Document to associate with this order (can be null)
 *     transactions: associated transaction IDs for the request (can be null)
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
        let transactions = [];
        if (req.body.transactions) {
            for (let transaction of req.body.transactions) {
                let located_transaction = await Transaction.findById(transaction);
                if (!located_transaction) return res.status(404).send("Transaction ID " + transaction + " given, but no transaction found");
                transactions.push(located_transaction._id);
            }
        }
        const partNumber = req.body.partNumber;
        const quantity = req.body.quantity;
        const request = req.body.request;
        const newOrderReq = await OrderRequest.create({
            item: item,
            request: request,
            partNumber: partNumber,
            transactions: transactions,
            quantity: quantity,
        });
        const loggedOrderReq = await addLogToOrderRequest(newOrderReq, req, "Created part request");
        // Add the order request to transactions
        for (let transaction of loggedOrderReq.transactions) {
            let transactionRef = await Transaction.findById(transaction);
            transactionRef.orderRequests.push(loggedOrderReq._id);
            await transactionRef.save();
        }
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
router.put('/:id/request', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).send("No matching order request found");
        if (!req.body.request) return res.status(400).send("Empty or malformed request string");
        orderRequest.request = req.body.request;
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, "Updated request description to " + orderRequest.request);
        const finalOrderReq = await loggedOrderReq.save();
        return res.status(200).send(finalOrderReq);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * PUT: /:id/partnumber - updates an OrderRequest's part number
 *
 * PUT body:
 * {
 *     partNum : new part number
 * }
 */
router.put('/:id/partnumber', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).send("No matching order request found");
        if (!req.body.partNum) return res.status(400).send("Empty or malformed part number string");
        orderRequest.partNumber = req.body.partNum;
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, "Updated part number to " + orderRequest.partNumber);
        const finalOrderReq = await loggedOrderReq.save();
        return res.status(200).send(finalOrderReq);
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * PUT: /:id/notes - updates notes on Orderrequest
 *
 * PUT body:
 * {
 *     notes: new notes string
 * }
 */
router.put('/:id/notes', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).send("No matching order request found");
        if (!req.body.notes) return res.status(400).send("Empty or malformed notes string");
        orderRequest.notes = req.body.notes;
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, "Updated notes");
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
        const orderrequest = await OrderRequest.findById(req.params.id);
        if (!orderrequest) return res.status(404).send("No matching order request found");
        if (!req.body.quantity) return res.status(400).send("No new quantity specified");
        if (orderrequest.transactions && req.body.quantity < orderrequest.transactions.length) {
            return res.status(400).send("Cannot set quantity below number of attached transactions");
        }
        if (orderrequest.orderRef) {
            // Update price of the order
            let order = await Order.findById(orderrequest.orderRef);
            order.total_price += orderrequest.itemRef.wholesale_cost * (req.body.quantity - orderrequest.quantity);
            await order.save();
        }
        const loggedorderreq = await addLogToOrderRequest(orderrequest, req,
            `Changed quantity from ${orderrequest.quantity} to ${req.body.quantity}`);
        loggedorderreq.quantity = req.body.quantity;
        const finalorderreq = await loggedorderreq.save();
        return res.status(200).send(finalorderreq);
    } catch (err) {
        return res.status(500).send(err);
    }
});

/**
 * POST /:id/transaction - add a transaction to an order request.
 * Transaction IDs can be added multiple times to one order request 
 * (symbolizes the transaction needing multiple of requested item)
 * 
 * This endpoint will update the order request, and will add the 
 * order request to the transaction itself.
 * 
 * POST body:
 * {
 *     transaction_id: ID of transaction to add.
 * }
 */
router.post('/:id/transaction', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ "err": "no matching order request found" });
        if (!req.body.transaction_id) return res.status(400).json({ "err": "no transaction id provided" });
        const transaction = await Transaction.findById(req.body.transaction_id);
        if (!transaction) return res.status(404).json({ "err": "no matching transaction found" });
        // Do not allow users to add order requests to completed transactions.
        if (transaction.complete) return res.status(400).json({ "err": "cannot add order request to completed transaction" });
        if (orderRequest.status == 'Complete') return res.status(400).json({ "err": "cannot add completed order request to transaction" });
        // Now, add the transaction to the order request and vice versa
        if (!transaction.orderRequests) transaction.orderRequests = [];
        transaction.orderRequests.push(orderRequest);
        await transaction.save();
        orderRequest.transactions.push(transaction._id);
        // Add to order request quantity, and update order price if required.
        orderRequest.quantity += 1;
        if (orderRequest.orderRef && orderRequest.itemRef) {
            const order = await Order.findById(orderRequest.orderRef);
            order.total_price += orderRequest.itemRef.wholesale_cost;
            await order.save();
        }
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, `Added transaction ${transaction._id}`);
        const savedOrderReq = await loggedOrderReq.save();
        return res.status(200).send(savedOrderReq);
    } catch (err) {
        return res.status(500).send(err);
    }
});

/**
 * Deletes an order request from the database. 
 * Automatically handles removing order request reference from transactions, as well as orders.
 * @param {OrderRequest} orderRequest Request to delete
 */
async function deleteOrderRequest(orderRequest) {
    if (orderRequest.orderRef) {
        // Get reference to order this request is in, and update cost.
        let order = await Order.findById(orderRequest.orderRef);
        let item = await Item.findById(orderRequest.itemRef);
        order.total_price -= item.wholesale_cost * orderRequest.quantity;
        // Remove orderRequest from order.
        order.items = order.items.splice(order.items.indexOf(orderRequest._id), 1);
        await order.save();
    }
    /**
     * Special case here: up until this point in the lifecycle of an order request, we try to keep the
     * transactions' references to an order request in sync with the order request's reference to
     * the transactions. Once the order is completed however, we want to keep the transaction numbers for
     * future reference, but we do not want transactions to be "waiting on part", so we let the relationship
     * lapse. The transaction will no longer have a reference to the order request, but the order request
     * will have a reference to the transaction.
     */
    if (orderRequest.status != 'Completed') {
        // Remove orderRequest from transactions
        for (let transaction of orderRequest.transactions) {
            let transactionRef = await Transaction.findById(transaction);
            let index = transactionRef.orderRequests.indexOf(orderRequest._id);
            transactionRef.orderRequests.splice(index, 1);
            await transactionRef.save();
        }
    }
    await orderRequest.remove();
}

/**
 * DELETE /:id/transaction/transactionID - removes a transaction from an order request by its ID
 * 
 * Will also update the transaction to remove the order request.
 * If an order request has a transaction associated multiple times, this endpoint will only remove it once.
 */
router.delete('/:id/transaction/:transactionID', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ "err": "no matching order request found" });
        const transaction = await Transaction.findById(req.params.transactionID);
        if (!transaction) return res.status(404).json({ "err": "no matching transaction found" });
        // Now remove the transaction from the order request and vice versa
        let index = orderRequest.transactions.indexOf(transaction._id);
        if (index == -1) return res.status(404).json({ "err": "transaction was not found attached to order request" });
        orderRequest.transactions.splice(index, 1);
        // Decrease order request quantity, and update order price if required.
        orderRequest.quantity -= 1;
        if (orderRequest.orderRef && orderRequest.itemRef) {
            const order = await Order.findById(orderRequest.orderRef);
            order.total_price -= orderRequest.itemRef.wholesale_cost;
            await order.save();
        }
        index = transaction.orderRequests.findIndex(x => x._id.toString() == orderRequest._id.toString());
        if (index == -1) return res.status(404).json({ "err": "order request was not found attached to transaction" });
        // Note that we do allow users to remove order requests from completed transactions (just not add new ones).
        transaction.orderRequests.splice(index, 1);
        await transaction.save();
        if (orderRequest.quantity == 0) {
            // All transactions have been removed from the order request, and we can assume that the request is not useful now. Delete it.
            await deleteOrderRequest(orderRequest);
            return res.status(204).send({}); // We have deleted order request, so no way to send it.
        }
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, `Removed transaction ${transaction._id}`);
        const savedOrderReq = await loggedOrderReq.save();
        return res.status(200).send(savedOrderReq);
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
        await deleteOrderRequest(orderRequest);
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
        if (orderRequest.orderRef) {
            // We need to update the order's cost to match this new item.
            const order = await Order.findById(orderRequest.orderRef);
            order.total_price += (locatedItem.wholesale_cost - orderRequest.itemRef.wholesale_cost) * orderRequest.quantity;
            await order.save();
        }
        orderRequest.itemRef = locatedItem._id;
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
