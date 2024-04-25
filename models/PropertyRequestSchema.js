const mongoose = require("mongoose");

const PropertyRequestSchema = new mongoose.Schema({
  requestID: { type: String },
  coordinates: {
    type: {
      lat: String,
      long: String,
    },
    required: true,
  },
  personDetails: {
    type: {
      name: String,
      email: String,
      contact: String,
    },
    required: true,
  },
  notifyCount: { type: Number, default: 0 },
});

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
    const prefix = "PRID"; // Customize this prefix as needed

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["property_requests"]
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
