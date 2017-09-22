var express = require('express');
var jwt = require('jsonwebtoken');
var router = express.Router();
var bodyParser = require('body-parser');
var User = require('./../models/User');
var config = require('../config');

router.use(bodyParser.json());

router.post('/', function (req, res) {
    User.create({
            first_name : req.body.first_name,
            last_name: req.body.last_name,
            email : req.body.email,
            username: req.body.username,
            password : req.body.password
        },
        function (err, user) {
            if (err) return res.status(500).send("There was a problem adding the information to the database.");
            res.status(200).send(user);
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
Authenticates a user, returning a token if the username and password match.

The token is then stored in the browser until the session expires. All requests after authenticating are made using this
token, which we verify before processing the request.
 */
router.post('/authenticate', function(req, res) {
   User.findOne({ username: req.body.username }, function(err, user) {
       if (err) res.status(500);
       if (!user) res.json({ success: false, message: 'Email not found' });

       if (user.password != req.body.password) {
           res.json({success: false, message: 'Incorrect password'})
       }

       var token = jwt.sign(user, app.get('secret'), { expiresInMinutes: 1440 });

       res.json({
           success: true,
           message: 'Authenticated',
           token: token
       });
   })
});

module.exports = router;