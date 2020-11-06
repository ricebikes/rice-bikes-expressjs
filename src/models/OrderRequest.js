/**
 * Order requests are the basis for each item that will be ordered.
 * Initially they start as a request for a part, then an item is assigned to them, and they are attached to
 * an order. Once they are attached to an order, modifications to the order will update the OrderRequest.
 */

const mongoose = require('mongoose');
const autoIncrement = require('mongoose-plugin-autoinc');
const config = require('../config')();

var connection = mongoose.createConnection(config.db_uri);

const OrderRequestSchema = new mongoose.Schema({
    request: String, // describes the item that must be ordered.
    partNumber: String, // The item's part number, if known
    quantity: Number,
    transactions: [{type: Number, ref: 'Transaction'}],
    itemRef: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'}, // Item that will be ordered
    orderRef: {type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null},
    notes: String, // Generic transaction notes
    // This should not be updated in orderRequestController. Modifications to the order holding this orderRequest should change this status
    status: {type: String, default: "Not Ordered"}, 
    // Track actions taken on Order Requests.
    actions: [{
        employee: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        description: String,
        time: Date,
    }]
});
// Auto populate item references when querying order Items
const autoPopulate = function(next) {
    this.populate('itemRef');
    this.populate('actions.employee');
    /*
     * Note: transaction is intentionally not automatically populated. Populate Order Request's transactions on a
     * case by case basis.
     *
     * Do NOT autopopulate the orderRef. Doing so creates a circular dependency.
     */
    next();
};

OrderRequestSchema.pre('find', autoPopulate);
OrderRequestSchema.pre('findOne', autoPopulate);
OrderRequestSchema.pre('save', autoPopulate);

// use plugin so OrderRequests have small integer ID
OrderRequestSchema.plugin(autoIncrement.plugin, 'OrderRequest');

mongoose.model('OrderRequest', OrderRequestSchema);

module.exports = mongoose.model('OrderRequest');
