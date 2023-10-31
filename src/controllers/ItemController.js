var express = require("express");
var router = express.Router();
var bodyParser = require("body-parser");
var Item = require("../models/Item");
var adminMiddleware = require("../middleware/AdminMiddleware");
var authMiddleware = require("../middleware/AuthMiddleware");
const OrderRequest = require("./../models/OrderRequest");
const Order = require("../models/Order");
const KhsProduct = require("../models/KhsProduct");
const item_categories = require("../../config/item_categories");
const company_prefix = "011111"; // ?

router.use(bodyParser.json());

router.use(authMiddleware);

/**
 * GET: /categories
 * Allows frontend to produce a list of distinct item categories for users to select between when searching
 */
router.get("/categories", function (req, res) {
  res.status(200).json(item_categories);
});

/**
 * GET: /brands
 * Gets distinct brands known to the app, for use when searching
 */
router.get("/brands", function (req, res) {
  Item.distinct("brand", function (err, brands) {
    if (err) return res.status(500).json(err);
    res.status(200).json(brands);
  });
});

/**
 * /search accepts the following parameters:
 *  name: the name of the item.
 *  brand: item brand
 *  category_1,_2,_3: Item category
 *  upc: Item Universal Product Code (used items will lack one)
 */
router.get("/search", function (req, res) {
  // add all basic query parameters into object
  let query_object = {
    brand: req.query.brand,
    category_1: req.query.category_1,
    category_2: req.query.category_2,
    category_3: req.query.category_3,
    upc: req.query.upc,
  };
  // if our query defines a name, add that here. Required since the name portion uses indexed searching (for speed)
  if (req.query.name) {
    query_object["$text"] = { $search: req.query.name };
  }
  // nifty one liner to delete any null or undefined values so that we don't have to explicitly check earlier
  query_object = Object.entries(query_object).reduce(
    (a, [k, v]) => (v == null ? a : { ...a, [k]: v }),
    {}
  );
  Item.find(query_object, function (err, items) {
    if (err) return res.status(500).json(err);
    res.status(200).json(items);
  });
});

/**
 * GET /upc/khs/:upc
 * Searches khs for item matching the given upc
 * Used for refreshing an item client sise -- what does this mean? -jing
 */
