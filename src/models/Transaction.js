var mongoose = require('mongoose');
var autoIncrement = require('mongoose-auto-increment');
var _ = require('underscore');
var config = require('../config')();

var connection = mongoose.createConnection(config.db_uri);
autoIncrement.initialize(connection);

var TransactionSchema = new mongoose.Schema({
  description: String,
  transaction_type: String,
  date_created: Date,
  date_completed: Date,
  complete: {type: Boolean, default: false},
  is_paid: {type: Boolean, default: false},
    refurb: {type:Boolean, default:false},
  waiting_part: {type: Boolean, default: false},
  waiting_email: {type: Boolean, default: false},
  urgent : {type : Boolean, default: false},
  total_cost: {type: Number, default: 0},
  customer: {type: mongoose.Schema.Types.ObjectId, ref: 'Customer'},
  bikes: [{type: mongoose.Schema.Types.ObjectId, ref: 'Bike'}],
  repairs: [{repair: {type: mongoose.Schema.Types.ObjectId, ref: 'Repair'}, completed: Boolean}],
  items: [{type: mongoose.Schema.Types.ObjectId, ref: 'Item'}],
  actions: [{
    employee: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    description: String,
    time: Date,
  }]
});

// function which populates references with real data and updates values.
var autoPopulate = function (next) {
  this.populate('customer');
  this.populate('bikes');
  this.populate('repairs.repair');
  this.populate('items');
  // need to populate user ref of actions
  this.populate('actions.employee');
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
