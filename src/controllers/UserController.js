var express = require('express');
var jwt = require('jsonwebtoken');
var router = express.Router();
var bodyParser = require('body-parser');
var User = require('./../models/User');
var config = require('../config')();
var app = require('../app');
var authMiddleware = require('../middleware/AuthMiddleware');

router.use(bodyParser.json());
router.use(authMiddleware);

// add middleware function to prevent non-admins from using this page

router.use('/',function (req, res, next) {
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
var checkIfAdmin = function (req, res, next) {
  User.findOne({username: req.userData.username}, function (err, user) {
    if (err) return res.status(500).send();
    if (!user) return res.status(404).send();
    if (!user.admin) {
      return res.status(401).send();
    }
    next();
  });
};

/*
Create a user.
 */
router.post('/', function (req, res) {
    User.create({username: req.body.username, roles:req.body.roles}, function (err, newUser) {
      if (err) res.status(500);
      res.status(200).send(newUser);
    });
  });

/*
Gets all users - "GET /user"
 */
router.get('/', function (req, res) {
  User.find({}, function (err, users) {
    if (err)
      return res.status(500).send("There was a problem finding the users.");
    res.status(200).send(users);
  });
});

/*
Delete a user.
 */
router.delete('/:user_id', function (req, res) {
    User.findById(req.params.user_id, function (err, user) {
      if (err) res.status(500).send();
      if (!user) res.status(404).send();
      user.remove(function (err) {
        if (err) res.status(500).send("There was a problem deleting the user")
      });
      res.status(200).end();
    });
  });


/*
Authenticates a user, returning a token if the username and password match.

The token is then stored in the browser until the session expires. All requests after authenticating are made using this
token (in the headers 'x-access-token' or the body 'token'), which we verify before processing the request.
 */
router.post('/authenticate', function (req, res) {
  User.findOne({username: req.body.username}, function (err, user) {
    if (err) res.status(500);
    if (!user) {
      res.status(401).json({success: false, message: 'Email not found'});
      return;
    }

    if (user.password !== req.body.password) {
      res.status(401).json({success: false, message: 'Incorrect password'});
      return;
    }

    var token = jwt.sign({data: user}, config.secret, {expiresIn: '24h'});

    res.json({
      success: true,
      message: 'Authenticated',
      token: token
    });
  })
});


module.exports = router;