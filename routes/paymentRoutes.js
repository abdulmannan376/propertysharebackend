const express = require("express");
const router = express.Router();
const PaymentController = require("../controllers/PaymentController");

//POST
router.post("/test-checkout", PaymentController.testCheckout);
router.post("/generate-payment", PaymentController.genPayment);
router.post("/buy-share-transaction", PaymentController.buyShareTransaction);

//GET
router.get("/client-token", PaymentController.GetClientToken);
router.get("/get-payments-by-user", PaymentController.getPaymentsByUser);

module.exports = router;
