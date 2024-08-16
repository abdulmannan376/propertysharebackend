const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    messageID: {
      type: String,
    },
    sender: {
      type: mongoose.Types.ObjectId,
      ref: "users",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    isLiked: {
      type: Boolean,
      default: false,
    },
    isOpened: {
      type: Boolean,
      default: false,
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
MessageSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "SMID"; // Sent Message ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["messages"]
      ?.findOne({ messageID: new RegExp("^" + prefix + dateString) })
      .sort("-messageID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.messageID.slice(prefix.length + 9)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.messageID = `${prefix}${dateString}${padNumber(nextSeqNumber, 5)}`;
  }
  next();
});

const Messages = mongoose.model("messages", MessageSchema);

module.exports = Messages;
