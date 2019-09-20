var express = require('express');

/* Wrap our router in our auth protocol */
var router = express.Router();

var moment = require('moment');

var authMiddleware = require('../middleware/AuthMiddleware');

var bodyParser = require('body-parser');
var Transaction = require('./../models/Transaction');
var Customer = require('./../models/Customer');
var Bike = require('./../models/Bike');
var Item = require('./../models/Item');
var Repair = require('./../models/Repair');
var User = require('./../models/User');
var Action = require('./../models/Action');
var _ = require('underscore');

router.use(bodyParser.json());
router.use(authMiddleware);

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
            addLogToTransaction(transaction, req, "Created Transaction",
                function (err, loggedTransaction) {
                  if (err) return res.status(500);
                  loggedTransaction.save(function (err, finalTransaction) {
                    if (err) return res.status(500);
                    res.status(200).send(finalTransaction);
                  });
                });
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
            addLogToTransaction(transaction, req, "Created Transaction",
                function (err, loggedTransaction) {
                  if (err) return res.status(500);
                  loggedTransaction.save(function (err, finalTransaction) {
                    if (err) return res.status(500);
                    res.status(200).send(finalTransaction);
                  });
            });
          })
        });
    }
  } else {
    res.status(400).send("No customer specified");
  }
});

/*
Gets all transactions - "GET /transactions"

If query parameters are supplied, they are passed in to the find function - "GET /transactions?complete=true" finds
transactions with the property { "complete": true }.
 */
router.get('/', function (req, res) {
  Transaction.find(req.query)
    .exec(function (err, transactions) {
      if (err) return res.status(500).send();
      return res.status(200).send(transactions);
    })

});


/**
 * Search helper. Searches in string for given string.
 * @param str - to be searched
 * @param query - string to look for
 * @returns {boolean}
 */
var search = function (str, query) {
  if (str) {
    return str.toLowerCase().search(query) !== -1;
  } else {
    return false;
  }
};

/**
 * Helper function to add logs to transactions. MODIFIES input transaction
 * @param transaction - transaction object from mongoose
 * @param req - http request object
 * @param description - action description
 * @param callback- function with arguments: err- error encountered, transaction - updated transaction
 */
function addLogToTransaction(transaction, req, description, callback) {
  const user_id = req.headers['user-id'];
  if (!user_id) return callback({error:'did not find a user-id header'},null);
  User.findById(user_id,function (err, user) {
    if(err) callback(err,null);
    if(!user) callback(404,null);
    let action = {
          "employee": user,
          "description": description,
          "time": Date.now()
    };
    transaction.actions.push(action);
    callback(null,transaction);
  });
}

