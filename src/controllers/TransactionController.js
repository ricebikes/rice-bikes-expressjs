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
const ItemController = require("./ItemController");
const mailer = require("./../email");

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
        if (!customer) return res.status(404).json({ err: "Customer not found", status: 404 });
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
      res.status(200).json(savedTransaction);
    } else {
      res.status(400).json({ err: "No customer specified", status: 400 });
    }
  } catch (err) {
    return res.status(500).json(err);
  }
});

/*
Gets all transactions - "GET /transactions"

If query parameters are supplied, they are passed in to the find function - "GET /transactions?complete=true" finds
transactions with the property { "complete": true }.
 */
router.get("/", async (req, res) => {
  try {
    let query = req.query;
    // If query requests all transactions waiting on parts, modify it to search for transactions with one or more order requests
    if (query.waiting_part) {
      delete query.waiting_part;
      query['orderRequests.0'] = { '$exists': true }
    }
    /**
     * Note: we deliberately tell mongoose not to return all fields when running this query.
     * We don't want to send a large amount of data to the frontend when getting a lot of transactions.
     */
    let transactions = await Transaction.find(query)
      .select({
        items: 0, actions: 0, repairs: 0, description: 0,
        employee: 0, complete: 0, is_paid: 0, refurb: 0, paymentType: 0
      });
    // Sort transactions here
    transactions = transactions.sort((a, b) => {
      if ((a.urgent && b.urgent) || (!a.urgent && !b.urgent)) {
        return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
      } else if (b.urgent) {
        return 1;
      } else if (a.urgent) {
        return -1;
      }
    });
    res.status(200).json(transactions);
  } catch (err) {
    res.status(500).json(err);
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
    return str.toLowerCase().search(query.toLowerCase()) !== -1;
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
    if (!transactions) return res.status(404).json({ err: "No transactions found.", status: 404 });
    res.status(200).json(transaction);
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
  if (!user_id) throw { error: "did not find a user-id header", status: 400 };
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

/**
 * GET /api/transactions/search- Searches for transactions
 * customers: array of customer ObjectIDs. Any transactions with one of the customer IDs will match.
 * bikes: array of bike ObjectIDs. Any transactions with one of the bike IDs will match.
 * description: string. any transaction with the words in this string in it's description will match
 * Arrays should be formatted like so: "val1,val2,val3"
 */
router.get("/search", async function (req, res) {
  try {
    let query = {};
    // Construct the query object
    if (req.query.customers) {
      query["customer"] = { $in: req.query.customers.split(",") };
    }
    if (req.query.bikes) {
      query["bikes"] = { $in: req.query.bikes.split(",") };
    }
    let results = await Transaction.find(query).select({
      items: 0, actions: 0, repairs: 0,
      employee: 0, complete: 0, is_paid: 0, refurb: 0, paymentType: 0
    });
    if (req.query.description) {
      results = results.filter(x => {
        // Use search helper for description string
        return search(x.description, req.query.description);
      })
    }
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json(err);
  }
});

/**
 * GET: /search/ids
 * Gets all transaction IDs. Useful for searching.
 */
router.get("/search/ids", async (req, res) => {
  try {
    const distinct = await Transaction.distinct("_id");
    return res.status(200).json(distinct);
  } catch (err) {
    res.status(500).json(err);
  }
});

/*
Gets a single transaction - "GET /transactions/:id"
 */
router.get("/:id", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ err: "No transaction found", status: 404 });
    }
    res.status(200).json(transaction);
  } catch (err) {
    res.status(500).json(err);
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
    if (!transaction) return res.status(404).json({ err: "No transaction found", status: 404 });
    if (!req.headers["user-id"])
      return res.status(400).json({ err: "No user id provided", status: 400 });
    const user_id = req.headers["user-id"];
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ err: "No user found", status: 404 });
    transaction.description =
      req.body.description + "- " + user.firstname + " " + user.lastname;
    const loggedTransaction = await addLogToTransaction(
      transaction,
      req,
      "Updated Transaction Description"
    );
    const savedTransaction = await loggedTransaction.save();
    return res.status(200).json(savedTransaction);
  } catch (err) {
    res.status(500).json(err);
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
    if (!transaction) return res.status(404).json();
    transaction.complete = req.body.complete;
    transaction.urgent = false;
    if (req.body.complete) {
      transaction.date_completed = Date.now();
    }
    if (transaction.orderRequests.length > 0) {
      return res.status(403).json({ err: "Cannot complete transaction with waiting order requests", status: 403 });
    }
    // Update item inventory
    for (let item of transaction.items) {
      const found_item = await Item.findById(item.item._id);
      if (found_item.managed) continue; // Don't update stock on managed item
      if (req.body.complete) {
        await ItemController.decreaseItemStock(found_item._id, 1);
      } else {
        await ItemController.increaseItemStock(found_item._id, 1);
      }
      // send low stock email if needed
      /*
                Currently disabling this
              if (found_item.stock <= found_item.warning_stock) {
                User.find({roles:'operations'},function (err, user_array) {
                  for (user of user_array){
                      let email = user.username+'@rice.edu';
                      // IF you reenable this, convert the mailer line to use the "new mailer.send" call used in other endpoints in this code
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
    return res.status(200).json(savedTransaction);
  } catch (err) {
    if (err.err) {
      let status = 500;
      if (err.status) status = err.status;
      return res.status(status).json({ err: err.err, status: status });
    }
    return res.status(500).json(err);
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
      await mailer.send({
        message: {
          to: transaction.customer.email,
        },
        template: "email-receipt",
        // Objects in "locals" are accessible to the pug file
        locals: {
          transaction: transaction,
          date: moment().format("MMMM Do YYYY, h:mm:ss a"),
        }
      });
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
    res.status(200).json(savedTransaction);
  } catch (err) {
    res.status(500).json(err);
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
    if (!transaction) return res.status(404).json();
    // update the transaction's repair
    if (transaction.repairs.length === 0)
      return res
        .status(404)
        .json({ err: "No repairs associated with this transaction", status: 404 });
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
        return res.status(200).json(savedTransaction);
      }
    });
  } catch (err) {
    return res.status(500).json(err);
  }
});

/**
 * Mark a transaction as a beer bike or not
 * @param beerbike - if transaction is a beer bike or not
 */
router.put("/:id/beerbike", async (req, res) => {
    try {
        let transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json();

        transaction.beerbike = req.body.beerbike;

        let description = req.body.beerbike
            ? "Marked as Beer Bike"
            : "Unmarked as Beer Bike";
        const loggedTransaction = await addLogToTransaction(
            transaction,
            req,
            description
        );

        const savedTransaction = await loggedTransaction.save();
        return res.status(200).json(savedTransaction);
    } catch (err) {
        return res.status(500).json(err);
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
    if (!transaction) return res.status(404).json();
    // Only update the fields that this function is meant to handle
    // This function is being phased out in favor of individual endpoints for each element of transaction
    transaction.waiting_email = req.body.waiting_email;
    transaction.urgent = req.body.urgent;
    transaction.refurb = req.body.refurb;
    transaction.transaction_type = req.body.transaction_type;
    const savedTransaction = await transaction.save();
    return res.status(200).json(savedTransaction);
  } catch (err) {
    return res.status(500).json(err);
  }
});

/*
Deletes a single transaction - "DELETE /transactions/:id"
 */
router.delete("/:id", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ err: "No transaction found.", status: 404 });
    // Update order requests that reference this transaction.
    for (let request of transaction.orderRequests) {
      const requestRef = await OrderRequest.findById(request._id);
      requestRef.transactions = requestRef.transactions.filter(x => x != transaction._id);
      await requestRef.save();
    }
    await transaction.remove();
    res.status(200).json({ result: "OK", status: 200 });
  } catch (err) {
    res.status(500).json(err);
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
      if (!bike) return res.status(404).json({ err: "No bike found", status: 404 });
    } else {
      bike = await Bike.create({
        make: req.body.make,
        model: req.body.model,
        description: req.body.description,
      });
    }
    transaction.bikes.push(bike);
    let finalTransaction = await transaction.save();
    return res.status(200).json(finalTransaction);
  } catch (err) {
    res.status(500).json(err);
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
    res.status(200).json(finalTransaction);
  } catch (err) {
    res.status(500).json(err);
  }
});

