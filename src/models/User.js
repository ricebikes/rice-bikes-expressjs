var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
    first_name: String,
    last_name: String,
    email: String,
    username: String,
    password: String,
    admin: {type: Boolean, default: false}
});

mongoose.model('User', UserSchema);

module.exports = mongoose.model('User');