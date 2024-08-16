const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    conversationID: {
      type: String,
    },
    participants: [
      {
        type: mongoose.Types.ObjectId,
        ref: "users",
      },
    ],
    messages: {
      type: [mongoose.Types.ObjectId],
      ref: "messages",
    },
    lastMessage: {
      type: mongoose.Types.ObjectId,
      ref: "messages",
    },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1 });

// Helper function to pad the sequence number
function padNumber(num, size) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

// Pre-save middleware to generate a custom requestID
ConversationSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "UCID"; // User Conversation ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["conversations"]
      ?.findOne({ conversationID: new RegExp("^" + prefix + dateString) })
      .sort("-conversationID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.conversationID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.conversationID = `${prefix}${dateString}${padNumber(
      nextSeqNumber,
      4
    )}`;
  }
  next();
});

const Conversations = mongoose.model("conversations", ConversationSchema);

module.exports = Conversations;
