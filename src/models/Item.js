var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number
});

mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');