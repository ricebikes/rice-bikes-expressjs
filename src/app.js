var express = require('express');
var db = require('./db');
var cors = require('cors');
var morgan = require('morgan');
var UserController = require('./controllers/UserController');
var TransactionController = require('./controllers/TransactionController');
var RepairController = require('./controllers/RepairController');
var ItemController = require('./controllers/ItemController');
var CustomerController = require('./controllers/CustomerController');

var app = express();
app.use(cors());
app.use(morgan('combined'));

app.use('/users', UserController);
app.use('/transactions', TransactionController);
app.use('/items', ItemController);
app.use('/repairs', RepairController);
app.use('/customers', CustomerController);

module.exports = app;