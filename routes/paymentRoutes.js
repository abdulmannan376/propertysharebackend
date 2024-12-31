const express = require("express");
const router = express.Router();
const PaymentController = require("../controllers/PaymentController");

//POST
router.post("/test-checkout", PaymentController.testCheckout);
router.post("/generate-payment", PaymentController.genPayment);
router.post("/buy-share-transaction", PaymentController.buyShareTransaction);
router.post("/orders", PaymentController.createPaypalOrder)
router.post("/orders/:orderID/capture", PaymentController.capturePaypalOrderPayment)
router.post("/payoutBatch", PaymentController.payoutBatch);


//PUT
router.put("/pending-payment-transaction", PaymentController.pendingPaymentTransaction)

//GET
router.get("/client-token", PaymentController.GetClientToken);
router.get("/get-payments-by-user", PaymentController.getPaymentsByUser);
router.get("/get-payments-by-reciever", PaymentController.getPaymentsByReciever)
router.get("/get-user-history", PaymentController.getUserTransactionHistory)

module.exports = router;
