var mongoose = require('mongoose');
var Customer = require('./Customer');
var Bike = require('./Bike');
var Repair = require('./Repair');
var Item = require('./Item');

var TransactionSchema = new mongoose.Schema({
    description: String,
    date_created: Date,
    customer: Customer,
    bikes: [Bike],
    repairs: [Repair],
    items: [Item]
});

TransactionSchema.index({'$**': 'text'});

mongoose.model('Transaction', TransactionSchema);

module.exports = mongoose.model('Transaction');