const mongoose = require("mongoose");

const ShareOfferSchema = new mongoose.Schema({
  shareDocID: {
    type: mongoose.Types.ObjectId,
    ref: "property_shares",
    required: true,
  },
  price: {
    type: Number,
    required: true,
    validate: [priceValidator, "{VALUE} must be greater than zero."], // Custom validator for ensuring 2 values
  },
  ownerDocID: {
    type: mongoose.Types.ObjectId,
    ref: "users",
    required: true
  },
  userDocID: {
    type: mongoose.Types.ObjectId,
    ref: "users",
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending"
  },
  category: {
    type: String,
    enum: ["rent", "sell", "swap"]
  }
});

function priceValidator(value) {
  return value > 0;
}

const ShareOffer = mongoose.model("property_share_offers", ShareOfferSchema)

module.exports = ShareOffer
