// Load this file with mongo upgrade.js
// this will run on an unmodified copy of the current database, and get it ready for the POS systemc
conn = new Mongo();
db = conn.getDB("bikes");

// run the item update queries
print("Updating items")
db.items.update({},{$set:{managed:false,disabled:false}},false,true);
db.items.update({},{$rename:{price:"standard_price",
                    quantity:"stock",
                    warning_quantity:"desired_stock",
                    shop_cost:"wholesale_cost"}}, false,true);
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
    db.transactions.update({_id:transaction._id},{$set:{items: newItems}})
}

