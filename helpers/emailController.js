const sgMail = require('@sendgrid/mail');

// Set your SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email sending function
function sendEmail(recipient, subject, body) {
  const msg = {
    to: recipient, // Recipient email
    from: 'info@beachbunnyhouse.com', // Verified SendGrid sender email
    subject: subject,
    text: body, // HTML content for the email
  };

  sgMail
    .send(msg)
    .then(() => {
      // Email sent successfully
      console.log(`Email with subject "${subject}" sent to ${recipient}`);
    })
    .catch((error) => {
      // Log error details
      console.error('Error sending email:', {
        message: error.message,
        response: error.response ? error.response.body : null,
        timestamp: new Date().toLocaleString(),
      });
    });
}

module.exports = { sendEmail };
