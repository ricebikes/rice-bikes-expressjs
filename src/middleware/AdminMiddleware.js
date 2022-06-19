var express = require('express');
var jwt = require('jsonwebtoken');
var authRouter = express.Router();
var bodyParser = require('body-parser');

var User = require('../models/User');
var config = require('../config');

authRouter.use(bodyParser.json());

// This middleware handles user roles. It will reject users from making API
// requests when their JWT is invalid or does not contain required roles.


// use middleware to block non admin users from access to admin page

authRouter.use('/',function (req, res, next) {
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
                let username = decoded.user.username;
                // first do a check to make sure user is in database (so someone cannot use an old token with admin privileges
                User.findOne({username:username},function (err,user) {
                    if(err) return res.status(500).send("error finding your username in the database");
                    if(!user) return res.status(401).send("You are not authorized to access this resource");
                    // now if we make it here we can check for admin privileges
                    if(user_roles.includes('admin')){
                        // user is permitted to access this resource!
                        next();
                    }else{
                        return res.status(401).json(
                            {success: false,
                                message: 'Your token appears valid, but your are not permitted to access this resource'});
                    }
                });
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
