var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
    name: {type: String, required: true},
    upc: Number,
    category: String,
    description: {type: String, required: true},
    standard_price: {type: Number, required: true},
    wholesale_cost: Number,
    hidden: {type: Boolean, default: false},
    stock: {type: Number, default: 0},
});
// text index lets us search by name
ItemSchema.index({description: 'text'});
ItemSchema.index({upc: 1});
ItemSchema.index({category: 1});
mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');
