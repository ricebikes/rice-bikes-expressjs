var mongoose = require('mongoose');
var transactionId = require('./TransactionId');
var autoIncrement = require('mongoose-auto-increment');

var connection = mongoose.createConnection('mongodb://localhost/RiceBikes');

autoIncrement.initialize(connection);

var TransactionSchema = new mongoose.Schema({
    description: String,
    date_created: Date,
    transaction_type: String,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer'},
    bikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bike'}],
    repairs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Repair'}],
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item'}]
});

var autoPopulate = function (next) {
    this.populate('customer');
    this.populate('bikes');
    next();
};

TransactionSchema.plugin(autoIncrement.plugin, 'Transaction');

TransactionSchema.pre('find', autoPopulate);
TransactionSchema.pre('findOne', autoPopulate);

mongoose.model('Transaction', TransactionSchema);

module.exports = mongoose.model('Transaction');