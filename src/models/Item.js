var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
  category: String,
  size: String,
  name: {type:String,required:true},
  description: String,
  standard_price: {type:Number,required:true},
  wholesale_cost:Number,
  quantity:{type:Number,default:0},
  warning_quantity:Number
});
// text index lets us search by name
ItemSchema.index({name:'text'});
mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');
