const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const Bike = require('./../models/Bike');
const authMiddleware = require('../middleware/AuthMiddleware');

router.use(bodyParser.json());
router.use(authMiddleware);

/**
 * GET: /search - search for bikes by their make, model, or by either via a search string
 * url parameters:
 * make- make of the bike
 * model- model of the bike
 * search- string to search all text indexes of the bike (make, model, and description)
 */
router.get('/search', async (req, res) => {
    let query = {};
    if (req.query.make) query['make'] = req.query.make;
    if (req.query.model) query['model'] = req.query.model;
    if (req.query.search) query['$text']= {$search: req.query.search};
    try {
        const bikes = await Bike.find(query)
        return res.status(200).json(bikes);
    } catch(err) {
        res.status(500).json(err);
    }
});

module.exports = { router: router }