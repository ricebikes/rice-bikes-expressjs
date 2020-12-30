/*
OrderController.js: handles management of Orders.
An order is a collection of OrderRequests being ordered from a specific supplier.
It is expected that once an OrderRequest is in an order, it has a specific Item assigned to it,
and a specific stock of that item.
 */
let express = require('express');

/* Wrap our router in our auth protocol */
let router = express.Router();
let authMiddleware = require('../middleware/AuthMiddleware');
let Order = require('./../models/Order');
let bodyParser = require('body-parser');
let adminMiddleware = require('../middleware/AdminMiddleware');
let OrderRequest = require('../models/OrderRequest');
let OrderRequestController = require('./OrderRequestController');

router.use(bodyParser.json());
router.use(authMiddleware);

/**
 * GET: / Get orders.
 *  Accepts following parameters: 
 *  start_date: first order date to show, seconds since unix epoch
 *  end_date: latest order date to show, seconds since unix epoch
 *  active: should only active orders be returned
 */
router.get('/', function (req, res) {
    // set start and end, or use default values if they were not given.
    let start = isNaN(parseInt(req.query.start_date)) ? 0 : parseInt(req.query.start_date);
    let end = isNaN(parseInt(req.query.end_date)) ? Date.now() : parseInt(req.query.end_date);
    let active = req.query.active;
    // Create date objects from timestamps
    let query = { date_created: { $gt: new Date(start), $lt: new Date(end) } };
    if (active) {
        query['status'] = "In Cart";
    }
    Order.find(
        query,
        function (err, orders) {
            if (err) return res.status(500);
            // Sort the orders so that the most recent one is first in the array
            orders = orders.sort((a,b) => b.date_created - a.date_created);
            return res.status(200).json(orders);
        });
});

/**
 * GET /:id: get a specific order by its ID
 * :id: ID of order
 */
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ err: "No order found", status: 404 });
        res.status(200).json(order);
    } catch (err) {
        res.status(500).json(err);
    }

});

// require admin permissions to use the below endpoints
router.use(adminMiddleware);


/**
 * POSTs a new order
 * POST body:
 * {
 *   supplier: String
 * }
 */
router.post('/', async (req, res) => {
    if (!req.body.supplier) {
        return res.status(400).json({ err: "No supplier provided", status: 400 });
    }
    try {
        const supplier = req.body.supplier;
        // create order using populated item refs
        let newOrder = await Order.create({ supplier: supplier, date_created: new Date(), status: "In Cart" });
        res.status(200).json(newOrder);
    } catch (err) {
        // push error back to frontend user
        console.log(err);
        res.status(500).json(err);
    }
});

/**
 * PUT /:id/supplier: updates supplier
 * put body:
 * {
 *     supplier: new supplier
 * }
 */
router.put('/:id/supplier', async (req, res) => {
    try {
        if (!req.body.supplier) return res.status(400).json({ err: "No supplier specified", status: 400 });
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ err: "No order found", status: 404 });
        // Update the supplier of all Order Requests in this order
        const promises = order.items.map(async item => {
            const locatedItem = await OrderRequest.findById(item._id);
            await OrderRequestController.setSupplier(locatedItem, req.body.supplier);
        });
        await Promise.all(promises);
        order.supplier = req.body.supplier;
        const savedOrder = await order.save();
        return res.status(200).json(savedOrder);
    } catch (err) {
        if (err.err) {
            // Error was thrown by one of our functions
            let status = 500;
            if (err.status) status = err.status;
            return res.status(status).json({ err: err.err, status: status });
        }
        res.status(500).json(err);
    }
});

/**
 * PUT /:id/notes: update notes of an order
 * put body: 
 * {
 *    notes: new string to set for notes
 * }
 */
router.put('/:id/notes', async (req, res) => {
    try {
        if (req.body.notes == undefined) {
            return res.status(400).json({ err: "No notes string provided", status: 400 });
        }
        let order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ err: "No order with provided ID found", status: 404 });
        }
        order.notes = req.body.notes;
        const savedOrder = await order.save();
        return res.status(200).json(savedOrder);
    } catch (err) {
        return res.status(500).json(err);
    }
})

/**
 * POST /:id/order-request: adds OrderRequest to order
 * post body:
 * {
 *    order_request_id: ID of order request
 * }
 */
router.post('/:id/order-request', async (req, res) => {
    try {
        if (req.body.order_request_id == null) return res.status(400).json({ err: "No order request specified", status: 400 });
        const orderRequest = await OrderRequest.findById(req.body.order_request_id);
        if (!orderRequest) return res.status(404).json({ err: "Order request specified, but none found!", status: 404 });
        if (orderRequest.orderRef) {
            return res.status(403).json({ err: "Cannot associate order request, already associated to another order", status: 403 });
        }
        if (!orderRequest.itemRef) {
            return res.status(403).json({ err: "Order request must have an associated item to be added to an order", status: 403 });
        }
        if (orderRequest.quantity < 1) {
            return res.status(400).json({ err: "Order request has bad quantity: " + orderRequest.quantity, status: 400 });
        }
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json("No order found");
        if (order.status == 'Completed') return res.status(400).json({ err: "Cannot add order request to completed order", status: 400 });
        // update OrderRequest to match order
        const savedReq = await OrderRequestController.addOrderToOrderRequest(orderRequest, order);
        // Add item price to total price of order.
        order.total_price += savedReq.itemRef.wholesale_cost * savedReq.quantity;
        // add item as first in order
        order.items.unshift(savedReq);
        const savedOrder = await order.save();
        res.status(200).json(savedOrder);
    } catch (err) {
        if (err.err) {
            // Error was thrown by one of our functions
            let status = 500;
            if (err.status) status = err.status;
            return res.status(status).json({ err: err.err, status: status });
        }
        res.status(500).json(err);
    }
});

