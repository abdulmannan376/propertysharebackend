const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    notificationID: { type: String },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    sentChannels: { type: [], default: [] },
    inAppStatus: { type: String, enum: ["read", "unread"], default: "unread" },
    username: { type: String, required: true },
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
NotificationSchema.pre("save", async function (next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = `${today.getFullYear()}${padNumber(
      today.getMonth() + 1,
      2
    )}${padNumber(today.getDate(), 2)}`;
    const prefix = "NID"; // Notification ID

    // Find the last document created today with a similar prefix
    const lastEntry = await mongoose.models["properties"]
      ?.findOne({ notificationID: new RegExp("^" + prefix + dateString) })
      .sort("-notificationID");

    let nextSeqNumber = 1; // Default sequence number
    if (lastEntry) {
      const lastSeqNumber =
        parseInt(lastEntry.notificationID.slice(prefix.length + 8)) || 0;
      nextSeqNumber = lastSeqNumber + 1;
    }

    // Generate the full custom ID
    this.notificationID = `${prefix}${dateString}${padNumber(
      nextSeqNumber,
      4
    )}`;
  }
  next();
});

const Notification = mongoose.model("notifications", NotificationSchema);

module.exports = Notification;
