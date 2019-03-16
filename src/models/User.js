var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
  username: String,
  name: String,
  roles: [String]
});

mongoose.model('User', UserSchema);

module.exports = mongoose.model('User');
