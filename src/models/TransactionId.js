var mongoose = require('mongoose');

var TransactionIdSchema = new mongoose.Schema({
    _id: {type: String, required: true},
    count:  { type: Number, default: 0 }
});

mongoose.model('TransactionId', TransactionIdSchema);

module.exports = mongoose.model('TransactionId');