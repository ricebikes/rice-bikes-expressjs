var express = require('express');
var app = express();
var db = require('./db');
var UserController = require('./controllers/UserController');
var TransactionController = require('./controllers/TransactionController');

app.use('/users', UserController);
app.use('/transactions', TransactionController);

module.exports = app;