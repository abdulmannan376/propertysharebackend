const mongoose = require("mongoose");

const WithdrawalSchema = new mongoose.Schema(
  {
    withdrawalID: { type: String },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Dispatched", "Cancelled", "Expired","OnHold"],
      default: "Pending",
    },
    userDocID: {
      type: mongoose.Types.ObjectId,
      ref: "users",
      required: true,
    },
    imageDir: {
      type: String,
      default: "",
    },
    payPalEmail: {
      type: String,
      default: "",
    },
    agree: {
      type: Boolean,
      default: false,
    },
    payoutBatchId: { type: String, default: "" },
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
WithdrawalSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "WHID"; // Withdrawal ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["withdrawals"]
      ?.findOne({ withdrawalID: new RegExp("^" + prefix + dateString) })
      .sort("-withdrawalID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.withdrawalID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.withdrawalID = `${prefix}${dateString}${padNumber(nextSeqNumber, 4)}`;
  }
  next();
});

const Withdrawal = mongoose.model("withdrawals", WithdrawalSchema);

module.exports = Withdrawal;
