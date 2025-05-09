const mongoose = require("mongoose");
const slugify = require("slugify");

const PropertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true },
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
    propertyType: {
      type: String,
      required: true,
      enum: [
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
    },
    area: { type: Number, required: true },
    totalStakes: { type: Number, default: 25 },
    stakesOccupied: { type: Number, required: true, default: 0 },
    stakesOnRent: { type: Number, required: true, default: 0 },
    stakesOnSale: { type: Number, required: true, default: 0 },
    stakesOnSwap: { type: Number, required: true, default: 0 },
    valueOfProperty: { type: Number, required: true },
    valuePerShare: { type: Number, required: true, default: 0 },
    addressOfProperty: {
      type: {
        houseNumber: String,
        streetNumber: String,
        zipCode: String,
        city: String,
        state: String,
        country: String,
        addressInString: String,
      },
    },
    status: {
      type: String,
      enum: ["Featured", "Non-Featured"],
      default: "Non-Featured",
    },
    featuredEndDate: {
      type: {
        date: Date,
        dateString: String,
      },
      default: null,
    },
    listingStatus: {
      type: String,
      enum: ["draft", "live", "pending approval", "hidden", "rejected"],
    },
    startDurationFrom: { type: Date, required: true },
    publishedBy: { type: String, required: true, desc: "username" },
    publisherRole: {
      type: String,
      enum: ["admin", "shareholder", "user", "super admin"],
      default: "user",
    },
    approvedBy: {
      type: String,
      default: "",
      desc: "username",
    },
    rejectedBy: {
      type: String,
      default: "",
      desc: "username",
    },
    viewedCount: { type: Number, default: 0 },
    detail: { type: String, required: true },
    attributesID: { type: mongoose.Types.ObjectId },
    pinnedImageIndex: { type: Number, default: -1 },
    imageDirURL: { type: String, default: "" },
    imageCount: { type: Number, default: 0 },
    propertyID: { type: String },
    shareDocIDList: {
      type: [],
      required: true,
    },
    amenitiesID: {
      type: mongoose.Types.ObjectId,
      ref: "property_amenities",
    },
    raisedRequest: {
      type: [mongoose.Types.ObjectId],
      ref: "property_raised_requests",
      default: [],
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
PropertySchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "PLID"; // Property Listing ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["properties"]
      ?.findOne({ propertyID: new RegExp("^" + prefix + dateString) })
      .sort("-propertyID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.propertyID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.propertyID = `${prefix}${dateString}${padNumber(nextSeqNumber, 4)}`;
  }
  next();
});
PropertySchema.index({ location: '2dsphere' });

const Properties = mongoose.model("properties", PropertySchema);

module.exports = Properties;
