const paypal = require("@paypal/paypal-server-sdk");

// Create PayPal Environment
const environment =
  process.env.NODE_ENV === "production"
    // ? new paypal.core.LiveEnvironment(
    //     process.env.PAYPAL_CLIENT_ID,
    //     process.env.PAYPAL_CLIENT_SECRET
    //   )
    // : new paypal.core.SandboxEnvironment(
    //     process.env.PAYPAL_CLIENT_ID,
    //     process.env.PAYPAL_CLIENT_SECRET
    //   );

// Create PayPal HTTP client
function createPayPalClient() {
  return new paypal.core.PayPalHttpClient(environment);
}

module.exports = { createPayPalClient };
