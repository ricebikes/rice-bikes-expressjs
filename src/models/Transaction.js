var mongoose = require('mongoose');

var TransactionSchema = new mongoose.Schema({
    description: String,
    date_created: Date,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer'},
    bikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bike'}],
    repairs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Repair'}],
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item'}]
});

var autoPopulateCustomer = function (next) {
    this.populate('customer');
    this.populate('bike');
    next();
};

TransactionSchema.pre('find', autoPopulateCustomer);

mongoose.model('Transaction', TransactionSchema);

module.exports = mongoose.model('Transaction');