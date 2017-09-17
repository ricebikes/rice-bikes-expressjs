var mongoose = require('mongoose');
var autoIncrement = require('mongoose-auto-increment');
var _ = require('underscore');

var connection = mongoose.createConnection('mongodb://localhost/RiceBikes');

autoIncrement.initialize(connection);

var TransactionSchema = new mongoose.Schema({
    description: String,
    date_created: Date,
    transaction_type: String,
    complete: {type: Boolean, default: false},
    date_completed: Date,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer'},
    bikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bike'}],
    repairs: [{ repair: {type: mongoose.Schema.Types.ObjectId, ref: 'Repair'}, completed: Boolean }],
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