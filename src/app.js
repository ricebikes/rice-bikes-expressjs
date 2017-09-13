var express = require('express');
var app = express();
var db = require('./db');
var UserController = require('./controllers/UserController');
var TransactionController = require('./controllers/TransactionController');
var RepairController = require('./controllers/RepairController');

app.use('/users', UserController);
app.use('/transactions', TransactionController);
app.use('/items', RepairController);

module.exports = app;