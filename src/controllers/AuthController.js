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
    var url = `${config.CASValidateURL}?ticket=${ticket}&service=${config.CASthisServiceURL}`;
    request(url, function (err, response, body) {

      if (err) return res.status(500).send();

      // parse the XML.
      // notice the second argument - it's an object of options for the parser, one to strip the namespace
      // prefix off of tags and another to prevent the parser from creating 1-element arrays.
      xmlParser(body, { tagNameProcessors: [stripPrefix], explicitArray: false }, function (err, result) {
        if (err) return res.status(500).send();

        serviceResponse = result.serviceResponse;

        var authSucceeded = serviceResponse.authenticationSuccess;
        if (authSucceeded) {
          // see if this netID is in the list of users.
          User.findOne({ username: authSucceeded.user }, function (err, user) {
            if (err) return res.status(500).send();
            if (!user) {
              return res.status(401).json({ success: false, message: "Your net ID is not listed as a mechanic" })
            }
            //quick explanation of a JWT: essentially a symmetrically encrypted key, designed to be readable by anyone
            // but not allow them to modify its contents. JWT is signed with the key "secret"
            // we will sign the Rice IDP payload, as well as our own payload from the mongodb database
            let token = jwt.sign({
              user: {
                username: user.username,
                roles: user.roles,
              },
              idp_data: authSucceeded
            }, config.secret);
            // send our token to the frontend! now, whenever the user tries to access a resource, we check their
            // token by verifying it and seeing if the username contained in the token allows this user to access
            // the requested resource.
            return res.json({
              success: true,
              message: 'CAS authentication success',
              token: token
            });
          });
        } else if (serviceResponse.authenticationFailure) {
          return res.status(401).json({ success: false, message: 'CAS authentication failed' });
        } else {
          return res.status(500).send();
        }
      })
    })
  } else {
    return res.status(400).send();
  }
});

module.exports = { router: router };