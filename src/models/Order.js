var mongoose = require('mongoose');

var OrderSchema = new mongoose.Schema({
    supplier: {type: String, required: true},
    date_created: {type: Date, required: true},
    date_submitted: Date,
    date_completed: Date,
    tracking_number: String,
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
