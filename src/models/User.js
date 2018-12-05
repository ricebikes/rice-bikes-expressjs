var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
  username: String,
  roles: [String]
});

mongoose.model('User', UserSchema);

module.exports = mongoose.model('User');