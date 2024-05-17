const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  subject: { type: String, default: "" },
  body: { type: String, default: "" },
  sentChannels: { type: [], default: []},
  inAppStatus: { type: String, enum: ["read", "unread"], default: "unread" },
  username: { type: String, required: true },
});

const Notification = mongoose.model("notifications", NotificationSchema);

module.exports = Notification;
