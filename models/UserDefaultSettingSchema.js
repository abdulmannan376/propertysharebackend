const mongoose = require("mongoose");

const UserDefaultSettingSchema = new mongoose.Schema({
  currencySymbol: { type: String, default: "$" },
  currencyShortName: { type: String, default: "USD" },
  languageChoosen: { type: String, default: "en_US" },
  profileUpdated: { type: Boolean, default: false },
  paymentMethodAdded: { type: Boolean, default: false },
  areaUnit: { type: String, default: "sqft" },
  notifyUpdates: { type: [String], enum: ["email", "website", "contact"], default: ["email"] },
  notifyMessages: { type: [String], enum: ["email", "website", "contact"] },
  lastPassword: { type: [String] },
});

const UserDefaultSettings = mongoose.model(
  "user_default_settings",
  UserDefaultSettingSchema
);

module.exports = UserDefaultSettings;
