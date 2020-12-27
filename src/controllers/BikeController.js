const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const Bike = require('./../models/Bike');
const authMiddleware = require('../middleware/AuthMiddleware');

router.use(bodyParser.json());
router.use(authMiddleware);

/**
 * GET: /search - search for bikes by their make or model
 * url parameters:
 * make- make of the bike
 * model- model of the bike
 */
router.get('/search', async (req, res) => {
    let query = {};
    if (req.query.make) query['make'] = req.query.make;
    if (req.query.model) query['model'] = req.query.model;
    try {
        const bikes = await Bike.find(query)
        return res.status(200).json(bikes);
    } catch(err) {
        res.status(500).json(err);
    }
});

module.exports = { router: router }