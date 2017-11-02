var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
var request = require('request');
var xmlParser = require('xml2js').parseString;
var stripPrefix = require('xml2js').processors.stripPrefix;

var config = require('../config');

var User = require('../models/User');

router.use(bodyParser.json());

/**
 * After the browser is redirected by the IDP, the frontend takes the ticket off the URL and sends a GET
 * request to the backend, here, with the ticket as a query parameter. Here, we validate the ticket against
 * the CAS server and then parse the response to see if we succeeded, and let the frontend know.
 */
router.get('/', function (req, res) {

    var ticket = req.query.ticket;

    if (ticket) {
        // validate our ticket against the CAS server
        // noinspection JSAnnotator
        var url = `${config.CASValidateURL}?ticket=${ticket}&service=${config.thisServiceURL}`;
        request(url, function(err, response, body) {

            if (err) return res.status(500);

            // parse the XML.
            // notice the second argument - it's an object of options for the parser, one to strip the namespace
            // prefix off of tags and another to prevent the parser from creating 1-element arrays.
            xmlParser(body, { tagNameProcessors: [stripPrefix], explicitArray: false }, function (err, result) {
                if (err) return res.status(500);

                serviceResponse = result.serviceResponse;

                var authSucceded = serviceResponse.authenticationSuccess
                if (authSucceded) {
                    // here, we create a token with the user's info as its payload.
                    // authSucceded contains: { user: <username>, attributes: <attributes>}
                    var token = jwt.sign({ data: authSucceded }, config.secret);

                    // see if this netID is in the list of users.
                    User.findOne({ username: authSucceded.user }, function (err, user) {
                        if (err) return res.status(500);
                        if (!user) {
                            return res.status(401).json({ success: false, message: "Your netID is not listed as a mechanic"})
                        }
                    });

                    // send our token to the frontend! now, whenever the user tries to access a resource, we check their
                    // token by verifying it and seeing if the payload (the username) allows this user to access
                    // the requested resource.
                    res.json({
                        success: true,
                        message: 'CAS authentication success',
                        user: {
                            username: authSucceded.user,
                            token: token
                        }
                    });

                } else if (serviceResponse.authenticationFailure) {
                    res.status(401).json({ success: false, message: 'CAS authentication failed' });
                } else {
                    res.status(500);
                }
            })
        })
    } else {
        return res.status(400);
    }
});

module.exports = router;