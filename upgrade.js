#!/bin/mongo
// Load this file with mongo upgrade.js
// this will run on an unmodified copy of the current database, and get it ready for the POS systemc
conn = new Mongo();
db = conn.getDB("bikes");

// run the item update queries
print("Updating items")
db.items.update({},{$rename:{price:"standard_price",
                    quantity:"stock",
                    warning_quantity:"desired_stock",
                    shop_cost:"wholesale_cost"}}, false,true);
// Overwrite desired stock values.
db.items.update({},{$set:{managed:false,disabled:false,condition:"New",desired_stock:0}},false,true);
// now, update the transaction collection structure to match the the POS system (move item references)
cursor = db.transactions.find();
while (cursor.hasNext()) {
    transaction = cursor.next();
    print(transaction._id)
    let newItems = []
    for (let item of transaction.items) {
        const cur = db.items.find({_id:item});
        if (!cur.hasNext()){
            print("No Item resolved");
            throw new Error("Failed to resolve item");
        }
        let resolvedItem = cur.next();
        newItems.push({item: item, price: resolvedItem.standard_price});
    }
    // overwrite the current items for the transaction
    db.transactions.update({_id:transaction._id},{$set:{items: newItems, orderRequests:[]}})
    // Remove the "waiting on part" field
    db.transactions.update({_id:transaction._id},{$unset:{waiting_part:""}})
}
// create a "tax" item
db.items.insert({name:"Sales Tax", standard_price:0, disabled:false, managed:true});
