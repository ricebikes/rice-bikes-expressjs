var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
    name: {type: String, required: true},
    upc: Number,
    category: String,
    brand: String,
    description: String, // keeping this for backwards compatibility, but aiming to phase out its usage
    condition: String,
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
