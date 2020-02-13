var express = require('express');
/* Wrap our router in our auth protocol */
const router = express.Router();
const authMiddleware = require('../middleware/AuthMiddleware');
const adminMiddleware = require('../middleware/AdminMiddleware');
const bodyParser = require('body-parser');
const moment = require('moment');
const csv = require('csv');

const Transaction = require('./../models/Transaction');

router.use(bodyParser.json());
router.use(authMiddleware);
router.use(adminMiddleware); // require all users to have admin privileges to  connect to analytics


/**
 * GET: /transactions/daterange
 * optional query parameters: start and end, both as unix epoch timestamps
 * controls the start and end dates for the transaction export range
 * (dates are based on transaction completion)
 * if start is not provided, 0 is assumed (unix epoch)
 * if end it not provided, current time is use
 *
 * returns as csv file with the relevant transactions
 */
router.get('/transactions/daterange', async (req, res) => {
    try {
        let start = 0;
        let end = Date.now();
        if (req.query.start) start = parseInt(req.query.start);
        if (req.query.end) end = parseInt(req.query.end);
        if (isNaN(start) || isNaN(end)) return res.status(400).send("Bad date format, unix timestamp expected");
        const query = {date_completed: {$gt: new Date(start), $lt: new Date(end)}}; //range of completion dates
        const projection = {_id: 1, date_created: 1, date_completed: 1, total_cost: 1}; // only return these fields
        const transactionsStream = Transaction.find(query, projection).cursor();
        const startString = moment(start).format("MM/DD/YYYY"); // date formatting for nice filename
        const endString = moment(end).format("MM/DD/YYYY"); // date formatting for nice filename
        const filename = `Transactions_${startString}-${endString}`;
        // transformer function lets us extract relevant transaction data for CSV sheet
        const transformer = function(input_transaction) {
            return {
                  Number: input_transaction._id,
                 "Date Created": input_transaction.date_created,
                 "Date Completed": input_transaction.date_completed,
                 "Total Cost": input_transaction.total_cost
            };
        };
        // set headers so that client knows content type
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.writeHead(200, { 'Content-Type': 'text/csv' });
        // flush the headers before we start pushing the CSV content (to write the ones we have set)
        res.flushHeaders();
        // pipe the transaction stream we got from mongo through a transform function and the CSV library to send it
        transactionsStream.pipe(csv.transform(transformer))
            // this takes the object and makes it a CSV string
            .pipe(csv.stringify({header:true}))
            // this sends the object to the user
            .pipe(res)
    } catch (err) {
        return res.status(500).send(err);
    }
});

module.exports = router;
