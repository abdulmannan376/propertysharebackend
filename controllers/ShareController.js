const PropertyShares = require("../models/PropertyShareSchema");
const Properties = require("../models/PropertySchema");
const Users = require("../models/UserSchema");
const Shareholders = require("../models/ShareholderSchema");
const { sendEmail } = require("../helpers/emailController");
const { listenerCount } = require("../models/PropertyRequestSchema");
const { sendUpdateNotification } = require("./notificationController");
const { default: mongoose } = require("mongoose");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

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
    // console.log("propertyShareFound: ", propertyShareFound);
    const propertyFound = await Properties.findOne({
      _id: propertyShareFound.propertyDocID._id,
    });

    if (!shareholderFound) {
      const userFound = await Users.findOne({ username: username });
      if (!userFound) {
        return res.status(400).json({ message: "Try again.", success: false });
      }
      const shareDocIDList = [];
      shareDocIDList.push({ shareDocID: propertyShareFound._id });

      const newShareholder = new Shareholders({
        userID: userFound._id,
        username: username,
        purchasedShareIDList: shareDocIDList,
      });

      await newShareholder.save();
      propertyShareFound.currentBoughtAt = price;
      propertyShareFound.utilisedStatus = "Purchased";
      propertyShareFound.currentOwnerDocID = newShareholder._id;

      propertyFound.stakesOccupied += 1;
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

    propertyShareFound.currentBoughtAt = price;
    propertyShareFound.utilisedStatus = "Purchased";
    propertyShareFound.currentOwnerDocID = shareholderFound._id;

    await propertyShareFound.save();

    const shareDocIDList = shareholderFound.purchasedShareIDList;
    shareDocIDList.push({ shareDocID: propertyShareFound._id });
    shareholderFound.purchasedShareIDList = shareDocIDList;

    propertyFound.stakesOccupied += 1;
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
      return res
        .status(400)
        .json({ message: "No Purchases found.", success: false });
    }

    const sharesByUsernamePromises = shareholderFound.purchasedShareIDList.map(
      (share) => {
        const shareDetail = PropertyShares.findOne(share.shareDocID)
          .populate(
            "propertyDocID",
            "propertyID imageDirURL imageCount title stakesOccupied totalStakes"
          )
          .exec();
        console.log("shareDetail: ", shareDetail);
        return shareDetail;
      }
    );

    const sharesByUsername = await Promise.all(sharesByUsernamePromises);

    console.log("sharesByUsername: ", sharesByUsername);

    // Assuming sharesByUsername is an array of share objects
    const sharesPerProperty = sharesByUsername.reduce((acc, share) => {
      console.log("acc: ", acc);
      const propertyID = share.propertyDocID.propertyID;
      // Check if the propertyID already has an entry in the accumulator
      if (acc[propertyID]) {
        // If yes, increment the count
        acc[propertyID].count++;
      } else {
        // If no, create a new entry
        acc[propertyID] = {
          propertyID: propertyID,
          propertyDetails: share.propertyDocID,
          count: 1,
        };
      }
      return acc;
    }, {});

    console.log(sharesPerProperty);

    // To convert the object back into an array if needed:
    const sharesPerPropertyArray = Object.values(sharesPerProperty);

    res.status(200).json({
      message: "Fetched data",
      success: true,
      body: {
        sharesPerProperty: sharesPerPropertyArray,
      },
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

const getSharesByProperty = async (req, res) => {
  try {
    const { key, status } = req.params;

    const propertySharesFound = await PropertyShares.find({
      propertyDocID: key,
      utilisedStatus: status,
    })
      .populate("currentOwnerDocID", "username")
      .exec();

    if (!propertySharesFound || propertySharesFound.length === 0) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    res.status(200).json({
      message: "Fetch successfull",
      success: true,
      body: propertySharesFound,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getSharesByProperty",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const openShareForRent = async (req, res) => {
  try {
    const { shareID, username } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
      utilisedStatus: "Purchased",
    });
    if (!propertyShareFound) {
      throw new Error("property share not available for rent.");
    }

    const propertyFound = await Properties.findOne({
      _id: propertyShareFound.propertyDocID,
    });

    propertyFound.stakesOnRent += 1;

    propertyShareFound.onRent = true;

    await propertyFound.save();

    propertyShareFound.save().then(() => {
      const subject = "Property Share is now available to rent.";
      const body = `Dear ${userFound.name}, Your share is now available to rent on our platform. Any requests can be seen in its specific community chat. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );

      res
        .status(200)
        .json({ message: "Successfully open for rent.", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "rentShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getRentSharesByProperty = async (req, res) => {
  try {
    const { key, category } = req.params;

    console.log(req.params);
    const matchQuery = { propertyDocID: new mongoose.Types.ObjectId(key) };

    if (category === "Rent") {
      matchQuery.onRent = true;
    } else if (category === "Sell") {
      matchQuery.onSale = true;
    }

    const pipeline = [];

    pipeline.push({ $match: matchQuery });

    console.log(pipeline)
    const sharesList = await PropertyShares.aggregate(pipeline);

    res.status(200).json({
      message: "Fetched",
      success: true,
      body: sharesList,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "rentShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const reserveShare = async (req, res) => {
  try {
    const { username, shareID } = req.body;
    const userFound = await Users.findOne({ username: username });
    if (!userFound) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
    })
      .populate("propertyDocID")
      .exec();

    const propertyFound = await Properties.findOne({
      _id: propertyShareFound.propertyDocID._id,
    });

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 2);

    console.log("startDate: ", startDate, "\nendDate", endDate);
    propertyShareFound.reservedByUserDocID = userFound._id;
    propertyShareFound.reservationDuration = {
      startDateTime: startDate.toISOString().split("T")[0],
      endDateTime: endDate.toISOString().split("T")[0],
    };

    propertyShareFound.utilisedStatus = "Reserved";

    propertyFound.stakesOccupied += 1;

    await propertyFound.save();

    console.log(propertyFound.stakesOccupied);

    propertyShareFound.save().then(() => {
      const recipient = userFound.email;
      const subject = "Successfull Reservation of Share.";
      const body = `Dear ${userFound.name}, \nThis email is to confirm your reservation of a share in property with Title: ${propertyShareFound.propertyDocID?.title}. This reservation will be removed from your reservations after 2 days from now please confirm you purchase as soon as possible. \nRegards, \nBeach Bunny House.`;

      sendEmail(recipient, subject, body);
    });
    res.status(201).json({ message: "Reservation successfull", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "reserveShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getReservationsByUsername = async (req, res) => {
  try {
    const { key } = req.params;

    const userFound = await Users.findOne({ username: key });

    if (!userFound) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    const reservedSharesList = await PropertyShares.find({
      reservedByUserDocID: userFound._id,
      utilisedStatus: "Reserved",
    })
      .populate(
        "propertyDocID",
        "propertyID imageDirURL imageCount title stakesOccupied totalStakes"
      )
      .exec();

    // Assuming sharesByUsername is an array of share objects
    const reservationsPerProperty = reservedSharesList.reduce((acc, share) => {
      const propertyID = share.propertyDocID.propertyID;
      // Check if the propertyID already has an entry in the accumulator
      if (acc[propertyID]) {
        // If yes, increment the count
        acc[propertyID].count++;
      } else {
        // If no, create a new entry
        acc[propertyID] = {
          propertyID: propertyID,
          propertyDetails: share.propertyDocID,
          count: 1,
        };
      }
      return acc;
    }, {});

    // To convert the object back into an array if needed:
    const reservationsPerPropertyArray = Object.values(reservationsPerProperty);

    res.status(200).json({
      message: " Fetched reservations",
      success: true,
      body: reservationsPerPropertyArray,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "reserveShare",
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
  getSharesByProperty,
  reserveShare,
  getReservationsByUsername,
  openShareForRent,
  getRentSharesByProperty,
};
