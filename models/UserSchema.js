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
  emailVerificationCode: { type: Number },
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
  notificationByIDList: { type: [mongoose.Types.ObjectId], default: [] },
});

const Users = mongoose.model("users", UserSchema);

module.exports = Users;
