var express = require("express");

/* Wrap our router in our auth protocol */
var router = express.Router();

const moment = require("moment");
const authMiddleware = require("../middleware/AuthMiddleware");
const bodyParser = require("body-parser");
const Transaction = require("./../models/Transaction");
const OrderRequest = require("./../models/OrderRequest");
const Customer = require("./../models/Customer");
const Bike = require("./../models/Bike");
const Item = require("./../models/Item");
const Repair = require("./../models/Repair");
const User = require("./../models/User");
const _ = require("underscore");
const config = require("../config")();

router.use(bodyParser.json());
router.use(authMiddleware);

/**
 Posts a single transaction - "POST /transactions"
 If customer does exist, req.body.customer._id must be filled
 */
router.post("/", async (req, res) => {
  try {
    if (req.body.customer) {
      let customer;
      if (req.body.customer._id) {
        // Find the customer we are told exists.
        customer = await Customer.findById(req.body.customer._id);
        if (!customer) return res.status(404).send("Customer not found");
      } else {
        // Create a new customer.
        customer = await Customer.create({
          first_name: req.body.customer.first_name,
          last_name: req.body.customer.last_name,
          email: req.body.customer.email,
        });
      }
      // See if the customer is an employee, and apply discount if so
      const users = await User.find({});
      let employee = false;
      for (user of users) {
        if (user.username === customer.email.replace("@rice.edu", "")) {
          // Go by username to find employee.
          employee = true;
          break;
        }
      }
      let transaction = await Transaction.create({
        date_created: Date.now(),
        transaction_type: req.body.transaction_type,
        customer: customer._id,
        employee: employee,
      });
      const loggedTransaction = await addLogToTransaction(
        transaction,
        req,
        "Created Transaction"
      );
      const savedTransaction = await loggedTransaction.save();
      res.status(200).send(savedTransaction);
    } else {
      res.status(400).send("No customer specified");
    }
  } catch (err) {
    return res.status(500).send(err);
  }
});

/*
Gets all transactions - "GET /transactions"

If query parameters are supplied, they are passed in to the find function - "GET /transactions?complete=true" finds
transactions with the property { "complete": true }.
 */