/*
 Searches for transactions by customer XOR bike XOR transaction description - "GET /transactions/search?customer="
*/
router.get('/search', function (req, res) {
  Transaction.find({}).exec(function (err, transactions) {
    if (err) return res.status(500);
    transactions = transactions.filter(function (el) {
      if (req.query.customer) {
        return search(el.customer.first_name, req.query.customer)
          || search(el.customer.last_name, req.query.customer)
          || search(el.customer.email, req.query.customer);
      } else if (req.query.bike) {
        for (let i = 0; i < el.bikes.length; i++) {
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
Functions to update transactions. Split up to allow tracking user actions.
 */
/**
  Updates a transaction's description
  requires user's ID in header
  @param description - description to update transaction with
 */
router.put('/:id/description', function(req,res) {
  Transaction.findById(req.params.id, function(err, transaction) {
     if (err) return res.status(500).send(err);
     if (!transaction) return res.status(404).send();
     transaction.description = req.body.description;
     // create log of this action
     addLogToTransaction(transaction,
         req,
         "Updated Transaction Description",
         function (err, new_transaction) {
       if(err){
         if(err == 404){
           return res.status(404).send();
         }else{
           return res.status(500).send(err);
         }
       }
       // save transaction
       new_transaction.save(function (err, final_transaction) {
         if (err) return res.status(500).send(err);
         res.status(200).send(final_transaction);
       })
     });
  }
  );
});

/**
 * Completes or reopens a transaction
 * Requires user's ID in header
 * @param complete {boolean} - if the transaction is complete or not
 */
router.put('/:id/complete', function(req,res) {
  Transaction.findById(req.params.id, function(err, transaction) {
    if(err) return res.status(500).send(err);
    if(!transaction) return res.status(404).send();
    transaction.complete = req.body.complete;
    if(req.body.complete) {
      transaction.date_completed = Date.now();
    }
    // change item inventory, and trigger a low stock email if required
      for (let item of transaction.items){
        Item.findById(item._id, function(err, found_item) {
          if (err) return res.status(500).send(err);
          // raise or lower item quantity
          if(req.body.complete){
           found_item.quantity -= 1;
          }else {
            found_item.quantity += 1;
          }
          // save item
          found_item.save(function (err) {
            if (err) return res.status(500).send(err);
          });
          // send low stock email if needed
          if (found_item.quantity <= found_item.warning_quantity) {
            User.find({roles:'operations'},function (err, user_array) {
              for (user of user_array){
                  let email = user.username+'@rice.edu';
                  res.mailer.send('email-lowstock',{
                    to:email,
                    subject: `Low Stock Alert - ${found_item.name}`,
                    name:user.username,
                    item:found_item
                  }, function (err) {
                    if(err) console.log(err);
                  });
              }
            });
          }
        });
      }
      // log this action
    let description = req.body.complete ? 'Completed Transaction' : 'Reopened Transaction';
    addLogToTransaction(transaction, req,description, function (err, logged_transaction) {
      if(err){
        if(err == 404){
          return res.status(404).send('No User found');
        }else {
          return res.status(500).send(err);
        }
      }
      logged_transaction.save(function (err, new_transaction) {
        if (err) return res.status(500).send(err);
        res.status(200).send(new_transaction);
      })
    })

  });
});

/**
 * Marks a transaction as paid. Also clears waiting on part or email flags.
 * Requires user's ID in header
 * @param is_paid - if the transaction is being marked as paid or not
 */
router.put('/:id/mark_paid',function (req,res) {
  Transaction.findById(req.params.id, function (err,transaction) {
    if (err) return res.status(500).send(err);
    if (req.body.is_paid && !transaction.is_paid) {
      res.mailer.send('email-receipt', {
        to: transaction.customer.email,
        subject: `Rice Bikes - Receipt - transaction #${transaction._id}`,
        transaction: transaction,
        date: moment().format('MMMM Do YYYY, h:mm:ss a')
      }, function (err) {
        if (err) return res.status(500);
      });
    }
    // log this action
    let description = req.body.is_paid ? 'Marked Transaction paid' : 'Marked Transaction as waiting';
    addLogToTransaction(transaction,req,description,function (err, logged_transaction) {
      if (err) {
        if (err === 404) {
          return res.status(404).send("User not found");
        } else {
          return res.status(500).send(err);
        }
      }
      logged_transaction.save(function (err, new_transaction) {
        if (err) return res.status(500).send(err);
        res.status(200).send(new_transaction);
      });
    });
    });
  });

/**
 * Marks a transaction's repair as complete or unfinished (only one repair is marked at once)
 * Requires user's ID in header
 * @param _id - repair id to update
 * @param completed - if repair is complete or not
 */
router.put('/:id/update_repair', function (req,res) {
  Transaction.findById(req.params.id, function (err,transaction) {
    if (err) return res.status(500).send(err);
    if(!transaction) return res.status(404).send();
      // update the transaction's repair
    if (transaction.repairs.length === 0) return res.status(404).send('No repairs associated with this transaction');
      transaction.repairs.forEach(function (current_repair, idx) {
        // iterate to find the repair that is completed
        if( current_repair._id == req.body._id){
            transaction.repairs[idx].completed = req.body.completed;
            let description = req.body.completed ? `Completed Repair ${current_repair.repair.name}` : `Opened Repair ${current_repair.repair.name}`;
            addLogToTransaction(transaction,req,description,function (err,logged_transaction) {
              if (err) {
                if (err == 404) {
                  return res.status(404).send('No user found');
                }else {
                  return res.status(500).send(err);
                }
              }
              logged_transaction.save(function (err, new_transaction) {
                if (err) return res.status(500).send(err);
                return res.status(200).send(new_transaction);
              })
            })
        }
      });
  }
  );
});



/*
Updates a single transaction - "PUT /transactions/:id"
 */
router.put('/:id', function (req, res) {
  Transaction.findById(req.params.id, function (err, transaction) {
    if (err) return res.status(500).send(err);
    if (!transaction) return res.status(404).send();

    let date = moment().format('MMMM Do YYYY, h:mm:ss a');
    // if the bike coming in has just been completed, decrement the inventory of the items on the transaction
    if (!transaction.complete && req.body.complete) {
      for (let item of req.body.items) {
        Item.findById(item._id, function (err, found_item) {
          if (err) return res.status(500).send(err);
          //lower the item inventory
          found_item.quantity -= 1;
          // if inventory drops below warning value, send an alert email
          if (found_item.quantity <= found_item.warning_quantity) {
            // send an alert email to any user with the operations role
            User.find({roles:'operations'},function (err, user_array) {
              for (user of user_array){
                  let email = user.username+'@rice.edu';
                  res.mailer.send('email-lowstock',{
                    to:email,
                    subject: `Low Stock Alert - ${found_item.name}`,
                    name:user.username,
                    item:found_item
                  }, function (err) {
                    if(err) console.log(err);
                  });
              }
            })
          }
          found_item.save(function (err, new_item) {
            if (err) return res.status(500).send(err);
              if (!transaction.is_paid && req.body.is_paid) {
                res.mailer.send('email-receipt', {
                to: transaction.customer.email,
                subject: `Rice Bikes - Receipt - transaction #${transaction._id}`,
                transaction: transaction,
                date: date
              }, function (err) {
                if (err) return res.status(500);
              });
            }
          });
        });
      }
    }
    // in addition, make sure that if a bike is re-opened quantity is raised
    else if (transaction.complete && !req.body.complete) {
      for (let item of req.body.items) {
        Item.findById(item._id, function (err, found_item) {
          if (err) return res.status(500).send(err);
          //lower the item inventory
          found_item.quantity += 1;
          found_item.save(function (err, new_item) {
            if (err) return res.status(500).send(err);

          })
        });
      }
    }
    // if the bike coming in has just been paid (it was just completed), send receipt email
    if (!transaction.is_paid && req.body.is_paid) {
      res.mailer.send('email-receipt', {
        to: transaction.customer.email,
        subject: `Rice Bikes - Receipt - transaction #${transaction._id}`,
        transaction: transaction,
        date: date
      }, function (err) {
        if (err) return res.status(500);
        //res.status(200).send('OK');
      });
    }
    transaction = _.extend(transaction, req.body);
    transaction.save(function (err, transaction_new) {
      if (err) return res.status(500).send(err);
      res.status(200).send(transaction_new);
    });
  })
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
        transaction.bikes.push(bike);
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
          transaction.bikes.push(bike);
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
    transaction.bikes.splice(transaction.bikes.find(function (b) {
      return b = req.params.bike_id
    }), 1);
    transaction.save(function (err, transaction) {
      res.status(200).send(transaction);
    });
  })
});


/**
Adds an existing item to the transaction - "POST /transactions/items"
 Requires user's ID in header
 @param _id: id of item to add
 */
router.post('/:id/items', function (req, res) {
  Transaction.findById(req.params.id, function (err, transaction) {
    if (err) return res.status(500);
    if (!transaction) return res.status(404);
    Item.findById(req.body._id, function (err, item) {
      if (err) return res.status(500);
      if (!item) return res.status(404);
      transaction.items.push(item);
      transaction.total_cost += item.price;
      // log this action
      addLogToTransaction(transaction, req, `Added Item ${item.name}`, function (err, logged_transaction) {
        if (err) {
          if (err == 404) {
            return res.status(404).send();
          } else {
            return res.status(500).send();
          }
        }
        logged_transaction.save(function (err, new_transaction) {
          if (err) return res.status(500).send(err);
          return res.status(200).send(new_transaction);
        });
      });
    });
  });
});


/**
 * Requires user's ID in header
 * Deletes an item from a transaction - DELETE /transactions/$id/items
 */
router.delete('/:id/items/:item_id', function (req, res) {
  Transaction.findById(req.params.id, function (err, transaction) {
    if (err) return res.status(500);
    if (!transaction) return res.status(404);
    for (let i = 0; i < transaction.items.length; i++) {
      let item = transaction.items[i];
      if (item._id == req.params.item_id) {
        transaction.total_cost -= item.price;
        transaction.items.splice(i, 1);
        var description = `Deleted item ${item.name}`;
        break;
      }
    }
    addLogToTransaction(transaction,req,description,function (err,logged_transaction) {
      if(err){
        if(err === 404){
          return res.status(404).send('No User found');
        }else{
          return res.status(500).send(err);
        }
      }
      logged_transaction.save(function (err, new_transaction) {
        if(err) return res.status(500).send();
        return res.status(200).send(new_transaction);
      });
    });
  })
});


/**
 Adds an existing repair to the transaction - "POST /transactions/repairs"
 @ param _id : repair id to add
 @ param user : user object performing this change
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
      transaction.total_cost += repair.price;
      addLogToTransaction(transaction,req,`Added repair ${repair.name}`,function (err, logged_transaction) {
        if(err){
          if(err ===404){
            return res.status(404).send('No user found');
          }else{
            return res.status(500).send(err);
          }
        }
        logged_transaction.save(function (err, new_transaction) {
          if(err) return res.status(500).send(err);
          return res.status(200).send(new_transaction);
        })
      });
    })
  })
});


/**
 * Requires user ID in header
 * Deletes repair from transaction
 */
router.delete('/:id/repairs/:repair_id', function (req, res) {
  Transaction.findById(req.params.id, function (err, transaction) {
    if (err) return res.status(500);
    if (!transaction) return res.status(404);
    let description = '';
    transaction.repairs = transaction.repairs.filter(function (rep) {
      if (rep._id == req.params.repair_id) {
        description = `Deleted repair ${rep.repair.name}`;
        transaction.total_cost -= rep.repair.price;
        return false;
      } else return true;
    });
    addLogToTransaction(transaction,req,description, function (err, logged_transaction) {
      if(err){
          if(err ===404){
            return res.status(404).send('No user found');
          }else{
            return res.status(500).send(err);
          }
        }
        logged_transaction.save(function (err, new_transaction) {
          if(err) return res.status(500).send(err);
          return res.status(200).send(new_transaction);
        });
    });
  });
});

/*
 Email handler
 */
router.get('/:id/email-notify', function (req, res) {
  Transaction.findById(req.params.id, function (err, transaction) {
    if (err) return res.status(500);
    if (!transaction) return res.status(404);

    res.mailer.send('email-notify-ready', {
      to: transaction.customer.email,
      subject: `Rice Bikes - your bike is ready - ${transaction._id}`,
      first_name: transaction.customer.first_name
    }, function (err) {
      if (err) return res.status(500);
      res.status(200).send('OK');
    });
  });
});

router.get('/:id/email-receipt', function (req, res) {
  Transaction.findById(req.params.id, function (err, transaction) {
    if (err) return res.status(500);
    if (!transaction) return res.status(404);
    res.mailer.send('email-receipt', {
      to: transaction.customer.email,
      subject: `Rice Bikes - Receipt - transaction #${transaction._id}`,
      transaction: transaction
    }, function (err) {
      if (err) return res.status(500);
      res.status(200).send('OK');
    })
  });
});

module.exports = router;
