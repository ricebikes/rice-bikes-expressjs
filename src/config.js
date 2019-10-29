

let CONFIG = function() {
  if (process.env.NODE_ENV == 'prod') {
    return {
      secret: 'TEST_SECRET',
      db_uri: 'mongodb://USERNAME:PASSWORD@localhost/bikes',
      CASValidateURL: 'https://idp.rice.edu/idp/profile/cas/serviceValidate',
      CASthisServiceURL: 'https://ricebikes.ml/auth',
      frontendURL: 'https://ricebikes.ml',
      email: {
        user: 'rbikesfinancial@gmail.com',
        pass: 'ricebikes2020',
        host: 'smtp.gmail.com',
        port: 465
      }
    }
  } else {
    return {
      secret: 'TEST_SECRET',
      db_uri: 'mongodb://bikesdev:itstacotime@localhost/bikes',
      CASValidateURL: 'https://idp.rice.edu/idp/profile/cas/serviceValidate',
      CASthisServiceURL: 'http://localhost:4200/auth',
      frontendURL: 'http://localhost:4200',
      email: {
        user: 'rbikesfinancial@gmail.com',
        pass: 'ricebikes2020',
        host: 'smtp.gmail.com',
        port: 587
      }
    }
  }
};

module.exports = CONFIG;
