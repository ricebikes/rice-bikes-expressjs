

let CONFIG = function() {
  if (process.env.NODE_ENV == 'prod') {
    return {
      secret: 'TEST_SECRET',
      db_uri: 'mongodb://USERNAME:PASSWORD@localhost/bikes',
      CASValidateURL: 'https://idp.rice.edu/idp/profile/cas/serviceValidate',
      CASthisServiceURL: 'https://ricebikes.ml/auth',
      frontendURL: 'https://ricebikes.ml',
      email: {
        user: 't4jves3pwjtt2svq@ethereal.email',
        pass: 'mPsJ9XKegskYgEaqZr',
        host: 'smtp.ethereal.email',
        port: 587
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
        user: 't4jves3pwjtt2svq@ethereal.email',
        pass: 'mPsJ9XKegskYgEaqZr',
        host: 'smtp.ethereal.email',
        port: 587
      }
    }
  }
};

module.exports = CONFIG;
