var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
  supplier: String,
  upc : Number,
  category: String,
  name: {type:String,required:true},
  description: String,
  standard_price: {type:Number,required:true},
  wholesale_cost:Number,
  stock:{type:Number,default:0},
});
// text index lets us search by name
ItemSchema.index({name:'text'});
mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');
