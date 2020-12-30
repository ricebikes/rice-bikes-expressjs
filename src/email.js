const nodemailer = require("nodemailer");
const config = require('./config')();
const Email = require("email-templates");
const path = require('path');


const mailTransport = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: true, // must use port 465
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    },
})

// Create the email object that will tie in with our templates
const emailTemplate = new Email({
    message:{
        from: config.email.user
    },
    transport: mailTransport,
    send: process.env.NODE_ENV == 'prod', // Only send in prod
    preview: process.env.NODE_ENV != 'prod', // in dev, preview email
    views: {
        root: path.join(__dirname, 'templates')
    }
})


module.exports = emailTemplate;
