var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  username: String,
  name: String,
  roles: [String]
});

mongoose.model('User', UserSchema);

module.exports = mongoose.model('User');
