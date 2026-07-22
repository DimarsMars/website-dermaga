const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,     // email pengirim
    pass: process.env.EMAIL_PASSWORD, // app password (bukan password biasa)
  },
});

module.exports = transporter;