const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema({
  userDocID: { type: mongoose.Types.ObjectId, ref: "users" },
  nationality: { type: String, default: "" },
  gender: { type: String, enum: ["Male", "Female", "Other"] },
  favouriteList: { type: [String], default: [] },
  wishList: { type: [String], default: [] },
  nicNumber: { type: String, default: "" },
  dobString: { type: String, default: "" },
  dob: { type: String, default: null },
  profilePicURL: { type: String, default: "" },
  idCardPicsDir: { type: String, default: "" },
  idAuthentic: {
    type: Boolean,
    default: false,
  },
  idCardFrontAdded: {
    type: Boolean,
    default: false,
  },
  passportFrontAdded: {
    type: Boolean,
    default: false,
  },
  religion: { type: String, default: "" },
  profileCompletePercentage: {
    type: Number,
    default: 0,
  },
  bloodGroup: {
    type: String,
    enum: ["", "O+", "O-", "A+", "A-", "AB+", "AB-", "B+", "B-"],
    default: "",
  },
  permanentAddress: { type: String, default: "" },
  nextOfKinDetails: {
    type: {
      fullName: String,
      relation: String,
      email: String,
      contact: String,
      nicNumber: String,
      dobString: String,
      dob: Date,
    },
    default: null,
  },
  paymentDetails: {
    type: {
      nameOnCard: String,
      cardNumber: String,
      cardExpiryMonth: Number,
      cardExpiryYear: Number,
      cardCVV: String,
    },
    default: null,
  },
  withdrawalDetails: {
    type: {
      accountTitle: String,
      ibanNumber: String,
      branchCode: String,
      swiftCode: String,
    },
    default: null,
  },
  payPalEmail: {
    type: String,
    default: "",
  },
  agreeCondition: {
    type: Boolean,
    default: false,
  },
  withdrawalMethodAdded: {
    type: Boolean,
    default: false,
  },
});

const UserProfile = mongoose.model("user_profiles", UserProfileSchema);

module.exports = UserProfile;
