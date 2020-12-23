var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
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
    desired_stock: { type: Number, required: true },
    // minimum stock is optional, but if set should be considered a "rush order" value-- if item stock goes below this, item must be ordered as soon as possible
    minimum_stock: { type: Number, default: 0},
    stock: { type: Number, default: 0 },
});
// text index lets us search by name
ItemSchema.index({ name: 'text' });
ItemSchema.index({ category: 1 });
mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');
