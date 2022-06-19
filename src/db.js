const mongoose = require('mongoose');
const config = require('./config');

// use new URL parser
mongoose.set('useNewUrlParser', true);
// new Server and monitoring engine
mongoose.set('useUnifiedTopology', true);
// fix ensureIndexes deprecation
mongoose.set('useCreateIndex', true);


mongoose.connect(config.db_uri)
    .then(() => console.log("Database connected"))
    .catch(err => console.log("Error Connecting to Database" + err));
