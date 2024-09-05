const { gateway } = require("../middleware/paymentConfig");
const Users = require("../models/UserSchema");
const Payments = require("../models/PaymentSchema");
const { default: mongoose } = require("mongoose");
const {
  buyShare,
  shareRentAction,
  shareSellAction,
} = require("./ShareController");
const { sendUpdateNotification } = require("./notificationController");
const PropertyShare = require("../models/PropertyShareSchema");

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
  const { nonce, amount, username, purpose, paymentID } = body;

  console.log(body);
  try {
    const paymentFound = await Payments.findOne({ paymentID: paymentID });

    const result = await gateway.transaction.sale({
      amount: amount,
      paymentMethodNonce: nonce,
      options: {
        submitForSettlement: true,
      },
    });
    // console.log(result);
    if (result.success) {
      const { processorResponseType, id, paymentInstrumentType } =
        result.transaction;

      console.log(processorResponseType)
      if (paymentFound) {
        console.log("in if");

        const userFound = await Users.findOne({
          _id: paymentFound.initiatedBy,
        });

        await Payments.updateOne(
          { _id: paymentFound._id },
          {
            $set: {
              status: "Successful",
              gatewayTransactionID: id,
              paymentType: paymentInstrumentType,
            },
          },
          {
            session: session,
          }
        );

        await Users.updateOne(
          {
            _id: paymentFound.initiatedBy,
          },
          {
            $set: {
              availBalnc: userFound.availBalnc + paymentFound.payingAmount,
            },
          }
        );
      } else {
        console.log("in else")
        const { shareID } = body;

        const shareFound = await PropertyShare.findOne(
          { shareID: shareID },
          "propertyDocID"
        )
          .populate("propertyDocID", "publishedBy")
          .session(session);

        const userFound = await Users.findOne({ username: username }).session(
          session
        );

        const ownerFound = await Users.findOne({
          username: shareFound.propertyDocID.publishedBy,
        }).session(session);
        // console.log(userFound);
        const newPayment = new Payments({
          gatewayTransactionID: id,
          purpose: purpose,
          paymentType: paymentInstrumentType,
          userDocID: userFound._id,
          initiatedBy: ownerFound._id,
          totalAmount: amount,
          payingAmount: amount,
        });

        // console.log(newPayment);
        await newPayment.save({ session });

        await Users.updateOne(
          {
            _id: ownerFound._id,
          },
          {
            $set: {
              availBalnc: ownerFound.availBalnc + amount,
            },
          },
          { session }
        );
      }

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
    const { username, status } = req.query;

    let paymentStatus = status;

    if (paymentStatus === "all") {
      paymentStatus = ["Successful", "Cancelled", "Declined by gateway"];
    } else {
      paymentStatus = [status];
    }
    // console.log(req.query, paymentStatus);
    const userFound = await Users.findOne({
      username: username,
    });

    const payments = await Payments.find({
      userDocID: userFound._id,
      status: { $in: paymentStatus },
    })
      .populate("userDocID", "name username")
      .populate("initiatedBy", "name username")
      .populate("shareDocID", "shareID")
      .populate("shareOfferDocID", "shareOfferID offerToPropertyOwner")
      .sort({ createdAt: -1 });

    // console.log(payments, payments.length);
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

// Function to calculate discount by percentage
const calDiscountByPercentage = (totalAmount, discountValue) => {
  const discountAmount = (totalAmount * discountValue) / 100;
  return [totalAmount - discountAmount, discountAmount];
};

// Function to calculate discount by currency value
const calDiscountByCurrency = (totalAmount, discountValue) => {
  return [totalAmount - discountValue, discountValue];
};

const genPayment = async (req, res) => {
  try {
    const {
      recipient,
      username,
      purpose,
      amount,
      discountType,
      discountValue,
    } = req.body;

    console.log("body: ", req.body);
    const recipientFound = await Users.findOne({
      username: recipient,
    }).populate("userDefaultSettingID", "notifyUpdates");
    if (!recipientFound) {
      throw new Error("recipient not found.");
    }

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found.");
    }

    const totalAmount = amount;
    let payingAmount = amount;
    let discountAmount = 0;

    if (discountType !== "no discount") {
      if (discountType === "percentage")
        [payingAmount, discountAmount] = calDiscountByPercentage(
          totalAmount,
          discountValue
        );
      else if (discountType === "currency")
        [payingAmount, discountAmount] = calDiscountByCurrency(
          totalAmount,
          discountValue
        );
    }

    const newPayment = new Payments({
      initiatedBy: userFound._id,
      userDocID: recipientFound._id,
      status: "Pending",
      purpose: purpose,
      totalAmount: totalAmount,
      payingAmount: payingAmount,
      discountType: discountType,
      discountAmount: discountAmount,
    });

    await newPayment.save();

    const recipientEmailSubject = `Payment Action Required`;
    const recipientEmailBody = `Dear ${recipient.name}, \nA payment is generated against your username following are the details:\nTotal Amount: ${totalAmount} \nDiscount: ${discountAmount} \nSubtotal Amount: ${payingAmount} \nPurpose of payment: ${purpose} \nRegards, \nBeach Bunny House.`;

    sendUpdateNotification(
      recipientEmailSubject,
      recipientEmailBody,
      recipientFound.userDefaultSettingID.notifyUpdates,
      recipient
    );

    res.status(201).json({ message: "Payment generated", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "genPayment",
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

const handlePendingOfferPayments = async () => {
  try {
    const paymentsList = await Payments.find({
      status: "Pending",
      category: { $in: ["Rent Offer", "Sell Offer"] },
    }).populate("shareDocID", "shareID");

    for (const payment of paymentsList) {
      if (payment.category === "Rent Offer" && payment.shareDocID) {
        const data = { shareID: payment.shareDocID.shareID };
        shareRentAction(data, {}, "expired");
      } else if (payment.category === "Sell Offer" && payment.shareDocID) {
        const data = { shareID: payment.shareDocID.shareID };
        shareSellAction(data, {}, "expired");
      }
    }

    console.log(`${paymentsList.length} number of payments expired`);
    return true;
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handlePendingOfferPayments",
      fileLocation: "controllers/PaymentController.js",
      timestamp: currentDateString,
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

    const controllerResult = await buyShare(data, session);
    if (controllerResult instanceof Error) {
      throw controllerResult;
    }

    payment.shareID = data.shareID;
    const paymentResult = await testCheckout(payment, session);
    if (paymentResult instanceof Error) {
      throw paymentResult;
    }

    await session.commitTransaction()

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

const pendingPaymentTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { payment, data, category } = req.body;

    console.log(req.body);

    session.startTransaction();

    if (category === "Rent Offer") {
      const controllerResult = await shareRentAction(
        data,
        session,
        "payment proceed"
      );
      if (controllerResult instanceof Error) {
        throw controllerResult;
      }
    } else if (category === "Sell Offer") {
      const controllerResult = await shareSellAction(
        data,
        session,
        "payment proceed"
      );
      if (controllerResult instanceof Error) {
        throw controllerResult;
      }
    }

    const paymentResult = await testCheckout(payment, session);
    if (paymentResult instanceof Error) {
      throw paymentResult;
    }

    await session.commitTransaction();

    res.status(200).json({ message: "Transaction Successfull", success: true });
  } catch (error) {
    await session.abortTransaction();
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "pendingPaymentTransaction",
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

const rentOfferTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { payment, data } = req.body;

    session.startTransaction();

    const paymentResult = await testCheckout(payment, session);
    if (paymentResult instanceof Error) {
      throw paymentResult;
    }

    await session.commitTransaction();

    res.status(200).json({ message: "Transaction Successfull", success: true });
  } catch (error) {
    await session.abortTransaction();
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "rentOfferTransaction",
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
  genPayment,
  pendingPaymentTransaction,
  rentOfferTransaction,
  handlePendingOfferPayments,
};
