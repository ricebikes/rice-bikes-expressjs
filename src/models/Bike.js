var mongoose = require('mongoose');

var BikeSchema = new mongoose.Schema({
    make: String,
    model: String,
    description: String
});

BikeSchema.index({'$**': 'text'});
mongoose.model('Bike', BikeSchema);

module.exports = mongoose.model('Bike');