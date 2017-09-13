var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Transaction = require('./../models/Transaction');
var Customer = require('./../models/Customer');
var Bike = require('./../models/Bike');

router.use(bodyParser.urlencoded({ extended: true }));

router.post('/', function (req, res) {
    console.log(req.body);
    if (req.body.customer._id) {
        Customer.findById(req.body.customer._id, function (err, customer) {
            if (err) return res.status(500).send("Customer not found");
            Transaction.create({
                    date_created: Date.now(),
                    customer: customer
                },
                function (err, transaction) {
                    if (err) return res.status(500);
                    res.status(200).send(transaction);
                }
            );
        });

    } else if (req.body.customer && !req.body.customer._id) {
        Customer.create({
            first_name: req.body.customer.first_name,
            last_name: req.body.customer.last_name,
            email: req.body.customer.email
        },
        function (err, customer) {
            Transaction.create({
                date_created: Date.now(),
                customer: customer
            }, function (err, transaction) {
                if (err) return res.status(500);
                res.status(200).send(transaction);
            })
        });

    } else {
        res.status(400).send("No customer specified for transaction.")
    }
});

/*
 Gets all transactions - "GET /transactions"
 */
router.get('/', function (req, res) {
    Transaction.find({}, function (err, transactions) {
        if (err)
            return res.status(500).send("There was a problem finding the transactions.");
        res.status(200).send(transactions);
    });
});

/*
Gets a single transaction - "GET /transactions/:id"
 */
router.get('/:id', function (req, res) {
    Transaction.findById(req.params.id, function (err, transaction) {
        if (err) return res.status(500).send("There was a problem finding the transaction.");
        if (!transaction) return res.status(404).send("No transaction found.");
        res.status(200).send(transaction);
    });
});

/*
Deletes a single transaction - "DELETE /transactions/:id"
 */
router.delete('/:id', function (req, res) {
    Transaction.findById(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404).send("No transaction found.");
        transaction.remove(function (err) {
            if (err) return res.status(500);
        });
    })
});

/*
Posts a bike to a transaction - "POST /transactions/:id/bikes"
 */
router.post('/:id/bikes', function (req, res) {
    Transaction.findByID(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        if (req.body._id) {
            Bike.findById(req.body._id, function (err, bike) {
                if (!bike) return res.status(404).send("No bike found");
                transaction.bikes.push(bike);
                transaction.save();
            });
            res.status(200).send(transaction);
        } else if (req.body) {
            Bike.create({
                make: req.body.bike.make,
                model: req.body.bike.model,
                description: req.body.bike.description
            },
            function (err, bike) {
                if (err) return res.status(500);
                transaction.bikes.push(bike);
                transaction.save();
                res.status(200).send(transaction);
            })
        }
    })
});

/*
Searches for transactions - "GET /transactions/search?q"
 */
router.get('/search', function (req, res) {
    Transaction.find({$text: {$search: req.query.q}}, function (err, transactions) {
        if (err) return res.status(500);
        res.status(200).send(transactions);
    });

});

module.exports = router;