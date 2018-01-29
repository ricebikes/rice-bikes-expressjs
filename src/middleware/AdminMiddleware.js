var express = require('express');
var jwt = require('jsonwebtoken');
var authRouter = express.Router();
var bodyParser = require('body-parser');

var User = require('../models/User');
var config = require('../config');

authRouter.use(bodyParser.json());

authRouter.use(function (req, res, next) {
  User.findOne({username: req.userData.user}, function (err, user) {
    if (err) return res.status(500).send();
    if (!user) return res.status(404).send();
    if (!user.admin) return res.status(401).send();
    next();
  });
});

module.exports = authRouter;