/**
 *
 * @param {Transaction} transaction Transaction to add item to
 * @param {Item} item Item to add
 * @param {Number} custom_price: custom price for item
 */
async function addItemToTransaction(transaction, item, custom_price = 0) {
  let newItem;
  // Check to see if a custom price was given
  if (item.condition == 'Used' && custom_price != 0) {
    let price = custom_price;
    if (typeof price != 'number') {
      // Parse price
      price = parseFloat(price);
    }
    newItem = {
      item: item,
      price: price
    };
  }
  // Check if "customer" is employee
  else if (transaction.employee && item.wholesale_cost > 0) {
    // Apply employee pricing for this item.
    newItem = {
      item: item,
      price: truncate2(item.wholesale_cost * config.employee_price_multiplier),
    };
  }
  // Otherwise, apply default pricing
  else {
    newItem = { item: item, price: item.standard_price };
  }
  transaction.total_cost += newItem.price;
  transaction.items.push(newItem);
  // we save the transaction here to make sure the first item we added is saved to the database
  await transaction.save(); // save transaction before working on tax
  const taxedTransaction = await calculateTax(transaction);
  return taxedTransaction.save();
}

/**
 Adds an existing item to the transaction - "POST /transactions/items"
 Requires user's ID in header
 @param _id: id of item to add
 @param custom_price: Custom price to set for the item. Only able to be set for used items
 */
