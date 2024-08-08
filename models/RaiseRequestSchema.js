const mongoose = require("mongoose");

const RaisedRequestSchema = new mongoose.Schema(
  {
    raisedRequestID: {
      type: String,
    },
    shareholderDocID: {
      type: mongoose.Types.ObjectId,
      ref: "shareholders",
      required: true,
    },
    propertyDocID: {
      type: mongoose.Types.ObjectId,
      ref: "properties",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      required: true,
    },
    requestType: {
      type: String,
      required: true,
      enum: ["Modification", "Maintenance"],
    },
    estimatedPrice: {
      type: Number,
      required: true,
    },
    imageCount: {
      type: Number,
      default: 0,
    },
    imageDir: {
      type: String,
      default: "",
    },
    attachedURLsList: {
      type: [String],
      default: [],
    },
    approvedByUsersList: {
      type: [String],
      default: [],
    },
    rejectedByUsersList: {
      type: [String],
      default: [],
    },
    daysLeftForVoting: {
      type: Number,
      default: 5,
    },
    status: {
      type: String,
      enum: [
        "Decision Pending",
        "Payment Pending",
        "SuccessFull",
        "Property Owner Rejected",
        "Expired",
      ],
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
RaisedRequestSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "RRID"; // Raised Request ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["property_raised_requests"]
      ?.findOne({ raisedRequestID: new RegExp("^" + prefix + dateString) })
      .sort("-raisedRequestID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.raisedRequestID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.raisedRequestID = `${prefix}${dateString}${padNumber(
      nextSeqNumber,
      4
    )}`;
  }
  next();
});

const RaisedRequests = mongoose.model(
  "property_raised_requests",
  RaisedRequestSchema
);

module.exports = RaisedRequests;
