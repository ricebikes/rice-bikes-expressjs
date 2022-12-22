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
    brand: { type: String, required: true }, // can't be null
    specifications: { type: Map, of: String }, //dict,
    features: [String], // array of strings
    standard_price: Number,
    wholesale_cost: Number
});

ItemSchema.index({ name: "text"});
ItemSchema.index({ upc: 1 }, {sparse: true}); // sparse should be false if it's required...
ItemSchema.index({ category_1: 1, category_2: 1, category_3: 1});
/*** OLD ***/

/*var ItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    upc: Number,
    category: { type: String, default: "Uncategorized" },
    size: String,
    brand: String,
    description: String,
    condition: { type: String, default: "New" },
    standard_price: { type: Number, required: true },
    wholesale_cost: Number,
    disabled: { type: Boolean, default: false },
    // Managed items are special items only the backend should be adding and removing from transactions
    managed: { type: Boolean, default: false },
    // If item drops below desired stock, an active order request will be created for it automatically
    desired_stock: { type: Number, required: true, default: 0},
    // minimum stock is optional, but if set should be considered a "rush order" value-- if item stock goes below this, item must be ordered as soon as possible
    minimum_stock: { type: Number, default: 0},
    stock: { type: Number, default: 0 },
});

// text index lets us search by name
ItemSchema.index({ name: 'text' });
ItemSchema.index({ category: 1 });
*/

mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');
