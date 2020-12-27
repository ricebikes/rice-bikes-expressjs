const express = require('express');
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
 * Utility function to parse dates from request, and return them as an object
 * if start or end is not provided in req, default values of 0 and the current time are used respectively
 * @param req: request from expressjs
 */
function getDates(req) {
    let start = 0;
    let end = Date.now();
    if (req.query.start) start = parseInt(req.query.start);
    if (req.query.end) end = parseInt(req.query.end);
    if (isNaN(start) || isNaN(end)) throw "Bad date format, unix timestamp expected";
    //range of completion dates
    return { start: start, end: end };
}

/**
 * GET: /transactions/daterange?start&end
 * optional query parameters: start and end, both as unix epoch timestamps
 * controls the start and end dates for the transaction export range
 * (dates are based on transaction completion)
 * if start is not provided, 0 is assumed (unix epoch)
 * if end it not provided, current time is used
 *
 * returns as csv file with the relevant transactions
 */
router.get('/transactions/daterange', async (req, res) => {
    try {
        const dates = getDates(req);
        const projection = { _id: 1, date_created: 1, date_completed: 1, total_cost: 1 }; // only return these fields
        const query = { date_completed: { $gt: dates.start, $lt: dates.end } };
        const transactionsStream = Transaction.find(query, projection).cursor();
        const startString = moment(dates.start).format("MM-DD-YYYY"); // date formatting for nice filename
        const endString = moment(dates.end).format("MM-DD-YYYY"); // date formatting for nice filename
        const filename = `Transactions_${startString}-${endString}.csv`;
        // transformer function lets us extract relevant transaction data for CSV sheet
        const transformer = function (input_transaction) {
            return {
                "Number": input_transaction._id,
                "Date-Created": moment(input_transaction.date_created).format('MM/DD/YYYY HH:mm:ss'),
                "Date-Completed": moment(input_transaction.date_completed).format('MM/DD/YYYY HH:mm:ss'),
                "Total-Cost": input_transaction.total_cost
            };
        };
        // set headers so that client knows content type
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        // lets client view the content-disposition header with the filename
        res.setHeader('Access-Control-Expose-Headers', 'Content-disposition');
        res.writeHead(200, { 'Content-Type': 'text/csv' });
        // flush the headers before we start pushing the CSV content (to write the ones we have set)
        res.flushHeaders();
        // pipe the transaction stream we got from mongo through a transform function and the CSV library to send it
        transactionsStream.pipe(csv.transform(transformer))
            // this takes the object and makes it a CSV string
            .pipe(csv.stringify({ header: true }))
            // this sends the object to the user
            .pipe(res)
    } catch (err) {
        return res.status(500).json(err);
    }
});

/**
 * GET: /employees/groupmetrics?start&end
 * optional query parameters: start and end, both as unix epoch timestamps.
 * controls the start and end dates for the range of transactions to be analyzed
 * (dates are based on transaction completion)
 * if start is not provided, 0 is assumed (unix epoch)
 * if end it not provided, current time is used
 */
router.get('/employees/groupmetrics', async (req, res) => {
    try {
        const dates = getDates(req);
        const projection = { actions: 1 }; // only return these fields
        const query = { date_created: { $gt: dates.start, $lt: dates.end } };
        const transactions = await Transaction.find(query, projection);
        const startString = moment(dates.start).format("MM-DD-YYYY"); // date formatting for nice filename
        const endString = moment(dates.end).format("MM-DD-YYYY"); // date formatting for nice filename
        const filename = `All_Employee_Metrics_${startString}-${endString}.csv`;
        // iterate through transactions so that we can count actions of each employee
        let employeeActions = {};
        const repairReg = new RegExp("Completed Repair");
        const completeReg = new RegExp("Completed Transaction");
        for (let transaction of transactions) {
            // iterate through each action
            for (let action of transaction.actions) {
                // check to make sure that there is a value for this user in the object
                const userFullName = `${action.employee.firstname} ${action.employee.lastname}`;
                if (employeeActions[userFullName] === undefined) {
                    employeeActions[userFullName] = { repairsCompleted: 0, transactionsCompleted: 0 };
                }
                if (repairReg.test(action.description)) {
                    // the user completed a repair, count this.
                    employeeActions[userFullName].repairsCompleted++;
                }
                if (completeReg.test(action.description)) {
                    employeeActions[userFullName].transactionsCompleted++;
                }
            }
        }
        let csvStringify = csv.stringify({ header: true });
        for (employee of Object.keys(employeeActions)) {
            // add the record as a row in the csv document
            csvStringify.write({
                Name: employee,
                "Repairs Completed": employeeActions[employee].repairsCompleted,
                "Transactions Completed": employeeActions[employee].transactionsCompleted
            });
        }
        // set headers so that client knows content type
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        // lets client view the content-disposition header with the filename
        res.setHeader('Access-Control-Expose-Headers', 'Content-disposition');
        res.writeHead(200, { 'Content-Type': 'text/csv' });
        // flush the headers before we start pushing the CSV content (to write the ones we have set)
        res.flushHeaders();
        // end the CSV string processor and pipe it as a response
        csvStringify.end().pipe(res);
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = { router: router };
