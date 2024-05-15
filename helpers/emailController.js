const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "balaj.ali707@gmail.com",
    pass: "zyyo rgfk dsrr wxfx",
  },
});

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

function sendEmail(recipient, subject, body) {
  const mailOptions = {
    from: "balaj.ali707@gmail.com",
    to: recipient,
    subject: subject,
    text: body,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(`Error: ${error}`, "location: ", {
        function: "sendMail",
        fileLocation: "controllers/PropertyController.js",
        timestamp: currentDateString,
      });
    } else {
      // console.log(
      //   `success in function: sendEmail, file location: controllers/UsersController.js, timestamp: ${currentDateString}`
      // );
      console.log(`Mail with Subject: ${subject}, sent to ${recipient}`);
    }
  });
}

module.exports = { sendEmail };
