var express = require('express');

/* Wrap our router in our auth protocol */
var router = require('./AuthController');

var bodyParser = require('body-parser');
var Transaction = require('./../models/Transaction');
var Customer = require('./../models/Customer');
var Bike = require('./../models/Bike');
var Item = require('./../models/Item');
var Repair = require('./../models/Repair');
var _ = require('underscore');

router.use(bodyParser.json());

/*
Posts a single transaction - "POST /transactions"
 */
router.post('/', function (req, res) {
    if (req.body.customer) {
        if (req.body.customer._id) {
            Customer.findById(req.body.customer._id, function (err, customer) {
                if (err) return res.status(500);
                if (!customer) return res.status(404).send("Customer not found");
                Transaction.create({
                        date_created: Date.now(),
                        transaction_type: req.body.transaction_type,
                        customer: customer._id
                    },
                    function (err, transaction) {
                        if (err) return res.status(500);
                        res.status(200).send(transaction);
                    }
                );
            });

        } else {
            Customer.create({
                    first_name: req.body.customer.first_name,
                    last_name: req.body.customer.last_name,
                    email: req.body.customer.email
                },
                function (err, customer) {
                    Transaction.create({
                        date_created: Date.now(),
                        transaction_type: req.body.transaction_type,
                        customer: customer._id
                    }, function (err, transaction) {
                        if (err) return res.status(500);
                        res.status(200).send(transaction);
                    })
                });
        }
    } else {
        res.status(400).send("No customer specified");
    }
});


/*
 Gets all transactions - "GET /transactions"
 */
router.get('/', function (req, res) {
    Transaction.find({})
        .sort('-date_created')
        .exec(function (err, transactions) {
            if (err) return res.status(500);
            res.status(200).send(transactions);
        });
});

/*
Gets all incomplete transactions - "GET /transactions/active"
 */
router.get('/active', function (req, res) {
    Transaction.$where('this.transaction_type != "merch" && !this.complete')
        .sort('-date_created')
        .exec(function (err, transactions) {
            if (err) return res.status(500);
            res.status(200).send(transactions);
        });
});

/*
Gets all complete transactions - "GET /transactions/complete"
 */
router.get('/complete', function (req, res) {
    Transaction.$where('this.complete === true').exec(function (err, transactions) {
        if (err) return res.status(500);
        res.status(200).send(transactions);
    })
});


/**
 * Search helper. Searches in string for given string.
 * @param str - to be searched
 * @param query - string to look for
 * @returns {boolean}
 */
var search = function search(str, query) {
    return str.toLowerCase().search(query) != -1;
};


/*
 Searches for transactions by customer XOR bike XOR transaction description - "GET /transactions/search?customer="
 */
router.get('/search', function (req, res) {
    Transaction.find({}).exec(function (err, transactions) {
        if (err) return res.status(500);
        transactions = transactions.filter( function(el) {
            console.log(el);
            if (req.query.customer) {
                return search(el.customer.first_name, req.query.customer)
                    || search(el.customer.last_name, req.query.customer)
                    || search(el.customer.email, req.query.customer);
            } else if (req.query.bike) {
                for (var i = 0; i < el.bikes.length; i++) {
                    console.log(el.bikes[i]);
                    if (search(el.bikes[i].make, req.query.bike)
                        || search(el.bikes[i].model, req.query.bike)
                        || search(el.bikes[i].description, req.query.bike)) {
                        return true;
                    }
                }
            } else if (req.query.description) {
                return search(el.description, req.query.description);
            }
        });
        res.status(200).send(transactions);
    })
});


/*
Gets a single transaction - "GET /transactions/:id"
 */
router.get('/:id', function (req, res) {
    Transaction.findById(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404).send("No transaction found.");
        res.status(200).send(transaction);
    });
});

/*
Updates a single transaction - "PUT /transactions/:id"
 */
router.put('/:id', function (req, res) {
   Transaction.findById(req.params.id, function (err, transaction) {
       if (err) return res.status(500);
       if (!transaction) return res.status(404);
       transaction = _.extend(transaction, req.body);
       transaction.save(function (err, transaction) {
           res.status(200).send(transaction);
       });
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
        res.status(200).send("OK");
    })
});


/*
Posts a bike to a transaction - "POST /transactions/:id/bikes"
 */
router.post('/:id/bikes', function (req, res) {
    Transaction.findById(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        if (req.body._id) {
            Bike.findById(req.body._id, function (err, bike) {
                if (!bike) return res.status(404).send("No bike found");
                transaction.bikes.push(bike._id);
                transaction.save();
            });
            res.status(200).send(transaction);
        } else {
            Bike.create({
                make: req.body.make,
                model: req.body.model,
                description: req.body.description
            },
            function (err, bike) {
                if (err) return res.status(500);
                transaction.bikes.push(bike._id);
                transaction.save(function (err, transaction) {
                    res.status(200).send(transaction);
                });
            });
        }
    });
});


/*
Deletes a bike from the transaction - "DELETE /transactions/:id/bikes/:bike_id"
 */
router.delete('/:id/bikes/:bike_id', function (req, res) {
    Transaction.findById(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        transaction.bikes.splice(transaction.bikes.find(function (b) { return b = req.params.bike_id}), 1);
        transaction.save(function (err, transaction) {
            res.status(200).send(transaction);
        });
    })
});


/*
Adds an existing item to the transaction - "POST /transactions/items"
 */
router.post('/:id/items', function (req, res) {
    Transaction.findById(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        Item.findById(req.body._id, function (err, item) {
            if (err) return res.status(500);
            if (!item) return res.status(404);
            transaction.items.push(item._id);
            transaction.save(function (err, transaction) {
                res.status(200).send(transaction);
            });
        })
    })
});


/*
Deletes the item with specified ID from the transaction.
 */
router.delete('/:id/items/:item_id', function (req, res) {
    Transaction.findById(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        transaction.items.splice(find(function (i) { return i = req.params.item_id }), 1);
        transaction.save(function (err, transaction) {
            res.status(200).send(transaction);
        });
    })
});


/*
 Adds an existing repair to the transaction - "POST /transactions/repairs"
 */
router.post('/:id/repairs', function (req, res) {
    Transaction.findById(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        Repair.findById(req.body._id, function (err, repair) {
            if (err) return res.status(500);
            if (!repair) return res.status(404);
            var rep = {"repair": repair, "completed": false};
            transaction.repairs.push(rep);
            transaction.save(function (err, transaction) {
                res.status(200).send(transaction);
            });
        })
    })
});


/*
 Deletes the repair with specified ID from the transaction.
 */
router.delete('/:id/repairs/:repair_id', function (req, res) {
    Transaction.findById(req.params.id, function (err, transaction) {
        if (err) return res.status(500);
        if (!transaction) return res.status(404);
        transaction.repairs.splice(find(function (e) { e._id = req.params.repair_id }), 1);
        transaction.save(function (err, transaction) {
            res.status(200).send(transaction);
        });
    })
});


module.exports = router;