const { gateway } = require("../middleware/paymentConfig");
const Users = require("../models/UserSchema");
const Payments = require("../models/PaymentSchema");
const ShareOffers = require("../models/PropertyShareOfferSchema");
const { default: mongoose } = require("mongoose");
const {
  buyShare,
  shareRentAction,
  shareSellAction,
} = require("./ShareController");
const axios = require("axios");
const { sendUpdateNotification } = require("./notificationController");
const PropertyShare = require("../models/PropertyShareSchema");
const { handleRaisedRequestPaymentAction } = require("./PropertyController");
const Withdrawal = require("../models/WithdrawalSchema");
const paypal = require("@paypal/paypal-server-sdk");
// const { createPayPalClient } = require("../middleware/paypalConfig");

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

const baseUrl = {
  sandbox: "https://api-m.sandbox.paypal.com",
};
const createPayPalClient = () => {
  return axios.create({
    // baseURL: process.env.PAYPAL_MODE === "sandbox"
    //   ?
    baseURL: "https://api-m.sandbox.paypal.com",
    // : "https://api-m.paypal.com",
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_CLIENT_SECRET,
    },
  });
};
async function generateAccessToken() {
  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");
    const response = await fetch(`${baseUrl.sandbox}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`, // Change 'Bearer' to 'Basic'
        "Content-Type": "application/x-www-form-urlencoded", // Required for form data
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
  }
}

// create an order
async function createOrder(paymentSource, amount) {
  try {
    const accessToken = await generateAccessToken();
    const url = `${baseUrl.sandbox}/v2/checkout/orders`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: amount,
            },
          },
        ],
        payment_source: {
          [paymentSource]: {}, // Dynamic payment source
        },
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(
        `PayPal API error: ${response.status} ${
          response.statusText
        } - ${JSON.stringify(errorDetails)}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating PayPal order:", error.message);
    throw error;
  }
}

// capture payment for an order
async function capturePayment(orderId) {
  // console.log("orderID: ", orderId);
  const accessToken = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/checkout/orders/${orderId}/capture`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();
  return data;
}

