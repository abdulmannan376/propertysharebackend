const mongoose = require("mongoose");

const ThreadSchema = new mongoose.Schema(
  {
    threadID: {
      type: String,
    },
    parentThreadDocID: {
      type: mongoose.Types.ObjectId,
      ref: "threads",
      default: null,
    },
    childThreadDocIDsList: {
      type: [mongoose.Types.ObjectId],
      ref: "threads",
      default: [],
    },
    childrenCount: {
      type: Number,
      default: 0
    },
    title: {
      type: String,
      default: "",
    },
    body: {
      type: String,
      required: true,
    },
    
    status: {
      type: String,
      enum: ["root", "child"],
      default: "child",
    },
    likedCount: {
      type: Number,
      default: 0,
    },
    author: {
      type: mongoose.Types.ObjectId,
      ref: "users",
      required: true,
    },
    shareDocID: {
      type: mongoose.Types.ObjectId,
      ref: "property_shares",
      required: true,
    },
    propertyDocID: {
      type: mongoose.Types.ObjectId,
      ref: "properties",
      required: true,
    },
    category: {
      type: String,
      enum: ["Rent", "Sell", "Swap"],
      required: true,
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

ThreadSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "THID"; // Thread ID prefix

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["threads"]
      ?.findOne({ threadID: new RegExp("^" + prefix + dateString) })
      .sort("-threadID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.threadID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.threadID = `${prefix}${dateString}${padNumber(nextSeqNumber, 4)}`;
  }
  next();
});

const Threads = mongoose.model("threads", ThreadSchema);

module.exports = Threads;
