var express = require('express');
var jwt = require('jsonwebtoken');
var authRouter = express.Router();
var bodyParser = require('body-parser');

var User = require('../models/User');
var config = require('../config')();

// This middleware handles user roles. It will reject users from making API
// requests when their JWT is invalid or does not contain required roles.

authRouter.use(bodyParser.json());

// user admin api
// blocks users without admin role from using the user admin page
authRouter.use('/api/users/*',function (req, res, next) {
    // verify user token
    let token = req.body.token || req.query.token || req.headers['x-access-token'];
    if(token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                // kick back error from JWT verification
                return res.status(401).json({success: false, message: 'Failed to authenticate token'});
            } else {
                // we got a valid token, see if the user can authenticate against this resource
                let user_roles = decoded.user.roles;
                if(user_roles.includes('admin')){
                    // user is permitted to access this resource!
                    req.user_roles = user_roles;
                    next();
                }else{
                    return res.status(401).json(
                        {success: false,
                            message: 'Your token appears valid, but your are not permitted to access this resource'});
                }
            }
        })
    }else {
        return res.status(401).json({
            success: false,
            message: 'No Token Provided'
        })
    }
});

module.exports = authRouter;