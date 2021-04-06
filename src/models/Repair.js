var mongoose = require('mongoose');

var RepairSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  disabled: {type: Boolean, default: false}
});

RepairSchema.index({name: 'text'});
mongoose.model('Repair', RepairSchema);

module.exports = mongoose.model('Repair');
