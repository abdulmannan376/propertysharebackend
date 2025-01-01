const mongoose = require("mongoose");
const Properties = require("./PropertySchema");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  loggedIn: { type: Boolean, required: true },
  role: {
    type: String,
    required: true,
    enum: ["admin", "user", "shareholder", "super admin"],
  },
  contact: { type: Number, default: "" },
  emailVerificationCode: { type: Number },
  resetPasswordVerificationCode: { type: Number, default: 0 },
  resetPasswordVerified: { type: Boolean, required: true, default: false },
  emailVerified: { type: Boolean, required: true },
  userDefaultSettingID: {
    type: mongoose.Types.ObjectId,
    ref: "user_default_settings",
    required: true,
  },
  userProfile: {
    type: mongoose.Types.ObjectId,
    ref: "user_profiles",
    required: true,
  },
  isProfileCompleted: { type: Boolean, default: false },
  notificationByIDList: { type: [mongoose.Types.ObjectId], default: [] },
  availBalnc: { type: Number, default: 0 },
  withdrawalsListProcessed: {
    type: [mongoose.Types.ObjectId],
    ref: "withdrawals",
    default: [],
  },
});

const Users = mongoose.model("users", UserSchema);

module.exports = Users;
