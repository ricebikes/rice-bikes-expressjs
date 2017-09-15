var mongoose = require('mongoose');
var transactionId = require('./TransactionId');

var TransactionSchema = new mongoose.Schema({
    _id: {type: Number, required: true},
    description: String,
    date_created: Date,
    transaction_type: String,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer'},
    bikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bike'}],
    repairs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Repair'}],
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item'}]
});

var nextId = function (next) {
    var doc = this;
    transactionId.findAndModify(
        {
            query: {
                _id: 'transactionid'
            },
            update: {
                $inc: {
                    count: 1
                }
            },
            new: true
        }, function (err, id) {
            console.log(id);
            doc._id = id.count;
            next();
        }
    );
};

var autoPopulate = function (next) {
    this.populate('customer');
    this.populate('bikes');
    next();
};

TransactionSchema.pre('find', autoPopulate);
TransactionSchema.pre('findOne', autoPopulate);
TransactionSchema.pre('init', nextId);

mongoose.model('Transaction', TransactionSchema);

module.exports = mongoose.model('Transaction');