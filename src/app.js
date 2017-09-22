var express = require('express');
var cors = require('cors');
var morgan = require('morgan');

var db = require('./db');
var config = require('./config');
var UserController = require('./controllers/UserController');
var TransactionController = require('./controllers/TransactionController');
var RepairController = require('./controllers/RepairController');
var ItemController = require('./controllers/ItemController');
var CustomerController = require('./controllers/CustomerController');
var AuthController = require('./controllers/AuthController');

var app = express();

/* Plugin to enable CORS */
app.use(cors());

/* Plugin to enable HTTP logging */
app.use(morgan('combined'));

app.use('/users', UserController);
app.use('/transactions', TransactionController);
app.use('/items', ItemController);
app.use('/repairs', RepairController);
app.use('/customers', CustomerController);

// app.all('/', AuthController);

module.exports = app;