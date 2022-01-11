var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  username: String,
  active: Boolean,
  roles: [String]
});

mongoose.model('User', UserSchema);

module.exports = mongoose.model('User');