router.post("/:id/items", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ err: "No Transaction found", status: 404 });
    const item = await Item.findById(req.body._id);
    if (!item) return res.status(404).json({ err: "No item found", status: 404 });
    // Add the item to the transaction
    const taxedTransaction = await addItemToTransaction(transaction, item, req.body.custom_price);
    const loggedTransaction = await addLogToTransaction(
      taxedTransaction,
      req,
      `Added Item ${item.name}`
    );
    const finalTransaction = await loggedTransaction.save();
    res.status(200).json(finalTransaction);
  } catch (err) {
    if (err.err) {
      let status = 500;
      if (err.status) status = err.status;
      return res.status(status).json({ err: err.err, status: status });
    }
    res.status(500).json(err);
  }
});

/**
 *
 * @param {Transaction} transaction Transaction to remove item from
 * @param {Item} item item to remove
 */
async function removeItemFromTransaction(transaction, item) {
  // Find index of item to remove
  let index = transaction.items.findIndex(x => x.item._id.toString() == item._id.toString())
  if (index == -1) throw { "err": "could not find requested item in transaction's items array to delete", status: 404 };
  if (transaction.items[index].item.managed) throw { "err": "cannot remove 'managed' item", status: 403 };
  transaction.total_cost -= transaction.items[index].price;
  transaction.items.splice(index, 1);
  transaction = await transaction.save();
  let taxedTransaction = await calculateTax(transaction);
  return taxedTransaction.save();
}

/**
 * Requires user's ID in header
 * Deletes an item from a transaction - DELETE /transactions/$id/items
 */
router.delete("/:id/items/:item_id", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404);
    let item = await Item.findById(req.params.item_id);
    if (!item) return res.status(404).json({ "err": "could not find item to remove" })
    let action_description = `Deleted item ${item.name}`;
    let taxedTransaction = await removeItemFromTransaction(transaction, item);
    let loggedTransaction = await addLogToTransaction(
      taxedTransaction,
      req,
      action_description
    );
    let savedTransaction = await loggedTransaction.save();
    res.status(200).json(savedTransaction);
  } catch (err) {
    if (err.err) {
      let status = 500;
      if (err.status) status = err.status;
      return res.status(status).json({ err: err.err, status: status });
    }
    res.status(500).json(err);
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
    if (!transaction) return res.status(404).json({ err: "No transaction", status: 404 });
    if (!req.body._id) return res.status(400).json({ err: "No repair to add", status: 400 });
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
    res.status(200).json(savedTransaction);
  } catch (err) {
    res.status(500).json(err);
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
    res.status(200).json(savedTransaction);
  } catch (err) {
    res.status(500).json(err);
  }
});

/*
 Email handler
 */
router.get("/:id/email-notify", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404);
    await mailer.send({
      message: {
        to: transaction.customer.email,
      },
      template: "email-notify-ready",
      // Objects in locals are exposed to pug file
      locals: {
        transaction: transaction,
        first_name: transaction.customer.first_name,
      }
    })
    res.status(200).json({ "status": "OK" });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/:id/email-receipt", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404);
    await mailer.send({
      message: {
        to: transaction.customer.email,
      },
      template: "email-receipt",
      // Objects in "locals" are accessible to the pug file
      locals: {
        transaction: transaction,
        date: moment().format("MMMM Do YYYY, h:mm:ss a"),
      }
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

/**
 * Removes an order request from a transaction
 * @param {Transaction} transaction Transaction schema to remove order request from
 * @param {OrderRequest} orderRequest Order request to remove
 */
async function removeOrderRequestFromTransaction(transaction, orderRequest) {
  let index = transaction.orderRequests.findIndex(x => x._id.toString() == orderRequest._id.toString());
  if (index == -1) throw { "err": "No matching order request found to remove from transaction", status: 404 };
  transaction.orderRequests.splice(index, 1);
  let updatedTransaction = await transaction.save();
  return updatedTransaction;
}

/**
 * Adds an order request to a transaction
 * @param {Transaction} transaction Transaction schema to add order request to
 * @param {OrderRequest} orderRequest Order request to add
 */
async function addOrderRequestToTransaction(transaction, orderRequest) {
  if (transaction.complete) throw { "err": "Cannot add order requests to complete transactions", status: 400 };
  if (!transaction.orderRequests) transaction.orderRequests = [];
  transaction.orderRequests.push(orderRequest);
  let updatedTransaction = await transaction.save();
  return updatedTransaction;
}

module.exports = {
  router: router,
  addItemToTransaction: addItemToTransaction,
  removeItemFromTransaction: removeItemFromTransaction,
  addOrderRequestToTransaction: addOrderRequestToTransaction,
  removeOrderRequestFromTransaction: removeOrderRequestFromTransaction,
};
