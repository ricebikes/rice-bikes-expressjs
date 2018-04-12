# rice-bikes-expressjs
ExpressJS/MongoDB backend for Rice Bikes

# Installation

This assumes you have Node and NPM installed. If you don't, install [Node.](https://nodejs.org)

    $> git clone https://github.com/rice-apps/rice-bikes-expressjs.git
    
    $> cd rice-bikes-expressjs
    
    $> npm install
  
# Usage

## To run in test:

    $> npm start
    
## To run in prod:

The file `/src/config.js` has a conditional for the `prod` environment variable, changing config settings from localhost to the actual URLS of the services. Run with the environment variable set to `prod` like so:
  
    $> NODE_ENV=prod npm start
    
