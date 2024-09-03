const braintree = require('braintree');

const gateway = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId: "sy79xtrd23nndmr8",
    publicKey: "7mpmjrncwgg3bvxb",
    privateKey: "34d979db025b1612561e14bd023dfd67"
})

module.exports = { gateway }

// merchantId: "8b9hxjcwn8r3265p",
// publicKey: "bb7c33f2x3wtz7k2",
// privateKey: "628e2980f8e1bfea47673f237c1ca591"