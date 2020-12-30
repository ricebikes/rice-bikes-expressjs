

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
      },
      tax: {
        cutoff_date: new Date(1580277600000), // 06:00 GMT on 1/29/2020 (Tax is only applied after this date)
        rate: 0.0825,
        DBname: "Sales Tax"
      },
      employee_price_multiplier: 1.0809 // 1.0809 * 1.0825 = 1.17
    }
  } else {
    return {
      secret: 'TEST_SECRET',
      db_uri: 'mongodb://bikesdev:itstacotime@localhost:27017/bikes',
      CASValidateURL: 'https://idp.rice.edu/idp/profile/cas/serviceValidate',
      CASthisServiceURL: 'http://localhost:4200/auth',
      frontendURL: 'http://localhost:4200',
      email: {
        user: 't4jves3pwjtt2svq@ethereal.email',
        pass: 'mPsJ9XKegskYgEaqZr',
        host: 'smtp.ethereal.email',
        port: 587
      },
      tax: {
        cutoff_date: new Date(1580277600000), // 06:00 GMT on 1/29/2020
        rate: 0.0825,
        DBname: "Sales Tax"
      },
      employee_price_multiplier: 1.0809 // 1.0809 * 1.0825 = 1.17
    }
  }
};

module.exports = CONFIG;
