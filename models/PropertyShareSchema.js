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
    ref: "users",
    default: null,
  },
  availableInDuration: {
    type: {
      startDate: String,
      endDate: String,
    },
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
