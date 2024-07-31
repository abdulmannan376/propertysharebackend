const mongoose = require("mongoose");

const ShareOfferSchema = new mongoose.Schema(
  {
    shareDocID: {
      type: mongoose.Types.ObjectId,
      ref: "property_shares",
      required: true,
    },
    shareOfferID: {
      type: String,
    },
    price: {
      type: Number,
      required: false,
      validate: [priceValidator, "{VALUE} must be greater than zero."], // Custom validator for ensuring 2 values
    },
    offeredShareDocID: {
      type: mongoose.Types.ObjectId,
      ref: "property_shares",
    },
    shareholderDocID: {
      type: mongoose.Types.ObjectId,
      ref: "shareholders",
      required: true,
    },
    userDocID: {
      type: mongoose.Types.ObjectId,
      ref: "users",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled", "expired"],
      default: "pending",
    },
    category: {
      type: String,
      enum: ["Rent", "Sell", "Swap"],
    },
    offerToPropertyOwner: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

function priceValidator(value) {
  return value > 0;
}

// Helper function to pad the sequence number
function padNumber(num, size) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

// Pre-save middleware to generate a custom requestID
ShareOfferSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "SOID"; // Share Offer ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["property_share_offers"]
      ?.findOne({ shareOfferID: new RegExp("^" + prefix + dateString) })
      .sort("-shareOfferID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.shareOfferID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.shareOfferID = `${prefix}${dateString}${padNumber(nextSeqNumber, 4)}`;
  }
  next();
});

const ShareOffer = mongoose.model("property_share_offers", ShareOfferSchema);

module.exports = ShareOffer;
