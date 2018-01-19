var express = require('express');
var cors = require('cors');
var morgan = require('morgan');
var mailer = require('express-mailer');

var db = require('./db');
var config = require('./config');

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
    from: "wbqhktpovp2flwjo@ethereal.email",
    host: "smtp.ethereal.email",
    port: 587,
    transportMethod: 'SMTP',
    auth: {
        user: 'wbqhktpovp2flwjo@ethereal.email',
        pass: 'mS7G33CBwcjFsDwc3Z'
    }
});

/* Register routes */
app.use('/api/auth', AuthController);
app.use('/api/users', UserController);
app.use('/api/transactions', TransactionController);
app.use('/api/items', ItemController);
app.use('/api/repairs', RepairController);
app.use('/api/customers', CustomerController);

module.exports = app;