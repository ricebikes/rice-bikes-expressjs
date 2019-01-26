var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
  name: {type:String,required:true},
  description: String,
  price: {type:Number,required:true},
  shop_cost:Number,
  quantity:{type:Number,default:0},
  warning_quantity:Number
});

ItemSchema.index({name: 'text'});
mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');
