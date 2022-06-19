// ensure config is loaded independently of the current working directory
process.env["NODE_CONFIG_DIR"] = __dirname + "/../config/";
module.exports = require('config');

// config files (located in /config/) are loaded one at a time depending on the environment
// defaults.EXT is loaded first
// prod.json is loaded after and overrides default values, only if process.NODE_ENV='prod'

// if prod.json is missing on rice-bikes-n1.rice.edu, it will need to be restored.
// contact Josh Schaffer for help