router.get("/", async (req, res) => {
  try {
    const transactions = await Transaction.find(req.query);
    res.status(200).send(transactions);
  } catch (err) {
    res.status(500).send(err);
  }
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

/*
Searches transactions by date they were completed
 */
router.get("/searchByDate/:dates", function (req, res) {
  const datesMap = req.params.dates; //a dictionary from startDate/endDate to ISO string
  var queryParams = {};
  try {
    queryParams.$gte = new Date(datesMap["startDate"]);
  } catch (e) {
    console.log("No start date. Continue");
  }
  try {
    queryParams.$lt = new Date(datesMap["endDate"]);
  } catch (e) {
    console.log("No start date. Continue");
  }
  if (startDate == null && endDate == null) {
    return [];
  }

  Transaction.find({
    date_completed: queryParams,
  }).exec(function (err, transactions) {
    if (err) return res.status(500);
    if (!transactions) return res.status(404).send("No transactions found.");
    res.status(200).send(transaction);
  });
});

/**
 * Helper function to add logs to transactions. MODIFIES input transaction
 * @param transaction - transaction object from mongoose
 * @param req - http request object
 * @param description - action description
 * @return Promise<Transaction> -- transaction with log on it
 */
async function addLogToTransaction(transaction, req, description) {
  const user_id = req.headers["user-id"];
  if (!user_id) throw { error: "did not find a user-id header" };
  try {
    const user = await User.findById(user_id);
    const action = {
      employee: user,
      description: description,
      time: Date.now(),
    };
    // Add this action first in the array
    transaction.actions.unshift(action);
    return transaction;
  } catch (e) {
    // Throw the error, we expect caller to handle it
    throw e;
  }
}

/**
 * Convenience function to truncate to two decimal places
 * @param num - number to truncate
 * @return {Number} number truncated to two decimal places
 */
function truncate2(num) {
  const str = num.toFixed(2);
  return parseFloat(str);
}

/**
 * Adds tax to a transaction, or updates it
 * @param transaction
 * @return {Promise<Transaction>} transaction with correct tax value
 */
async function calculateTax(transaction) {
  /*  Rice Bikes did not tax before Wednesday, January 29th 2020 */
  try {
    if (transaction.date_created > config.tax.cutoff_date) {
      // apply tax to the transaction
      // remove old tax item
      transaction.items = transaction.items.filter(function (candidate) {
        if (candidate.item.name === config.tax.DBname) {
          // remove this item, and drop the cost to remove current tax
          transaction.total_cost -= candidate.price;
          return false;
        } else return true; // not the tax item, keep it
      });
      const tax_item = await Item.findOne({ name: config.tax.DBname });
      let calculated_tax = {
        item: tax_item,
        price: truncate2(transaction.total_cost * config.tax.rate),
      };
      // round off the tax value
      if (calculated_tax.price > Number.EPSILON) {
        // Tax is nonzero, add a tax item
        transaction.items.push(calculated_tax);
      }
      transaction.total_cost = truncate2(
        transaction.total_cost + calculated_tax.price
      );
      return transaction;
    }
  } catch (err) {
    throw err; // caller will handle it
  }
}
/*
 Searches for transactions by customer XOR bike XOR transaction description - "GET /transactions/search?customer="
*/
router.get("/search", function (req, res) {
  Transaction.find({}).exec(function (err, transactions) {
    if (err) return res.status(500);
    transactions = transactions.filter(function (el) {
      if (req.query.customer) {
        return (
          search(el.customer.first_name, req.query.customer) ||
          search(el.customer.last_name, req.query.customer) ||
          search(el.customer.email, req.query.customer)
        );
      } else if (req.query.bike) {
        for (let i = 0; i < el.bikes.length; i++) {
          if (
            search(el.bikes[i].make, req.query.bike) ||
            search(el.bikes[i].model, req.query.bike) ||
            search(el.bikes[i].description, req.query.bike)
          ) {
            return true;
          }
        }
      } else if (req.query.description) {
        return search(el.description, req.query.description);
      }
    });
    res.status(200).send(transactions);
  });
});

/**
 * GET: /search/ids
 * Gets all transaction IDs. Useful for searching.
 */
router.get("/search/ids", async (req, res) => {
  try {
    const distinct = await Transaction.distinct("_id");
    return res.status(200).send(distinct);
  } catch (err) {
    res.status(500).send(err);
  }
});

/*
Gets a single transaction - "GET /transactions/:id"
 */
router.get("/:id", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).send("No transaction found");
    }
    res.status(200).send(transaction);
  } catch (err) {
    res.status(500).send(err);
  }
});

/*
Functions to update transactions. Split up to allow tracking user actions.
 */
/**
 Updates a transaction's description
 requires user's ID in header
 @param description - description to update transaction with
 */
router.put("/:id/description", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).send("No transaction found");
    if (!req.headers["user-id"])
      return res.status(400).send("No user id provided");
    const user_id = req.headers["user-id"];
    const user = await User.findById(user_id);
    if (!user) return res.status(404).send("No user found");
    transaction.description =
      req.body.description + "- " + user.firstname + " " + user.lastname;
    const loggedTransaction = await addLogToTransaction(
      transaction,
      "Updated Transaction Description",
      req
    );
    const savedTransaction = await loggedTransaction.save();
    return res.status(200).send(savedTransaction);
  } catch (err) {
    res.status(500).send(err);
  }
});

/**
 * Completes or reopens a transaction
 * Requires user's ID in header
 * @param complete {boolean} - if the transaction is complete or not
 */
