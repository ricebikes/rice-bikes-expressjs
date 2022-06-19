const nodemailer = require("nodemailer");
const config = require('./config');
const Email = require("email-templates");
const path = require('path');


// https://dev.to/chandrapantachhetri/sending-emails-securely-using-node-js-nodemailer-smtp-gmail-and-oauth2-g3a
// https://medium.com/@nickroach_50526/sending-emails-with-node-js-using-smtp-gmail-and-oauth2-316fe9c790a1
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;

console.log(config)

const createTransporter = async () => {

    // use (insecure) ethereal auth if not in production
    if (process.env.NODE_ENV != 'prod') {
        return nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: true, // must use port 465
            auth: {
                user: config.email.user,
                pass: config.email.pass,
            },
        })
    }

    // otherwise use gmail oauth
    // i know its bad practice to use different schemas in auth and prod but too bad :(
    const oauth2Client = new OAuth2(
        config.email.clientId,
        config.email.clientSecret,
        "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
        refresh_token: config.email.refreshToken
    });

    // get an up to date access token
    // this is what prevents tokens from getting stale
    const accessToken = await new Promise((resolve, reject) => {
        oauth2Client.getAccessToken((err, token) => {
            if (err) {
                reject();
            }
            resolve(token);
        });
    });

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: config.email.user,
            accessToken,
            clientId: config.email.clientId,
            clientSecret: config.email.clientSecret,
            refreshToken: config.email.refreshToken
        }
    });

    return transporter;
};



const getMailer = async() => {
    let emailTransporter = await createTransporter();
    return new Email({
        message: {
            from: config.email.user
        },
        transport: emailTransporter,
        send: process.env.NODE_ENV == 'prod', // Only send in prod
        preview: process.env.NODE_ENV != 'prod', // in dev, preview email
        views: {
            root: path.join(__dirname, 'templates')
        }
    })
}


module.exports = getMailer;
