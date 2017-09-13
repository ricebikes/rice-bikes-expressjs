var mongoose = require('mongoose');

var RepairSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number
});

mongoose.model('Repair', RepairSchema);

module.exports = mongoose.model('Repair');