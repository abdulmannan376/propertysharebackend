const mongoose = require("mongoose");

const PropertyRequestSchema = new mongoose.Schema({
  requestID: { type: String },
  location: {
    type: {
      type: String, // Don't do `{ location: { type: String } }`
      enum: ["Point"], // 'location.type' must be 'Point'
      required: true,
    },
    coordinates: {
      type: [Number], // Array of numbers, [longitude, latitude]
      required: true,
    },
  },
  personDetails: {
    type: {
      name: String,
      email: String,
      contact: String,
    },
    required: true,
  },
  requirementDetails: {
    type: {
      propertyType: {
        type: String,
        enum: [
          "All",
          "Mansion",
          "Villa",
          "Apartment",
          "Suite",
          "Condo",
          "Townhouse",
          "Bungalow",
          "Cabin",
          "Studio",
          "Single family home",
        ],
        required: true,
      },
      areaRange: {
        type: [Number],
        required: true,
        validate: [arrayLimit, "{PATH} must have max 2 values"], // Custom validator for ensuring 2 values
      },
      priceRange: {
        type: [Number],
        required: true,
        validate: [arrayLimit, "{PATH} must have max 2 values"], // Custom validator for ensuring 2 values
      },
    },
    required: true,
  },
  notifyCount: { type: Number, default: 0 },
});

function arrayLimit(val) {
  return val.length <= 2;
}

// Helper function to pad the sequence number
function padNumber(num, size) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

// Pre-save middleware to generate a custom requestID
PropertyRequestSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "PRID"; // Property Requested ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["property_requestes"]
      ?.findOne({ requestID: new RegExp("^" + prefix + dateString) })
      .sort("-requestID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.requestID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.requestID = `${prefix}${dateString}${padNumber(nextSeqNumber, 4)}`;
  }
  next();
});

const PropertyRequest = mongoose.model(
  "property_requestes",
  PropertyRequestSchema
);

module.exports = PropertyRequest;
