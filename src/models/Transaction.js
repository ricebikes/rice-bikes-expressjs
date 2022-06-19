const mongoose = require('mongoose');
const autoIncrement = require('mongoose-plugin-autoinc');
const _ = require('underscore');
const config = require('../config');

var connection = mongoose.createConnection(config.db_uri);

var TransactionSchema = new mongoose.Schema({
  description: String,
  transaction_type: String,
  date_created: Date,
  date_completed: Date,
  total_cost: { type: Number, default: 0 },
  // If this is an employee we want to apply tax to the transaction
  employee: { type: Boolean, default: false },
  complete: { type: Boolean, default: false },
  is_paid: { type: Boolean, default: false },
  refurb: { type: Boolean, default: false },
  beerbike: { type: Boolean, default: false },
  paymentType: { type: [String], default: [] },
  waiting_email: { type: Boolean, default: false },
  urgent: { type: Boolean, default: false },
  orderRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrderRequest' }],
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  bikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bike' }],
  repairs: [{ repair: { type: mongoose.Schema.Types.ObjectId, ref: 'Repair' }, completed: Boolean }],
  items: [{ item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' }, price: Number }],
  actions: [{
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    description: String,
    time: Date,
  }]
});

// function which populates references with real data and updates values.
var autoPopulate = function (next) {
  this.populate('customer');
  this.populate('bikes');
  this.populate('repairs.repair');
  this.populate('items.item');
  this.populate('orderRequests');
  this.populate('actions.employee'); // user ref of action
  next();
};

// use plugin so transactions have small integer ID
TransactionSchema.plugin(autoIncrement.plugin, 'Transaction');

// before querying or saving, populate the references
TransactionSchema.pre('find', autoPopulate);
TransactionSchema.pre('findOne', autoPopulate);
TransactionSchema.pre('save', autoPopulate);

mongoose.model('Transaction', TransactionSchema);

module.exports = mongoose.model('Transaction');
