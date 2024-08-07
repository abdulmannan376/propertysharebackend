const mongoose = require("mongoose");

const InspectionSchema = new mongoose.Schema(
  {
    inspectionID: {
      type: String,
    },
    status: {
      type: String,
      enum: [
        "Pending Admin Approval",
        "In Progress",
        "Pending Submission",
        "Verified",
      ],
      default: "Pending Submission",
    },
    imageDirURL: {
      type: "String",
      default: "",
    },
    imageCount: {
      type: Number,
      default: 0,
    },
    approvedByUsersList: {
      type: [String],
      default: [],
    },
    rejectedUsersList: {
      type: [String],
      default: [],
    },
    propertyDocID: {
      type: mongoose.Types.ObjectId,
      ref: "properties",
      required: true,
    },
    shareDocID: {
      type: mongoose.Types.ObjectId,
      ref: "property_shares",
      required: true,
    },
    propertyOwnerDocID: {
      type: mongoose.Types.ObjectId,
      ref: "shareholders",
      required: true,
    },
    shareholderDocID: {
      type: mongoose.Types.ObjectId,
      ref: "shareholders",
      required: true,
    },
    commentsByShareholder: {
      type: String,
      default: "",
    },
    threadsList: {
      type: [mongoose.Types.ObjectId],
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
InspectionSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "SIID"; // Share Inspection ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["property_inspections"]
      ?.findOne({ inspectionID: new RegExp("^" + prefix + dateString) })
      .sort("-inspectionID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.inspectionID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.inspectionID = `${prefix}${dateString}${padNumber(nextSeqNumber, 4)}`;
  }
  next();
});

const Inspections = mongoose.model("property_inspections", InspectionSchema);

module.exports = Inspections;
