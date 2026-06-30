const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // atau SMTP lain
  auth: {
    user: process.env.EMAIL_USER,     // email pengirim
    pass: process.env.EMAIL_PASSWORD, // app password (bukan password biasa)
  },
});

module.exports = transporter;