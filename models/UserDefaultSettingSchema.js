const mongoose = require("mongoose")

const UserDefaultSettingSchema = new mongoose.Schema({
    currencyChoosen: { type: String, default: "$"},
    languageChoosen: { type: String, default: "en-us"},
    
})

const UserDefaultSettings = mongoose.model("user default settings", UserDefaultSettingSchema)

module.exports = UserDefaultSettings