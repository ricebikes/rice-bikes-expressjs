var mongoose = require('mongoose');

var OrderSchema = new mongoose.Schema({
    supplier: {type: String, required: true},
    date_created: {type: Date, required: true},
    date_submitted: Date,
    date_completed: Date,
    tracking_number: String,
    total_price: {type: Number, default: 0},
    status: String,
    items: [{item: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'},
        quantity: Number, transaction: {type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: false}}]
});
// auto populate item list when querying orders
// avoid autopopulating transaction
var autoPopulate = function (next) {
    this.populate('items.item');
    next();
};

OrderSchema.pre('find',autoPopulate);
OrderSchema.pre('findOne',autoPopulate);
OrderSchema.pre('save',autoPopulate);

mongoose.model('Order', OrderSchema);

module.exports = mongoose.model('Order');
