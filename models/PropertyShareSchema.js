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
  tenantUserDocID: {
    type: mongoose.Types.ObjectId,
    ref: "users",
    default: null,
  },
  reservedByUserDocID: {
    type: mongoose.Types.ObjectId,
    ref: "users",
    default: null,
  },
  reservationDuration: {
    type: {
      startDateTime: Date,
      startDateString: String,
      endDateTime: Date,
      endDateString: String,
    },
  },
  availableInDuration: {
    type: {
      startDate: Date,
      startDateString: String,
      endDate: Date,
      endDateString: String,
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
  priceByCategory: {
    type: Number,
    default: 0,
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
  shareOffersList: {
    type: [mongoose.Types.ObjectId],
    ref: "property_share_offers",
    default: [],
  },
  currentInspectionDocID: {
    type: mongoose.Types.ObjectId,
    ref: "property_inspections",
    default: null,
  },
  inspectionIDList: {
    type: [mongoose.Types.ObjectId],
    required: false,
    ref: "property_inspections",
  },
  currentMaintainenceDocID: {
    type: mongoose.Types.ObjectId,
    ref: "property_raised_requests",
    default: null,
  },
  maintenanceIDList: {
    type: [mongoose.Types.ObjectId],
    required: false,
    ref: "property_raised_requests",
    default: [],
  },
  currentModificationDocID: {
    type: mongoose.Types.ObjectId,
    ref: "property_raised_requests",
    default: null,
  },
  modificationIDList: {
    type: [mongoose.Types.ObjectId],
    required: false,
    ref: "property_raised_requests",
    default: [],
  },
});

const PropertyShare = mongoose.model("property_shares", PropertyShareSchema);

module.exports = PropertyShare;