router.put("/:id/complete", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).send();
    transaction.complete = req.body.complete;
    transaction.urgent = false;
    if (req.body.complete) {
      transaction.date_completed = Date.now();
    }
    if (transaction.orderRequest.length > 0) {
      return res.status(403).send("Cannot complete transaction with waiting order requests");
    }
    // Update item inventory
    for (let item of transaction.items) {
      const found_item = await Item.findById(item.item._id);
      if (req.body.complete) {
        found_item.stock -= 1;
      } else {
        found_item.stock += 1;
      }
      await found_item.save();
      // send low stock email if needed
      /*
                Currently disabling this
              if (found_item.stock <= found_item.warning_stock) {
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
              */
    }
    const description = req.body.complete
      ? "Completed Transaction"
      : "Reopened Transaction";
    const loggedTransaction = await addLogToTransaction(
      transaction,
      req,
      description
    );
    const savedTransaction = await loggedTransaction.save();
    return res.status(200).send(savedTransaction);
  } catch (err) {
    return res.status(500).send(err);
  }
});

/**
 * Adds an order request to a transaction's list of waiting requests. 
 * These are usually parts that a transaction is waiting on to arrive.
 * @param requestid: ID of order request to associate.
 */
router.post("/:id/order-request", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).send("No matching transaction found");
    }
    if (transaction.is_paid || transaction.complete) {
      // Do not allow order request to be associated
      return res.status(400).send("Transaction has already been completed, cannot add request.")
    }
    const orderRequest = await OrderRequest.findById(req.body.requestid);
    if (!orderRequest) {
      return res.status(404).send("Could not find specified order request");
    }
    // Raise the number of requested items by 1
    orderRequest.quantity += 1;
    orderRequest.transactions.push(transaction._id);
    const savedRequest = await orderRequest.save();
    transaction.orderRequests.push(savedRequest);
    loggedTransaction = await addLogToTransaction(transaction, req, `Marked as waiting on request #${orderRequest._id}`);
    await loggedTransaction.save();
    return res.status(200).send(loggedTransaction);
  } catch (err) {
    res.status(500).send(err);
  }
});


/**
 * Deletes a part request for a transaction, by its ID.
 * @param req_id: ID of the order request to delete from the transaction given by "id"
 */
router.delete('/:id/order-request/:req_id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).send("No matching transaction found");
    }
    if (transaction.is_paid || transaction.complete) {
      return res.status(400).send("Cannot modify requests on completed transaction");
    }
    const index = transaction.orderRequests.findIndex(element => element._id == req.params.req_id)
    if (index == -1) {
      // order request was not found.
      return res.status(404).send("Order request not found attached to transaction");
    }
    let locatedOrderRequest = await OrderRequest.findById(req.params.req_id);
    locatedOrderRequest.quantity -= 1;
    // Remove transaction from order request
    locatedOrderRequest.transactions.splice(locatedOrderRequest.transactions.indexOf(transaction._id), 1);
    await locatedOrderRequest.save()
    transaction.orderRequests.splice(index, 1);
    let loggedTransaction = await addLogToTransaction(transaction, req, `removed part request ${req.params.req_id}`);
    let savedTransaction = await loggedTransaction.save();
    // If located order request quantity is now zero, delete the request.
    if (locatedOrderRequest.quantity <= 0) {
      // Delete the order request entirely.
      if (locatedOrderRequest.orderRef) {
        // Get reference to order this request is in, and update cost.
        let order = await Order.findById(locatedOrderRequest.orderRef);
        // Remove orderRequest from order.
        order.items = order.items.splice(order.items.indexOf(locatedOrderRequest._id), 1);
        await order.save();
      }
      await locatedOrderRequest.remove();
    }
    res.status(200).send(savedTransaction);
  } catch (err) {
    return res.status(500).send(err);
  }
});

/**
 * Marks a transaction as paid. Also clears waiting on part or email flags.
 * Requires user's ID in header
 * @param is_paid - if the transaction is being marked as paid or not
 */
router.put("/:id/mark_paid", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (req.body.is_paid && !transaction.is_paid) {
      // Send receipt email
      res.mailer.send(
        "email-receipt",
        {
          to: transaction.customer.email,
          subject: `Rice Bikes - Receipt - transaction #${transaction._id}`,
          transaction: transaction,
          date: moment().format("MMMM Do YYYY, h:mm:ss a"),
        },
        function (err) {
          if (err) return res.status(500);
        }
      );
    }
    transaction.is_paid = req.body.is_paid;
    transaction.complete = true;
    // log this action
    let description = req.body.is_paid
      ? "Marked Transaction paid"
      : "Marked Transaction as waiting";
    const loggedTransaction = await addLogToTransaction(
      transaction,
      req,
      description
    );
    const savedTransaction = await loggedTransaction.save();
    res.status(200).send(savedTransaction);
  } catch (err) {
    res.status(500).send(err);
  }
});

