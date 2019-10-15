var express = require('express');
var jwt = require('jsonwebtoken');
var router = express.Router();
var bodyParser = require('body-parser');
var User = require('./../models/User');
var config = require('../config')();
var app = require('../app');
var authMiddleware = require('../middleware/AuthMiddleware');
var adminMiddleware = require('../middleware/AdminMiddleware');

router.use(bodyParser.json());
router.use(authMiddleware);



/*
Create a user.
 */
router.post('/',adminMiddleware);
router.post('/', function (req, res) {
    User.create({username: req.body.username, roles:req.body.roles}, function (err, newUser) {
      if (err) res.status(500);
      res.status(200).send(newUser);
    });
  });

/*
Gets all users - "GET /user"
 */
// NOTE: this function does not use admin middleware. It is not protected and any user can access this endpoint
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
router.delete('/:user_id',adminMiddleware);
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
