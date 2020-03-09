const mongoose = require('mongoose');
import { autoIncrement } from 'mongoose-plugin-autoinc';
const config = require('../config')();

var connection = mongoose.createConnection(config.db_uri);

const OrderItemSchema = new mongoose.Schema({
    item: {type: mongoose.Schema.Types.Object, ref: 'Item'},
    request: String, // describes the item that must be ordered.
    assignedOrder: {type: mongoose.Schema.Types.ObjectId, ref: 'Order'},
    quantity: Number,
    transaction: {type: mongoose.Schema.Types.ObjectId, ref: 'Transaction'} // don't autoPopulate this for better speed
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
    // this does not create a circular dependency because populate is not recursive
    // thanks to mongoDB for enabling my poor design decisions
    this.populate('assignedOrder');
    next();
};

OrderItemSchema.pre('find', autoPopulate);
OrderItemSchema.pre('findOne', autoPopulate);
OrderItemSchema.pre('save', autoPopulate);

// use plugin so OrderItems have small integer ID
OrderItemSchema.plugin(autoIncrement, 'OrderItem');

mongoose.model('OrderItem', OrderItemSchema);

module.exports = mongoose.model('OrderItem');