/**
 * Marks a transaction's repair as complete or unfinished (only one repair is marked at once)
 * Requires user's ID in header
 * @param _id - repair id to update
 * @param completed - if repair is complete or not
 */
router.put("/:id/update_repair", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).send();
    // update the transaction's repair
    if (transaction.repairs.length === 0)
      return res
        .status(404)
        .send("No repairs associated with this transaction");
    transaction.repairs.forEach(async function (current_repair, idx) {
      // iterate to find the repair that is completed
      if (current_repair._id.toString() === req.body._id) {
        transaction.repairs[idx].completed = req.body.completed;
        let description = req.body.completed
          ? `Completed Repair ${current_repair.repair.name}`
          : `Opened Repair ${current_repair.repair.name}`;
        const loggedTransaction = await addLogToTransaction(
          transaction,
          req,
          description
        );
        const savedTransaction = await loggedTransaction.save();
        return res.status(200).send(savedTransaction);
      }
    });
  } catch (err) {
    return res.status(500).send(err);
  }
});

/**
    Updates a single transaction - "PUT /transactions/:id"
    This endpoint handles updates such as marking a transaction urgent, waiting on a part, or waiting on email.
    DO NOT USE THIS ENDPOINT FOR NEW FEATURES
 */
router.put("/:id", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).send();
    // Only update the fields that this function is meant to handle
    // This function is being phased out in favor of individual endpoints for each element of transaction
    transaction.waiting_email = req.body.waiting_email;
    transaction.urgent = req.body.urgent;
    transaction.refurb = req.body.refurb;
    transaction.transaction_type = req.body.transaction_type;
    const savedTransaction = await transaction.save();
    return res.status(200).send(savedTransaction);
  } catch (err) {
    return res.status(500).send(err);
  }
});

/*
Deletes a single transaction - "DELETE /transactions/:id"
 */
router.delete("/:id", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).send("No transaction found.");
    // Update order requests that reference this transaction.
    for (let request of transaction.orderRequests) {
      const requestRef = await OrderRequest.findById(request._id);
      requestRef.transactions = requestRef.transactions.filter(x => x != transaction._id);
      await requestRef.save();
    }
    await transaction.remove();
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send(err);
  }
});

/*
Posts a bike to a transaction - "POST /transactions/:id/bikes"
 */
router.post("/:id/bikes", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404);
    let bike;
    if (req.body._id) {
      bike = await Bike.findById(req.body.id);
      if (!bike) return res.status(404).send("No bike found");
    } else {
      bike = await Bike.create({
        make: req.body.make,
        model: req.body.model,
        description: req.body.description,
      });
    }
    transaction.bikes.push(bike);
    let finalTransaction = await transaction.save();
    return res.status(200).send(finalTransaction);
  } catch (err) {
    res.status(500).send(err);
  }
});

/**
Deletes a bike from the transaction - "DELETE /transactions/:id/bikes/:bike_id"
 */
router.delete("/:id/bikes/:bike_id", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404);
    transaction.bikes.splice(
      transaction.bikes.find(function (b) {
        return req.params.bike_id;
      }),
      1
    );
    const finalTransaction = await transaction.save();
    res.status(200).send(finalTransaction);
  } catch (err) {
    res.status(500).send(err);
  }
});

/**
 Adds an existing item to the transaction - "POST /transactions/items"
 Requires user's ID in header
 @param _id: id of item to add
 */