/**
 * DELETE /:id/order-request/:reqId
 * deletes an order request from the order by the given reqId (for the order request)
 * Does not delete order request, simply disassociates it with the order.
 */
router.delete('/:id/order-request/:reqId', async (req, res) => {
    try {
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ err: "No order found", status: 404 });
        const orderRequest = await OrderRequest.findById(req.params.reqId);
        if (!orderRequest) return res.status(404).json({ err: "Order request not found in this order", status: 404 });
        const finalOrder = await OrderRequestController.removeOrderRequestFromOrder(order, orderRequest);
        return res.status(200).json(finalOrder);
    } catch (err) {
        if (err.err) {
            // Error was thrown by one of our functions
            let status = 500;
            if (err.status) status = err.status;
            return res.status(status).json({ err: err.err, status: status });
        }
        res.status(500).json(err);
    }
});

/**
 * PUT /:id/tracking_number: updates an order's tracking number
 * put body:
 * {
 *    tracking_number: new order tracking number
 * }
 */
router.put('/:id/tracking_number', async (req, res) => {
    try {
        if (!req.body.tracking_number) return res.status(400).json({ err: "No tracking number specified", status: 400 });
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ err: "No order found", status: 404 });
        order.tracking_number = req.body.tracking_number;
        const savedOrder = await order.save();
        return res.status(200).json(savedOrder);
    } catch (err) {
        res.status(500).json(err);
    }
});

/**
 * DELETE /:id : deletes an order by it's ID
 */
router.delete('/:id', async (req, res) => {
    try {
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ err: "No order found", status: 404 });
        // Remove the order id from all order requests in order.
        for (let orderReqId of order.items) {
            let orderReq = await OrderRequest.findById(orderReqId);
            await OrderRequestController.removeOrderRequestFromOrder(order, orderReq);
        }
        await order.remove();
        return res.status(200).json({ status: "OK" })
    } catch (err) {
        res.status(500).json(err);
    }
});

/**
 * PUT /:id/freight-charge: updates an order's freight/shipping cost
 * put body:
 * {
 *      charge: freight charge
 * }
 */
router.put('/:id/freight-charge', async (req, res) => {
    try {
        if (req.body.charge == null) {
            return res.status(400).json({ err: "A freight charge must be specified", status: 400 });
        }
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ err: "No order with given ID found", status: 404 });
        }
        if (!order.freight_charge) order.freight_charge = 0;
        const difference = req.body.charge - order.freight_charge;
        order.freight_charge = req.body.charge;
        order.total_price += difference;
        const savedOrder = await order.save();
        return res.status(200).json(savedOrder);
    } catch (err) {
        res.status(500).json(err);
    }
})

/**
 * PUT /:id/status: updates an order's status
 * If the order is completed, date_completed will be set (as well as date_submitted if it was null)
 * If the order is ordered, date_submitted will be set
 * put body:
 * {
 *     status: new status string of the order
 * }
 */
router.put('/:id/status', async (req, res) => {
    try {
        if (!req.body.status) return res.status(400).json({ err: "No status specified", status: 400 });
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ err: "No order found", status: 404 });
        // Update the status of all Order Items in this order
        const promises = order.items.map(async item => {
            let locatedItem = await OrderRequest.findById(item._id);
            locatedItem = await OrderRequestController.setRequestStatus(locatedItem, req.body.status);
            await locatedItem.save();
        });
        await Promise.all(promises); // Set all request statuses
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
            order = await Order.findById(order._id);
            // set date_completed
            order.date_completed = new Date();
            // If order was not marked as in cart, just set date to now
            if (order.date_submitted == null) {
                order.date_submitted = new Date();
            }
        } else if (req.body.status !== "Completed" && order.status === "Completed") {
            order.date_completed = null;
        }
        order.status = req.body.status;
        const savedOrder = await order.save();
        // Forces the order request items array to update.
        const finalOrder = await Order.findById(savedOrder._id);
        return res.status(200).json(finalOrder);
    } catch (err) {
        if (err.status == 400 && err.problemTransactions) {
            /**
             * This is a specific error, stating that we cannot mark an order as incomplete because some of the
             * transactions waiting for parts from it have used those parts. Forward these error details to frontend.
             */
            return res.status(400).json({ err: "Some transactions attached to order are already complete, cannot reopen order", 
                                          status: 400, problemTransactions: err.problemTransactions });
        }
        if (err.err) {
            let status = 500;
            if (err.status) status = err.status;
            return res.status(status).json({ err: err.err, status: status });
        }
        res.status(500).json(err);
    }
});

module.exports = {
    router: router,
};
