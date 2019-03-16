let mongoose = require('mongoose');

let ActionSchema =  new mongoose.Schema({
    employee: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    description: String,
    time: Date
});


mongoose.model('Action',ActionSchema);

module.exports = mongoose.model('Action');