const capturePaypalOrderPayment = async (req, res) => {
  try {
    const { orderID } = req.params;

    const captureData = await capturePayment(orderID);
    res.json(captureData);
  } catch (err) {
    console.error("Error in capturePaypalOrder controller:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const createPaypalOrder = async (req, res) => {
  try {
    const { paymentSource, amount } = req.body;

    if (!paymentSource) {
      return res.status(400).json({ error: "Payment source is required." });
    }

    const order = await createOrder(paymentSource, amount);
    res.json(order);
  } catch (err) {
    console.error("Error in createPaypalOrder controller:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const testCheckout = async (body, session) => {
  const { amount, username, purpose, paymentID, orderID } = body;

  // console.log(body);
  try {
    const paymentFound = await Payments.findOne({ paymentID: paymentID });

    const result = await capturePayment(orderID);

    console.log(result);
    if (
      result?.purchase_units[0]?.payments?.captures[0].status === "COMPLETED"
    ) {
      const { id } = result?.purchase_units[0]?.payments?.captures[0];

      if (paymentFound) {
        console.log("in if");

        const userFound = await Users.findOne({
          _id: paymentFound.initiatedBy,
        }).populate("userProfile");

        const companyFeePercentage =
          parseInt(process.env.COMPANY_FEE_PERCENTAGE) / 100;
        const companyFee = Math.ceil(
          parseInt(paymentFound.payingAmount) * companyFeePercentage
        );

        await Payments.updateOne(
          { _id: paymentFound._id },
          {
            $set: {
              status: "Successful",
              gatewayTransactionID: id,
              paymentType: result.payment_source.card ? "card" : "paypal",
            },
          },
          {
            session: session,
          }
        );
        const withdrawalAmount = paymentFound.payingAmount - companyFee;
        const newWithdrawalRequest = new Withdrawal({
          amount: withdrawalAmount,
          userDocID: paymentFound.initiatedBy,
          payPalEmail: userFound.userProfile.payPalEmail, // Assuming userFound contains the email
          // payPalEmail: "sb-qznsj34320026@personal.example.com"
          agree: true, // Assuming agreement is true in this context
        });

        await newWithdrawalRequest.save({ session });

        // await Users.updateOne(
        //   {
        //     _id: paymentFound.initiatedBy,
        //   },
        //   {
        //     $set: {
        //       availBalnc:
        //         userFound.availBalnc + paymentFound.payingAmount - companyFee,
        //     },
        //   }
        // );
        /////////////////////test tommorow///////////////////////////////
        // const withdrawalList = await Withdrawal.find(
        //   { userDocID: userFound._id, status: { $in: ["Pending"] } },
        //   { amount: 1 } // Fetch only the amount field for efficiency
        // );

        // // Calculate total pending withdrawals
        // const totalPendingWithdrawals = withdrawalList.reduce(
        //   (sum, withdrawal) => sum + withdrawal.amount,
        //   0
        // );
        // console.log("Total Pending Withdrawals:", totalPendingWithdrawals);

        // await Users.updateOne(
        //   {
        //     _id: ownerFound._id,
        //   },
        //   {
        //     $set: {
        //       availBalnc: totalPendingWithdrawals + amount,
        //     },
        //   },
        //   // { session }
        // );
        /////////////////////test tommorow///////////////////////////////
      } else {
        console.log("in else");
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
        })
          .populate("userProfile")
          .session(session);
        // console.log(userFound);

        const companyFeePercentage =
          parseInt(process.env.COMPANY_FEE_PERCENTAGE) / 100;
        const companyFee = Math.ceil(parseInt(amount) * companyFeePercentage);

        const newPayment = new Payments({
          gatewayTransactionID: id,
          purpose: purpose,
          paymentType: result.payment_source.card ? "card" : "paypal",
          userDocID: userFound._id,
          initiatedBy: ownerFound._id,
          totalAmount: amount,
          companyFee: companyFee,
          payingAmount: amount,
        });

        // console.log(newPayment);
        await newPayment.save({ session });

        const newWithdrawalRequest = new Withdrawal({
          amount: amount,
          userDocID: ownerFound._id,
          payPalEmail: ownerFound.userProfile.payPalEmail,
          // payPalEmail: "sb-qznsj34320026@personal.example.com", // Assuming userFound contains the email
          agree: true, // Assuming agreement is true in this context
        });

        await newWithdrawalRequest.save({ session });
        //come here
        // await Users.updateOne(
        //   {
        //     _id: ownerFound._id,
        //   },
        //   {
        //     $set: {
        //       availBalnc: ownerFound.availBalnc + amount,
        //     },
        //   },
        //   { session }
        // );
      }

      return true;
    } else {
      console.log(result.status);
      throw new Error(result.status);
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
      .populate("raisedRequestDocID", "raisedRequestID")
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

const getPaymentsByReciever = async (req, res) => {
  try {
    const { username, status } = req.query;

    let paymentStatus = [
      "Successful",
      "Pending",
      "Cancelled",
      "Declined by gateway",
      "Expired",
    ];

    // console.log(req.query, paymentStatus);
    const userFound = await Users.findOne({
      username: username,
    });

    const payments = await Payments.find({
      initiatedBy: userFound._id,
      status: { $in: paymentStatus },
    })
      .populate("userDocID", "name username")
      .populate("initiatedBy", "name username")
      .populate("shareDocID", "shareID")
      .populate("shareOfferDocID", "shareOfferID offerToPropertyOwner")
      .populate("raisedRequestDocID", "raisedRequestID")
      .sort({ createdAt: -1 });

    // console.log(payments, payments.length);
    res.status(200).json({ message: "Fetched", body: payments, success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getPaymentsByReciever",
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

const getUserTransactionHistory = async (req, res) => {
  try {
    const { username } = req.query;

    // Define successful status for both Payments and Withdrawals
    const successfulStatus = ["Successful"];

    // Find user by username
    const userFound = await Users.findOne({ username: username });

    if (!userFound) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    // Fetch successful payments initiated by the user
    const payments = await Payments.find({
      initiatedBy: userFound._id,
      status: { $in: successfulStatus },
    })
      .populate("userDocID", "name username")
      .populate("initiatedBy", "name username")
      .lean(); // Use lean() for better performance if no need to modify data later

    // Add paymentType 'Credit' for payments
    const formattedPayments = payments.map((payment) => ({
      ...payment,
      paymentType: "Credit", // Flag as credit
      timestamp: payment.createdAt, // Add timestamp field for sorting
    }));

    // Fetch successful withdrawals where the user is involved
    const withdrawals = await Withdrawal.find({
      userDocID: userFound._id,
      status: "Dispatched",
    })
      .populate("userDocID", "name username")
      .lean();

    // Add paymentType 'Debit' for withdrawals
    const formattedWithdrawals = withdrawals.map((withdrawal) => ({
      ...withdrawal,
      paymentType: "Debit", // Flag as debit
      timestamp: withdrawal.createdAt, // Add timestamp field for sorting
    }));

    // Merge payments and withdrawals into a single list
    const allTransactions = [...formattedPayments, ...formattedWithdrawals];

    // Sort by timestamp (latest first)
    const sortedTransactions = allTransactions.sort(
      (a, b) => a.timestamp - b.timestamp
    );

    // Respond with the merged and sorted transactions
    res.status(200).json({
      message: "Fetched",
      body: sortedTransactions,
      success: true,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getUserTransactionHistory",
      fileLocation: "controllers/PaymentController.js",
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error,
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
    const recipientEmailBody = `Dear ${recipient.name}, \nA payment is generated against your username following are the details:\nTotal Amount: ${totalAmount} \nDiscount: ${discountAmount} \nSubtotal Amount: ${payingAmount} \nPurpose of payment: ${purpose} Payment Pending. \n Please go to the "Bills and Payments" tab, then to "Pending Payments" to clear the payment. It will expire in 6 hours\n Click the link below to pay:\nhttps://www.beachbunnyhouse.com/user/${recipient.username} \nRegards, \nBeach Bunny House.`;

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
  console.log(
    "Starting handlePendingOfferPayments job at",
    new Date().toISOString()
  );
  const session = await mongoose.startSession();
  try {
    // Start transaction before fetching payments
    session.startTransaction();

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const paymentsList = await Payments.find({
      status: "Pending",
      category: { $in: ["Rent Offer", "Sell Offer"] },
      createdAt: { $lt: sixHoursAgo }, // Only include records created more than 1 minute ago
    })
      .populate("shareDocID", "shareID")
      .session(session);

    // Process each payment
    for (const payment of paymentsList) {
      try {
        if (!payment.shareDocID) {
          continue;
        }
        // console.log("payment.shareDocID.shareID", payment);
        // const shareOfferFound = await ShareOffers.findOne({
        //   _id: payment.shareOfferDocID.toString(),
        // }).session(session);
        // console.log("shareOfferFound",shareOfferFound);

        const data = {
          shareID: payment.shareDocID.shareID,
          shareOfferID: payment.shareOfferDocID.toString(),
        };

        if (payment.category === "Rent Offer") {
          console.log(`Processing Rent Offer payment ID: ${payment._id}`);
          await shareRentAction(data, session, "expired");
        } else if (payment.category === "Sell Offer") {
          console.log(
            `Processing Sell Offer payment ID: ${payment._id}, shareID: ${data.shareID}`
          );
          await shareSellAction(data, session, "expired");
        }
      } catch (paymentError) {
        console.error({
          message: `Error processing payment`,
          paymentId: payment._id,
          category: payment.category,
          error: paymentError.message,
          timestamp: new Date().toISOString(),
        });
        // Continue processing other payments even if one fails
      }
    }
    // Commit transaction
    console.log("Committing transaction...");
    await session.commitTransaction();
    console.log(`${paymentsList.length} number of payments expired`);
    return true;
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handlePendingOfferPayments",
      fileLocation: "controllers/PaymentController.js",
      timestamp: currentDateString,
    });
    await session.abortTransaction();
  } finally {
    // Clean up session
    await session.endSession();
    console.log("handlePendingOfferPayments job completed.");
  }
};

//Transaction Controllers
const buyShareTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { payment, data } = req.body;
    console.log("payment-->", payment, "data-->", data);

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

    await session.commitTransaction();

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
    } else if (category === "Raised Request") {
      const controllerResult = await handleRaisedRequestPaymentAction(
        data,
        session
      );
      if (controllerResult instanceof Error) {
        throw controllerResult;
      }
    } else if (category === "Buy Share") {
      const controllerResult = await buyShare(
        data,
        session
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
const processAdminApprovedWithdrawal = async (session, body) => {
  const { amount, paypalEmail, withdrawalID } = body;

  const withdrawal = await Withdrawal.findOne({
    withdrawalID: withdrawalID,
  })
    .populate({
      path: "userDocID",
      model: "users",
      select: "userDefaultSettingID username name availBalnc",
      populate: {
        path: "userDefaultSettingID",
        model: "user_default_settings",
        select: "notifyUpdates",
      },
    })
    .session(session);

  if (!withdrawal || withdrawal.status !== "Pending") {
    throw new Error("Invalid or already processed withdrawal request.");
  }

  const payoutRequest = {
    sender_batch_header: {
      sender_batch_id: `batch_${Date.now()}`,
      email_subject: "You have received a payment",
      email_message: `You have received ${amount} USD.`,
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: {
          value: amount.toFixed(2),
          currency: "USD",
        },
        receiver: paypalEmail,
        note: "Withdrawal payment",
      },
    ],
  };

  const paypalClient = createPayPalClient();
  const { data: payoutResponse } = await paypalClient.post(
    "/v1/payments/payouts",
    payoutRequest
  );

  if (
    !payoutResponse.batch_header ||
    !payoutResponse.batch_header.payout_batch_id
  ) {
    throw new Error(
      `Failed to process payout: ${JSON.stringify(payoutResponse)}`
    );
  }

  await Withdrawal.updateOne(
    { _id: withdrawal._id },
    {
      $set: {
        status: "Dispatched",
        payoutBatchId: payoutResponse.batch_header.payout_batch_id,
      },
    }
  ).session(session);

  const emailSubject = `Withdrawal (${withdrawal.withdrawalID}) Dispatched`;
  const emailBody = `Dear ${withdrawal.userDocID.name},\nYour withdrawal request (${withdrawal.withdrawalID}) for $${withdrawal.amount} has been dispatched successfully. \n Please go to the "Withdrawal Management" tab, then to "My Withdrawals" to check the Amount.\n Click the link below to Check:\nhttps://www.beachbunnyhouse.com/user/${withdrawal.userDocID.username} \nRegards, \nBeach Bunny House.`;

  sendUpdateNotification(
    emailSubject,
    emailBody,
    withdrawal.userDocID.userDefaultSettingID.notifyUpdates,
    withdrawal.userDocID.username
  );

  return {
    payoutBatchId: payoutResponse.batch_header.payout_batch_id,
    success: true,
  };
};

const payoutBatch = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { payoutBatchId } = req.body;

    if (!payoutBatchId) {
      return res.status(400).json({
        message: "payoutBatchId is required.",
        success: false,
      });
    }

    const paypalClient = createPayPalClient(); // Initialize the PayPal client

    // // Fetch payout details from PayPal
    const { data: payoutDetails } = await paypalClient.get(
      `/v1/payments/payouts/${payoutBatchId}`
    );
    res.status(200).json({
      message: "Payout details and receipt image fetched successfully.",
      data: {
        payoutDetails,
      },
      success: true,
    });
  } catch (error) {
    console.error(`Error: ${error}`, "\nLocation: ", {
      function: "payoutBatch",
      fileLocation: "controllers/PaymentController.js",
      timestamp: new Date().toISOString(),
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
const processPendingWithdrawals = async () => {
  console.log(
    "Starting processPendingWithdrawals job at",
    new Date().toISOString()
  );

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const pendingWithdrawals = await Withdrawal.find({
      status: "Pending",
      createdAt: { $lte: oneHourAgo },
    });

    console.log(
      `Found ${pendingWithdrawals.length} pending withdrawals to process.`
    );

    for (const withdrawal of pendingWithdrawals) {
      const { amount, payPalEmail, withdrawalID } = withdrawal;

      // Validate required fields
      if (!amount || !payPalEmail || !withdrawalID) {
        console.warn(
          `Skipping withdrawal ID: ${withdrawal.withdrawalID}. Missing required fields:`,
          { amount, payPalEmail, withdrawalID }
        );
        continue;
      }

      try {
        console.log(`Processing withdrawal ID: ${withdrawal.withdrawalID}`);

        await processAdminApprovedWithdrawal(session, {
          amount,
          paypalEmail: payPalEmail,
          withdrawalID,
        });

        console.log(
          `Successfully processed withdrawal ID: ${withdrawal.withdrawalID}`
        );
      } catch (error) {
        console.error(
          `Error processing withdrawal ID: ${withdrawal.withdrawalID}`,
          error
        );
      }
    }

    await session.commitTransaction();
    console.log("Completed processPendingWithdrawals job.");
  } catch (error) {
    console.error("Error in processPendingWithdrawals job:", error);
    await session.abortTransaction();
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
  getPaymentsByReciever,
  getUserTransactionHistory,
  createPaypalOrder,
  capturePaypalOrderPayment,
  processAdminApprovedWithdrawal,
  payoutBatch,
  processPendingWithdrawals,
};
