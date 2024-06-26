const mongoose = require("mongoose");

const PropertyShareSchema = new mongoose.Schema({
  shareID: {
    type: String,
    required: true,
  },
  propertyDocID: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "properties",
  },
  currentOwnerDocID: {
    type: mongoose.Types.ObjectId,
    ref: "shareholders",
    default: null,
  },
  reservedByUserDocID: {
    type: mongoose.Types.ObjectId,
    ref: "users",
    default: null,
  },
  reservationDuration: {
    type: {
      startDateTime: String,
      endDateTime: String,
    },
  },
  availableInDuration: {
    type: {
      startDate: String,
      endDate: String,
    },
  },
  onSwap: {
    type: Boolean,
    default: false,
  },
  onSale: {
    type: Boolean,
    default: false,
  },
  onRent: {
    type: Boolean,
    default: false,
  },
  utilisedStatus: {
    type: String,
    enum: [
      "Purchased",
      "Reserved",
      "On Rent",
      "On Swap",
      "In Use",
      "Completed",
      "Listed",
    ],
    default: "Listed",
  },
  currentBoughtAt: {
    type: Number,
    default: null,
  },
  lastOwners: {
    type: [
      {
        username: String,
        boughtAt: Number,
      },
    ],
    default: [],
  },
});

const PropertyShare = mongoose.model("property_shares", PropertyShareSchema);

module.exports = PropertyShare;
