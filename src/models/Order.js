/**
 * Orders track order requests. The order request holds a reference to the order it is a member of, but
 * generally once OrderRequests are in an Order they will be modified from there.
 */
var mongoose = require('mongoose');

var OrderSchema = new mongoose.Schema({
    supplier: String,
    date_created: {type: Date, required: true},
    date_submitted: Date,
    date_completed: Date,
    tracking_number: String,
    freight_charge: Number,
    notes: String,
    total_price: {type: Number, default: 0},
    status: String,
    items: [{type: Number, ref: 'OrderRequest'}]
});
// auto populate item list when querying orders
// avoid autopopulating transaction
var autoPopulate = function (next) {
    // this does not create a circular dependency because populate is not recursive
    // thanks to mongoDB for enabling my poor design decisions
    this.populate('items');
    next();
};

OrderSchema.pre('find',autoPopulate);
OrderSchema.pre('findOne',autoPopulate);
OrderSchema.pre('save',autoPopulate);

mongoose.model('Order', OrderSchema);

module.exports = mongoose.model('Order');
