var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Transaction = require('./../models/Transaction');
var Customer = require('./../models/Customer');
var Bike = require('./../models/Bike');
var Item = require('./../models/Item');
var Repair = require('./../models/Repair');

router.use(bodyParser.urlencoded({ extended: true }));

router.post('/', function (req, res) {
    if (req.body.customer._id) {
        Customer.findById(req.body.customer._id, function (err, customer) {
            if (err) return res.status(500)
            if (!customer) return res.status(404).send("Customer not found");
            Transaction.create({
                    date_created: Date.now(),
                    customer: customer._id
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
                customer: customer._id
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
        res.status(200);
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
                transaction.bikes.push(bike._id);
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
                transaction.bikes.push(bike._id);
                transaction.save();
                res.status(200).send(transaction);
            })
        }
    })
});

/*
Adds an existing item to the transaction - "POST /transactions/items"
 */
router.post('/:id/items', function (req, res) {
    Transaction.findByID(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        Item.findByID(req.body._id, function (err, item) {
            if (err) return res.status(500);
            if (!item) return res.status(404);
            transaction.items.push(item._id);
            transaction.save();
            res.status(200).send(transaction);
        })
    })
});

/*
Deletes the item with specified ID from the transaction.
 */
router.delete('/:id/items/:item_id', function (req, res) {
    Transaction.findByID(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        transaction.items.splice(find(function (i) { return i = item_id }), 1);
        transaction.save();
        res.status(200).send(transaction);
    })
});

/*
 Adds an existing repair to the transaction - "POST /transactions/repairs"
 */
router.post('/:id/repairs', function (req, res) {
    Transaction.findByID(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        Repair.findByID(req.body._id, function (err, repair) {
            if (err) return res.status(500);
            if (!repair) return res.status(404);
            transaction.repairs.push(repair);
            transaction.save();
            res.status(200).send(transaction);
        })
    })
});

/*
 Deletes the repair with specified ID from the transaction.
 */
router.delete('/:id/repairs/:repair_id', function (req, res) {
    Transaction.findByID(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        transaction.repairs.splice(find(function (e) { e._id = repair_id }), 1);
        transaction.save();
        res.status(200).send(transaction);
    })
});

/*
Searches for transactions by customer  - "GET /transactions/search?q="
 */
router.get('/search', function (req, res) {
    Transaction.find().populate({path: 'customer'}).exec(function (err, transactions) {
        transactions.filter(function (transaction) {
            return transaction.customer.first_name.includes(req.query.q)
            || transaction.customer.last_name.includes(req.query.q)
            || transaction.customer.email.includes(req.query.q);
        })
    })
});

module.exports = router;