var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
  category:{type:String,required:true},
  name: {type:String,required:true},
  description: String,
  price: {type:Number,required:true},
  shop_cost:Number,
  quantity:{type:Number,default:0}
});

ItemSchema.index({name: 'text'});
mongoose.model('Item', ItemSchema);

module.exports = mongoose.model('Item');
