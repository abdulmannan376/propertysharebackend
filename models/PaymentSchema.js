const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    paymentID: { type: String },
    paymentType: {
      type: String,
      enum: ["credit_card", "card", "paypal"],
      default: "card",
    },
    gatewayTransactionID: {
      type: String,
      default: "",
    },
    companyFee: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    payingAmount: {
      type: Number,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["no discount", "percentage", "currency"],
      default: "no discount",
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    userDocID: {
      type: mongoose.Types.ObjectId,
      ref: "users",
    },
    initiatedBy: {
      type: mongoose.Types.ObjectId,
      ref: "users",
      default: null,
    },
    purpose: {
      type: String,
      required: true,
    },
    shareDocID: {
      type: mongoose.Types.ObjectId,
      ref: "property_shares",
      default: null,
    },
    shareOfferDocID: {
      type: mongoose.Types.ObjectId,
      ref: "property_share_offers",
      default: null,
    },
    raisedRequestDocID: {
      type: mongoose.Types.ObjectId,
      ref: "property_raised_requests",
      default: null,
    },
    status: {
      type: String,
      enum: ["Successful", "Pending", "Cancelled", "Declined by gateway", "Expired"],
      default: "Successful",
    },
    category: {
      type: String,
      enum: [
        "Rent Offer",
        "Sell Offer",
        "Buy Share",
        "Swap Offer",
        "Buy Back Offer",
        "Raised Request",
        "Any",
      ],
      default: "Any",
    },
  },
  { timestamps: true }
);

// Helper function to pad the sequence number
function padNumber(num, size) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

// Pre-save middleware to generate a custom requestID
PaymentSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "PID"; // Payment ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["payments"]
      ?.findOne({ paymentID: new RegExp("^" + prefix + dateString) })
      .sort("-paymentID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.paymentID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.paymentID = `${prefix}${dateString}${padNumber(nextSeqNumber, 4)}`;
  }
  next();
});

const Payments = mongoose.model("payments", PaymentSchema);

module.exports = Payments;
