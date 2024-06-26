const Threads = require("../models/threadSchema");
const Users = require("../models/UserSchema");
const Properties = require("../models/PropertySchema");
const PropertyShares = require("../models/PropertyShareSchema");
const { sendUpdateNotification } = require("./notificationController");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

const genNewRootThread = async (req, res) => {
  try {
    const { username, shareID, propertyID, category, threadBody, threadTitle } =
      req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      res.status(400).json({ message: "Try Again", success: false });
      throw new Error("user not found.");
    }

    const propertyFound = await Properties.findOne({
      propertyID: propertyID,
    });
    if (!propertyFound) {
      // res.status(400).json({ message: "", success: false });
      throw new Error("property not found.");
    }

    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
    });
    if (!propertyShareFound) {
      // res.status(400).json({ message: "", success: false });
      throw new Error("property share not found.");
    }

    const newRootThread = new Threads({
      shareDocID: propertyShareFound._id,
      propertyDocID: propertyFound._id,
      author: userFound._id,
      body: threadBody,
      category: category,
      title: threadTitle,
      status: "root",
    });

    newRootThread.save().then(() => {
      const subject = `Thread Started Successfully`;
      const body = `Dear ${userFound.name}, \nYour thread, with title: ${threadTitle}, has been created for community chat. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );
      res
        .status(201)
        .json({ message: "Thread created successfully.", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "genNewThread",
      fileLocation: "controllers/ThreadController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getAllThreadsByProperty = async (req, res) => {
  try {
    const { key } = req.params;

    const propertyFound = await Properties.findOne({ propertyID: key }, "_id");
    if (!propertyFound) {
      throw new Error("property not found.");
    }

    const threadList = await Threads.find({ propertyDocID: propertyFound._id })
      .populate("shareDocID", "availableInDuration")
      .populate("author", "name")
      .exec();

    res.status(200).json({
      message: "Fetched.",
      success: true,
      body: threadList,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getAllThreadsByProperty",
      fileLocation: "controllers/ThreadController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

module.exports = {
  genNewRootThread,
  getAllThreadsByProperty,
};
