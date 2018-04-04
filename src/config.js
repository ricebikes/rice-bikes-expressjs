

let CONFIG = function() {
  if (process.env.NODE_ENV == 'prod') {
    return {
      secret: 'TEST_SECRET',
      db_uri: 'mongodb://riceapps:r1ce4pps$wag1@ds121945.mlab.com:21945/ricebikes-dev',
      CASValidateURL: 'https://idp.rice.edu/idp/profile/cas/serviceValidate',
      CASthisServiceURL: 'http://bikes.riceapps.org/auth',
      frontendURL: 'http://bikes.riceapps.org',
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
      db_uri: 'mongodb://riceapps:r1ce4pps$wag1@ds121945.mlab.com:21945/ricebikes-dev',
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