var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
    name: {type: String, required: true},
    upc: Number,
    category: {type: String, default: "Uncategorized"},
    size: String,
    brand: String,
    description: String,
    condition: {type: String, default: "New"},
    standard_price: {type: Number, required: true},
    wholesale_cost: Number,
    hidden: {type: Boolean, default: false},
    desired_stock: {type: Number, required: true},
    stock: {type: Number, default: 0},
});
// text index lets us search by name
ItemSchema.index({name: 'text'});
ItemSchema.index({category: 1});
mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');
