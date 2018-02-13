var express = require('express');
var cors = require('cors');
var morgan = require('morgan');
var mailer = require('express-mailer');

var config = require('./config');
var db = require('./db');

var AuthController = require('./controllers/AuthController');
var UserController = require('./controllers/UserController');
var TransactionController = require('./controllers/TransactionController');
var RepairController = require('./controllers/RepairController');
var ItemController = require('./controllers/ItemController');
var CustomerController = require('./controllers/CustomerController');

/* Create app */
var app = express();

/* Add plugin to enable CORS */
app.use(cors());

/* Add plugin to enable HTTP logging */
app.use(morgan('combined'));

app.set('views', __dirname + '/controllers');

/* Set the template rendering engine to Pug - used for email rendering */
app.set('view engine', 'pug');

/* Set up plugin to enable emailing */
mailer.extend(app, {
  from: config.email.user,
  host: config.email.host,
  port: config.email.port,
  transportMethod: 'SMTP',
  auth: {
    user: config.email.user,
    pass: config.email.pass
  }
});

/* Register routes */
app.use('/auth', AuthController);
app.use('/users', UserController);
app.use('/transactions', TransactionController);
app.use('/items', ItemController);
app.use('/repairs', RepairController);
app.use('/customers', CustomerController);

module.exports = app;