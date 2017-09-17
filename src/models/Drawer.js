var mongoose = require('mongoose');

var DrawerSchema = new mongoose.Schema({
    date_created: Date,
    date_closed: Date,
    is_open: Boolean,
    transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction'}]
});

mongoose.model('Drawer', DrawerSchema);

module.exports = mongoose.model('Drawer');