//////////////////uncomment this/////////////////////////////////////////////////
// const sgMail = require('@sendgrid/mail');

// // Set your SendGrid API Key
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// // Email sending function
// function sendEmail(recipient, subject, body) {
//   const msg = {
//     to: recipient, // Recipient email
//     from: 'info@beachbunnyhouse.com', // Verified SendGrid sender email
//     subject: subject,
//     text: body, // HTML content for the email
//   };

//   sgMail
//     .send(msg)
//     .then(() => {
//       // Email sent successfully
//       console.log(`Email with subject "${subject}" sent to ${recipient}`);
//     })
//     .catch((error) => {
//       // Log error details
//       console.error('Error sending email:', {
//         message: error.message,
//         response: error.response ? error.response.body : null,
//         timestamp: new Date().toLocaleString(),
//       });
//     });
// }
// module.exports = { sendEmail };
/////////////////////unComment this///////////////////////////////////////////////

/////////////////////Comment this///////////////////////////////////////////////

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

/////////////////////Comment this///////////////////////////////////////////////