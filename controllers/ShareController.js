const PropertyShares = require("../models/PropertyShareSchema");
const Properties = require("../models/PropertySchema");
const Users = require("../models/UserSchema");
const Shareholders = require("../models/ShareholderSchema");
const { sendEmail } = require("../helpers/emailController");

const buyShare = async (req, res) => {
  try {
    const { username, shareID, price } = req.body;
    const shareholderFound = await Shareholders.findOne({ username: username })
      .populate("userID")
      .exec();

    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
    })
      .populate("propertyDocID")
      .exec();

    const propertyFound = await Properties.findOne({
      _id: propertyShareFound.propertyDocID._id,
    });

    if (!shareholderFound) {
      const userFound = await Users.findOne({ username: username });
      if (!userFound) {
        return res.status(400).json({ message: "Try again.", success: false });
      }
      const shareDocIDList = [];
      shareDocIDList.push({ shareID: propertyShareFound._id });

      const newShareholder = new Shareholders({
        userID: userFound._id,
        username: username,
        purchasedShareIDList: shareDocIDList,
      });

      await newShareholder.save();
      propertyShareFound.currentBoughtAt = price;
      propertyShareFound.utilisedStatus = "Purchased";
      propertyShareFound.currentOwnerDocID = newShareholder._id;

      propertyFound.stakesOccupied++;
      await propertyFound.save();

      propertyShareFound.save().then(() => {
        const recipient = userFound.email;
        const subject = "Successful Purchase of Share.";
        const body = `Dear ${userFound.name}, \nThis email is to confirm your purchase of a share in property with Title: ${propertyShareFound.propertyDocID?.title}. \nRegards, \nBeach Bunny House.`;

        sendEmail(recipient, subject, body);
      });
      return res
        .status(201)
        .json({ message: "Purchase successfull", success: true });
    }

    const shareDocIDList = shareholderFound.purchasedShareIDList;
    shareDocIDList.push({ shareID: propertyShareFound._id });
    shareholderFound.purchasedShareIDList = shareDocIDList;

    propertyFound.stakesOccupied++;
    await propertyFound.save();

    shareholderFound.save().then(() => {
      const recipient = shareholderFound.userID.email;
      const subject = "Successfull Purchase of Share.";
      const body = `Dear ${shareholderFound.userID.name}, \nThis email is to confirm your purchase of a share in property with Title: ${propertyShareFound.propertyDocID?.title}. \nRegards, \nBeach Bunny House.`;

      sendEmail(recipient, subject, body);
    });
    res.status(201).json({ message: "Purchase successfull", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "buyShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getBuySharesDetailByUsername = async (req, res) => {
  try {
    const { key } = req.params;

    const shareholderFound = await Shareholders.findOne({ username: key });

    if (!shareholderFound) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    const sharesByUsernamePromises = shareholderFound.purchasedShareIDList.map(
      (share) => {
        const shareDetail = PropertyShares.findOne(share.shareDocID);
        return shareDetail;
      }
    );

    const sharesByUsername = await Promise.all(sharesByUsernamePromises);

    res.status(200).json({
      message: "Fetched data",
      success: true,
      body: sharesByUsername,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getBuySharesDetailByUsername",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

module.exports = {
  buyShare,
  getBuySharesDetailByUsername,
};
