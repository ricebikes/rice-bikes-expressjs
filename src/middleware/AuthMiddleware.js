var express = require('express');
var jwt = require('jsonwebtoken');
var authRouter = express.Router();
var bodyParser = require('body-parser');

var config = require('../config');

authRouter.use(bodyParser.json());

authRouter.use(function (req, res, next) {

  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  if (token) {
    jwt.verify(token, config.secret, function (err, userData) {
      if (err) {
        return res.status(401).json({success: false, message: 'Failed to authenticate token'});
      } else {
        req.userData = userData.data;
        next();
      }
    });
  } else {
    return res.status(401).send({
      success: false,
      message: 'No token provided.'
    });
  }
});

module.exports = authRouter;