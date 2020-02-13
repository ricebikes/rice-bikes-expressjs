var express = require('express');
var cors = require('cors');
var morgan = require('morgan');
var mailer = require('express-mailer');

var config = require('./config')();
var db = require('./db');

const AnalyticsController = require('./controllers/AnalyticsController');
const AuthController = require('./controllers/AuthController');
const UserController = require('./controllers/UserController');
const TransactionController = require('./controllers/TransactionController');
const RepairController = require('./controllers/RepairController');
const ItemController = require('./controllers/ItemController');
const CustomerController = require('./controllers/CustomerController');

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
app.use('/api/analytics', AnalyticsController);
app.use('/api/auth', AuthController);
app.use('/api/users', UserController);
app.use('/api/transactions', TransactionController);
app.use('/api/items', ItemController);
app.use('/api/repairs', RepairController);
app.use('/api/customers', CustomerController);

module.exports = app;
