const { gateway } = require("../middleware/paymentConfig");
const Users = require("../models/UserSchema");
const Payments = require("../models/PaymentSchema");
const { default: mongoose } = require("mongoose");
const { buyShare } = require("./ShareController");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

const GetClientToken = async (req, res) => {
  try {
    const { clientToken } = await gateway.clientToken.generate({});

    res.status(201).json({
      message: "Client Token Generated",
      success: true,
      token: clientToken,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "GetClientToken",
      fileLocation: "controllers/PaymentController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const testCheckout = async (body, session) => {
  const { nonce, amount, username, purpose } = body;

  console.log(body);
  try {
    const result = await gateway.transaction.sale({
      amount: amount,
      paymentMethodNonce: nonce,
      options: {
        submitForSettlement: true,
      },
    });
    // console.log(result)
    if (result.success) {
      const { processorResponseType, id, paymentInstrumentType } =
        result.transaction;
      const userFound = await Users.findOne({ username: username }).session(
        session
      );

      // console.log(userFound);
      const newPayment = new Payments({
        gatewayTransactionID: id,
        purpose: purpose,
        paymentType: paymentInstrumentType,
        userDocID: userFound._id,
      });

      // console.log(newPayment);
      await newPayment.save({ session });

      return true;
    } else {
      console.log(result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "testCheckout",
      fileLocation: "controllers/PaymentController.js",
      timestamp: currentDateString,
    });
    return new Error(error.message || "Internal Server Error");
  }
};

const getPaymentsByUser = async (req, res) => {
  try {
    const { username } = req.query;

    console.log(req.query);
    const userFound = await Users.findOne({ username: username });

    const payments = await Payments.find({ userDocID: userFound._id }).populate(
      "userDocID",
      "name username"
    ).sort({ createdAt: -1})

    res.status(200).json({ message: "Fetched", body: payments, success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getPaymentsByUser",
      fileLocation: "controllers/PaymentController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

//Transaction Controllers
const buyShareTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { payment, data } = req.body;
    console.log(req.body);

    session.startTransaction();

    const paymentResult = await testCheckout(payment, session);
    if (paymentResult instanceof Error) {
      throw paymentResult;
    }

    const controllerResult = await buyShare(data, session);
    if (controllerResult instanceof Error) {
      throw controllerResult;
    }

    // session.commitTransaction()
    
    res.status(201).json({ message: "Transaction Successfull", success: true });
  } catch (error) {

    // session.abortTransaction()
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "buyShareTransaction",
      fileLocation: "controllers/PaymentController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  GetClientToken,
  testCheckout,
  getPaymentsByUser,
  buyShareTransaction,
};
