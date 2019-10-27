var mongoose = require('mongoose');

var OrderSchema = new mongoose.Schema({
    date_created: Date,
    order: Number,
    items: [{item: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'}, quantity: Number}]
});
// auto populate item list when querying orders
var autoPopulate = function (next) {
    this.populate('items.item');
    next();
};

OrderSchema.pre('find',autoPopulate);
OrderSchema.pre('findOne',autoPopulate);
OrderSchema.pre('save',autoPopulate);

mongoose.model('Order', OrderSchema);

module.exports = mongoose.model('Order');
