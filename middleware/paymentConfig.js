const braintree = require('braintree');

const gateway = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId: "8b9hxjcwn8r3265p",
    publicKey: "bb7c33f2x3wtz7k2",
    privateKey: "628e2980f8e1bfea47673f237c1ca591"
})

module.exports = { gateway }