const mongoose = require("mongoose");

const ShareholderSchema = new mongoose.Schema({
  userID: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "users",
  },
  username: {
    type: String,
    required: true,
  },
  purchasedShareIDList: {
    type: [
      {
        shareDocID: mongoose.Types.ObjectId,
      },
    ],
    default: [],
  },
  soldShareIDList: {
    type: [
      {
        shareDocID: mongoose.Types.ObjectId,
      },
    ],
    default: [],
  },
});

const Shareholders = mongoose.model("shareholders", ShareholderSchema)

module.exports = Shareholders
