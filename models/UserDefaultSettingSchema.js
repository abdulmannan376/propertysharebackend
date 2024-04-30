const mongoose = require("mongoose");

const UserDefaultSettingSchema = new mongoose.Schema({
  currencyChoosen: { type: String, default: "$" },
  languageChoosen: { type: String, default: "en-us" },
  profileUpdated: { type: Boolean, default: false },
  paymentMethodAdded: { type: Boolean, default: false },
  areaUnit: { type: String, default: "sqft" },
  
});

const UserDefaultSettings = mongoose.model(
  "user default settings",
  UserDefaultSettingSchema
);

module.exports = UserDefaultSettings;
