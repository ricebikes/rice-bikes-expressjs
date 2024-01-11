var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
    name: { type: String, required: true}, // can't be null (or can it)
    upc: { type: String, unique: true, validate: { 
        validator: function(v) {
            return /[0-9]/.test(v);
        },
        message: '{VALUE} is not a number'
    }}, // numeric 0-9
    category_1: { type: String, required: true }, // can't be null
    category_2: String,
    category_3: String,
    disabled: Boolean,
    brand: { type: String, required: true }, // can't be null
    specifications: { type: Map, of: String }, //dict,
    features: [String], // array of strings
    standard_price: Number,
    wholesale_cost: Number,
    in_stock: Number,
    threshold_stock: Number,

    last_updated: Date,
});

ItemSchema.index({ name: "text"});
ItemSchema.index({ upc: 1 }, {unique: true});
ItemSchema.index({ category_1: 1, category_2: 1, category_3: 1}, {unique: true});

mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');
