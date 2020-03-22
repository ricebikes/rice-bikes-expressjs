const mongoose = require('mongoose');
const autoIncrement = require('mongoose-plugin-autoinc');
const config = require('../config')();

var connection = mongoose.createConnection(config.db_uri);

const OrderRequestSchema = new mongoose.Schema({
    item: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'},
    request: String, // describes the item that must be ordered.
    status: String, // order status of OrderRequest.
    supplier: String, // supplier of OrderRequest.
    quantity: Number,
    transaction: {type: Number, ref: 'Transaction'},
    associatedOrder: String,
    // Track actions taken on Order Requests.
    actions: [{
        employee: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        description: String,
        time: Date,

    }]
});
// Auto populate item references when querying order Items
const autoPopulate = function(next) {
    this.populate('item');
    this.populate('actions.employee');
    /*
    Note: transaction is intentionally not automatically populated. Populate Order Request's transactions on a
    case by case basis.
    Do NOT automatically populate the reference to the order, doing so will cause a circular dependency.
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