router.get("/upc/khs/:upc", async function (req, res) {
  const upc = req.params.upc;

  try {
    const product = await KhsProduct.fetchProduct(upc);
    if (!product && !res.headersSent) {
      res.status(404).json({ ERROR: "UPC not found" });
    } else {
      // must be a product, otherwise headers would have been sent
      const itemJSON = await KhsProduct.validateItem(product);
      itemJSON.last_updated = new Date();
      res.status(200).json(itemJSON);
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

/**
 * GET /upc/newUPC
 * Searches mongo for the most recently manually created item with our company prefix (11111)
 * returns the item number + 1
 */
router.get("/upc/newUPC", async (req, res) => {
  let newUPC = company_prefix;
  let newProductNum;
  try {
    const item = await Item.find({ upc: { $regex: `${company_prefix}[0-9]*` } })
      .sort({ upc: -1 })
      .limit(1);
    if (item) {
      newProductNum = (parseInt(item[0].upc.substring(6, 11)) + 1).toString();
    }
  } catch {
    // start new
    newProductNum = "1";
  }

  // generate check digit
  for (let i = 0; i < 5 - newProductNum.length; i++) {
    newUPC += "0";
  }
  newUPC += newProductNum;

  // https://support.honeywellaidc.com/s/article/How-is-the-UPC-A-check-digit-calculated
  let checkDigit =
    10 -
    ((Array.from(newUPC)
      .filter((ch, idx) => idx % 2 == 0)
      .map((i) => parseInt(i))
      .reduce((sum, curr) => sum + curr) *
      3 +
      Array.from(newUPC)
        .filter((ch, idx) => (idx + 1) % 2 == 0)
        .map((i) => parseInt(i))
        .reduce((sum, curr) => sum + curr)) %
      10);
  if (checkDigit == 10) checkDigit = 0;
  newUPC += checkDigit;

  res.status(200).json(newUPC);
});

/**
 * PUT /upc/:upc
 * Create item corresponding to the given UPC if it does not exist
 * First searches Mongo, and then fals back to supplier
 * Returns.
 *  200 Item found in Mongo
 *  201 Item created from suppliers
 *  400 UPC not found in Mongo or suppliers
 */
router.put("/upc/:upc", async function (req, res) {
  const upc = req.params.upc;
  const query = { upc };

  // look for upc existing in database
  try {
    let item = await Item.findOne(query);
    if (item) {
      res.status(200).json(item);
    } else {
      const product = await KhsProduct.fetchProduct(upc);
      if (product) {
        const itemJSON = await KhsProduct.validateItem(product);
        itemJSON.last_updated = new Date();
        item = await Item.create(itemJSON);
        res.status(201).json(item);
      }
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ ERROR: "Unexpected error" });
  }

  if (!res.headersSent) res.status(400).json({ ERROR: "Unknown UPC" });
});

// everything below here is only for admins, so use the admin middleware to block it
router.use(adminMiddleware);

/**
 * POST: /
 * Adds a new item to the database.
 * parameters:
 * name: name of item. should have enough info to uniquely identify item
 * upc: item upc. required
 * category: item category
 * brand: item brand
 * standard_price: retail price of item
 * wholesale_cost: wholesale price we pay for item
 * in_stock: the quantity in stock
 */
// adds an item to the db. Note that quantity should start at 0
router.post("/", function (req, res) {
  const {
    name,
    upc,
    category_1,
    category_2,
    category_3,
    brand,
    standard_price,
    wholesale_cost,
    specifications,
    features,
    in_stock,
    is_khs,
  } = req.body;
  // validate the request before proceeding
  if (
    !(
      upc &&
      name &&
      category_1 &&
      brand &&
      standard_price != undefined &&
      wholesale_cost != undefined
    )
  ) {
    return res
      .status(400)
      .json({ err: "Malformed request, missing fields", status: 400 });
  }
  let newItem = {
    name: name,
    upc: upc,
    category_1: category_1,
    category_2: category_2,
    category_3: category_3,
    brand: brand,
    standard_price: standard_price,
    wholesale_cost: wholesale_cost,
    specifications: specifications,
    features: features,
    in_stock: in_stock,
  };
  if (is_khs) newItem.last_updated = new Date();
  Item.create(newItem, function (err, item) {
    if (err) return res.status(500).json(err);
    res.status(200).json(item);
    console.log("item", item);
  });
});

/**
 * Lets an item be updated. Simply overwrites the current item with whatever is sent.
 */
router.put("/:id", function (req, res) {
  const {
    name,
    upc,
    category_1,
    brand,
    standard_price,
    wholesale_cost,
  } = req.body;
  // validate the request before proceeding. Be less aggressive than we are when validating new items.
  if (
    !(
      upc &&
      name &&
      category_1 &&
      brand &&
      standard_price != undefined &&
      wholesale_cost != undefined
    )
  ) {
    return res
      .status(400)
      .json({ err: "Malformed request, missing fields", status: 400 });
  }
  Item.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true },
    function (err, item) {
      if (err) return res.status(500).json(err);
      if (!item) return res.status(404).send();
      console.log("compare current stock and min stock")
      console.log(item.in_stock, item.min_stock);
      if(item.in_stock < item.min_stock) {
        createOrUpdateOrderRequest(item);
      }
      return res.status(200).json(item);
    }
  );
});

/**
 * Gets all items from the backend. Notably, will NOT return managed items. These items are handled exclusively on the
 * backend, and removing or adding one to a transaction should not be possible.
 */
router.get("/", function (req, res) {
  Item.find({}, function (err, items) {
    if (err) return res.status(500).send(err);
    return res.status(200).send(items);
  });
});

/**
 * Adds an item to the active order requests by creating a new order request for it, or if an active
 * order request exists increments the quantity.
 * @param {Item} item Item schema to add order request for (or update an existing one)
 */
async function createOrUpdateOrderRequest(item) {
    // First, check if there is an existing incomplete order request
    let order_request = await OrderRequest.findOne({ itemRef: item._id, status: { $in: ['Not Ordered', 'In Cart'] } });
    if (!order_request) {
        // Assume that no active order request exists, create one.
        order_request = await OrderRequest.create({
            itemRef: item,
            request: item.name,
            category_1: item.category_1,
            category_2: item.category_2,
            category_3: item.category_3,
            quantity: item.min_stock || 0,
            transactions: [],
            notes: 'automatically created, please specify quantity',
            actions: []
        });
    } else {
      console.log('this order request already exists');
    }
}

/**
 * Raises the stock of an Item asynchronously
 * @param itemID: ID of Item to update stock of
 * @param quantity: amount to raise stock of item
 * @return {Promise<OrderRequest>}
 */
async function increaseItemStock(itemID, quantity) {
  console.log('increased item stock', itemID, quantity);
    // not using try/catch because we want errors to be caught by callers
    const itemRef = await Item.findById(itemID);
    if (!itemRef) {
        // throw error so the frontend knows something went wrong
        throw { err: "Stock update requested for invalid item", status: 400 };
    }
    itemRef.in_stock += quantity;
    /**
     * Check to see if we need to automatically create a new order request for this item.
     * This is done if the item's stock falls below the desired stock level.
     * Only do this if the desired stock is set above 0
     */
    // if (itemRef.stock < itemRef.desired_stock && itemRef.desired_stock > 0) {
    //     await createOrUpdateOrderRequest(itemRef);
    // }
    const restockedItem = await itemRef.save();
    console.log(restockedItem);
    if (!restockedItem) {
        throw { err: "Failed to save new stock state of item", status: 500 };
    }
    return restockedItem;
}

/**
 * Lowers the stock of an Item asynchronously
 * @param itemID: ID of Item to update stock of
 * @param quantity: amount to lower stock of item
 * @return {Promise<OrderRequest>}
 */
async function decreaseItemStock(itemID, quantity) {
    let restockedItem = await increaseItemStock(itemID, (-1) * quantity);
    return restockedItem;
}

module.exports = {
  router: router,
  increaseItemStock: increaseItemStock,
  decreaseItemStock: decreaseItemStock,
};
