var mongoose = require('mongoose');

var OrderSchema = new mongoose.Schema({
    supplier: {type: String, required: true},
    date_created: {type: Date, required: true},
    tracking_number: String,
    status: String,
    items: [{item: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'},
        quantity: Number, transaction: {type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: false}}]
});
// auto populate item list when querying orders
var autoPopulate = function (next) {
    this.populate('items.item');
    this.populate('items.transaction');
    next();
};

OrderSchema.pre('find',autoPopulate);
OrderSchema.pre('findOne',autoPopulate);
OrderSchema.pre('save',autoPopulate);

mongoose.model('Order', OrderSchema);

module.exports = mongoose.model('Order');
