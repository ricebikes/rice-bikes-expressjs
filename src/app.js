var express = require('express');
var cors = require('cors');
var morgan = require('morgan');
var db = require('./db'); // Enables settings for mongodb

const AnalyticsController = require('./controllers/AnalyticsController');
const AuthController = require('./controllers/AuthController');
const UserController = require('./controllers/UserController');
const TransactionController = require('./controllers/TransactionController');
const RepairController = require('./controllers/RepairController');
const ItemController = require('./controllers/ItemController');
const CustomerController = require('./controllers/CustomerController');
const OrderController = require('./controllers/OrderController');
const OrderRequestController = require('./controllers/OrderRequestController');
const BikeController = require('./controllers/BikeController');

/* Create app */
var app = express();

/* Add plugin to enable CORS */
app.use(cors());

/* Add plugin to enable HTTP logging */
app.use(morgan('combined'));


/* Register routes */
app.use('/api/metrics', AnalyticsController.router); // do not use analytics as endpoint, firefox has bug
app.use('/api/auth', AuthController.router);
app.use('/api/users', UserController.router);
app.use('/api/transactions', TransactionController.router);
app.use('/api/items', ItemController.router);
app.use('/api/repairs', RepairController.router);
app.use('/api/customers', CustomerController.router);
app.use('/api/orders',OrderController.router);
app.use('/api/order-requests', OrderRequestController.router);
app.use('/api/bikes', BikeController.router);

module.exports = app;