var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var User = require('./../models/User');

router.use(bodyParser.urlencoded({ extended: true }));

router.post('/', function (req, res) {
    User.create({
            name : req.body.name,
            email : req.body.email,
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

module.exports = router;