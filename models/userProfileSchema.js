const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema({
  nationality: { type: String, default: "" },
  gender: { type: String, enum: ["Male", "Female", "Other"] },
  favouriteList: { type: [String], default: [] },
  wishList: { type: [String], default: [] },
  nicNumber: { type: String, default: "" },
  dob: { type: String, default: "" },
  profilePicURL: { type: String, default: "" },
});

const UserProfile = mongoose.model("user_profiles", UserProfileSchema);

module.exports = UserProfile;
