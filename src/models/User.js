var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
    username: String,
    admin: Boolean
});

mongoose.model('User', UserSchema);

module.exports = mongoose.model('User');