router.post("/:id/items", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).send("No Transaction found");
    const item = await Item.findById(req.body._id);
    if (!item) return res.status(404).send("No item found");
    let newItem;
    if (transaction.employee && item.wholesale_cost > 0) {
      // Apply employee pricing for this item.
      newItem = {
        item: item,
        price: item.wholesale_cost * config.employee_price_multiplier,
      };
    } else {
      newItem = { item: item, price: item.standard_price };
    }
    transaction.total_cost += newItem.price;
    transaction.items.push(newItem);
    // we save the transaction here to make sure the first item we added is saved to the database
    await transaction.save(); // save transaction before working on tax
    const taxedTransaction = await calculateTax(transaction);
    const loggedTransaction = await addLogToTransaction(
      taxedTransaction,
      req,
      `Added Item ${item.name}`
    );
    const finalTransaction = await loggedTransaction.save();
    res.status(200).send(finalTransaction);
  } catch (err) {
    res.status(500).send(err);
  }
});

/**
 * Requires user's ID in header
 * Deletes an item from a transaction - DELETE /transactions/$id/items
 */
router.delete("/:id/items/:item_id", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404);
    let action_description;
    for (let i = 0; i < transaction.items.length; i++) {
      let item = transaction.items[i].item;
      if (item._id.toString() === req.params.item_id) {
        // If the item is managed, deny the user from removing it
        if (item.managed)
          return res.status(403).send("Cannot delete this type of item");
        // decrease total_cost
        transaction.total_cost -= transaction.items[i].price;
        // simply delete the item by splicing it from the item list
        transaction.items.splice(i, 1);
        action_description = `Deleted item ${item.name}`;
        break;
      }
    }
    let taxedTransaction = await calculateTax(transaction);
    let loggedTransaction = await addLogToTransaction(
      taxedTransaction,
      req,
      action_description
    );
    let savedTransaction = await loggedTransaction.save();
    res.status(200).send(savedTransaction);
  } catch (err) {
    res.status(500).send(err);
  }
});

/**
 Adds an existing repair to the transaction - "POST /transactions/repairs"
 @ param _id : repair id to add
 @ param user : user object performing this change
 */
router.post("/:id/repairs", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).send("No transaction");
    if (!req.body._id) return res.status(400).send("No repair to add");
    let repair = await Repair.findById(req.body._id);
    if (!repair) return res.status(404);
    let rep = { repair: repair, completed: false };
    transaction.repairs.push(rep);
    transaction.total_cost += repair.price;
    let taxedTransaction = await calculateTax(transaction);
    let loggedTransaction = await addLogToTransaction(
      taxedTransaction,
      req,
      `Added repair ${repair.name}`
    );
    let savedTransaction = await loggedTransaction.save();
    res.status(200).send(savedTransaction);
  } catch (err) {
    res.status(500).send(err);
  }
});

/**
 * Requires user ID in header
 * Deletes repair from transaction
 */
router.delete("/:id/repairs/:repair_id", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404);
    let description = "";
    transaction.repairs = transaction.repairs.filter(function (rep) {
      if (rep._id.toString() === req.params.repair_id) {
        description = `Deleted repair ${rep.repair.name}`;
        transaction.total_cost -= rep.repair.price;
        return false;
      } else return true;
    });
    let taxedTransaction = await calculateTax(transaction);
    let loggedTransaction = await addLogToTransaction(
      taxedTransaction,
      req,
      description
    );
    let savedTransaction = await loggedTransaction.save();
    res.status(200).send(savedTransaction);
  } catch (err) {
    res.status(500).send(err);
  }
});

/*
 Email handler
 */
router.get("/:id/email-notify", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404);
    res.mailer.send(
      "email-notify-ready",
      {
        to: transaction.customer.email,
        subject: `Rice Bikes - your bike is ready - ${transaction._id}`,
        first_name: transaction.customer.first_name,
      },
      function (err) {
        if (err) return res.status(500);
        res.status(200).send("OK");
      }
    );
  } catch (err) {
    res.status(500).send(err);
  }
});

router.get("/:id/email-receipt", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404);
    res.mailer.send(
      "email-receipt",
      {
        to: transaction.customer.email,
        subject: `Rice Bikes - Receipt - transaction #${transaction._id}`,
        transaction: transaction,
      },
      function (err) {
        if (err) return res.status(500);
        res.status(200).send("OK");
      }
    );
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;
