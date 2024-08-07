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

    const threadFound = await Threads.findOne({
      shareDocID: propertyShareFound._id,
    });
    if (threadFound && threadFound.category === category) {
      return res
        .status(400)
        .json({ message: "Thread existed for this share.", success: false });
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

const addRootThreadToShare = async (req, res) => {
  try {
    const { shareID, username, body, category } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      res.status(400).json({ message: "Try Again", success: false });
      throw new Error("user not found.");
    }

    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
    });
    if (!propertyShareFound) {
      res.status(400).json({ message: "Try Again", success: false });
      throw new Error("property share not found.");
    }

    const newThread = new Threads({
      shareDocID: propertyShareFound._id,
      propertyDocID: propertyShareFound.propertyDocID,
      author: userFound._id,
      body: body,
      category: category,
      status: "root",
      threadLevel: "0",
    });

    newThread.save().then(() => {
      const subject = `Thread Added Successfully`;
      const body = `Dear ${userFound.name}, \nYour thread has been created for community chat. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );

      res
        .status(201)
        .json({ message: "Thread added successfully.", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "addRootThreadToShare",
      fileLocation: "controllers/ThreadController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getRootThreads = async (req, res) => {
  try {
    const { key, category } = req.params;

    const propertyShareFound = await PropertyShares.findOne({ shareID: key });
    if (!propertyShareFound) {
      // res.status(400).json({ message: "Try Again", success: false });
      throw new Error("property share not found.");
    }

    const threadsList = await Threads.find({
      shareDocID: propertyShareFound._id,
      status: "root",
      category: category
    }).populate("author", "name username");

    res.status(200).json({
      message: "Fetched",
      success: true,
      body: threadsList,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getRootThreads",
      fileLocation: "controllers/ThreadController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const genChildToRoot = async (req, res) => {
  try {
    const { username, threadID, threadBody, category, threadLevel } = req.body;

    console.log(req.body);

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      // res.status(400).json({ message: "lo", success: false });
      throw new Error("user not found.");
    }

    const parentThreadFound = await Threads.findOne({ threadID: threadID });
    if (!parentThreadFound) {
      // res.status(400).json({ message: "", success: false });
      throw new Error("parent thread not found.");
    }

    const newThread = new Threads({
      shareDocID: parentThreadFound.shareDocID,
      propertyDocID: parentThreadFound.propertyDocID,
      parentThreadDocID: parentThreadFound._id,
      author: userFound._id,
      body: threadBody,
      category: category,
      status: "child",
      threadLevel: threadLevel,
    });

    const threadChildern = [...parentThreadFound.childThreadDocIDsList];
    threadChildern.push(newThread._id);

    if (threadLevel === "2") {
      const rootThread = await Threads.findOne({
        _id: parentThreadFound.parentThreadDocID,
      });
      rootThread.childrenCount = +1;
      await rootThread.save();
    }

    parentThreadFound.childThreadDocIDsList = threadChildern;
    parentThreadFound.childrenCount = +1;

    await newThread.save();
    parentThreadFound.save().then(() => {
      const subject = `Thread Started Successfully`;
      const body = `Dear ${userFound.name}, \nYour thread has been added to community chat. \nRegards, \nBeach Bunny House.`;

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
      function: "genChildToRoot",
      fileLocation: "controllers/ThreadController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const genChildToChild = async (req, res) => {
  try {
    const {
      rootThreadID,
      threadID,
      username,
      propertyID,
      threadTitle,
      threadBody,
      category,
    } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      // res.status(400).json({ message: "lo", success: false });
      throw new Error("user not found.");
    }

    const propertyFound = await Properties.findOne({
      propertyID: propertyID,
    });
    if (!propertyFound) {
      // res.status(400).json({ message: "", success: false });
      throw new Error("property not found.");
    }

    const parentThreadFound = await Threads.findOne({ threadID: threadID });
    if (!parentThreadFound) {
      // res.status(400).json({ message: "", success: false });
      throw new Error("parent thread not found.");
    }

    const rootThreadFound = await Threads.findOne({ threadID: rootThreadID });
    if (!rootThreadFound) {
      // res.status(400).json({ message: "", success: false });
      throw new Error("root thread not found.");
    }

    const newThread = new Threads({
      shareDocID: parentThreadFound.shareDocID,
      propertyDocID: propertyFound._id,
      author: userFound._id,
      body: threadBody,
      category: category,
      title: threadTitle,
      status: "child",
    });

    const threadChildern = [...parentThreadFound.childThreadDocIDsList];
    threadChildern.push(newThread._id);

    parentThreadFound.childThreadDocIDsList = threadChildern;
    parentThreadFound.childrenCount = +1;

    rootThreadFound.childrenCount = +1;

    await newThread.save();
    parentThreadFound.save().then(() => {
      const subject = `Thread Started Successfully`;
      const body = `Dear ${userFound.name}, \nYour thread, with title: ${threadTitle}, has been added to community chat. \nRegards, \nBeach Bunny House.`;

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
      function: "genChildToRoot",
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
    const { propertyID, category } = JSON.parse(req.params.key);
    const propertyFound = await Properties.findOne(
      { propertyID: propertyID },
      "_id"
    );
    if (!propertyFound) {
      throw new Error("property not found.");
    }

    const threadList = await Threads.find({
      propertyDocID: propertyFound._id,
      category: category,
      status: "root",
    })
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

const getChildrenByParentThread = async (req, res) => {
  try {
    const { key } = req.params;

    const parentThreadFound = await Threads.findOne({ threadID: key });
    if (!parentThreadFound) {
      // res.status(400).json({ message: "", success: false });
      throw new Error("parent thread not found.");
    }

    if (parentThreadFound.childThreadDocIDsList.length === 0) {
      return res
        .status(200)
        .json({ message: "No more threads.", success: true });
    }

    const threadChilrenListPromises =
      parentThreadFound.childThreadDocIDsList.map((child) => {
        return Threads.findOne({ _id: child }).populate(
          "author",
          "name username"
        );
      });

    const threadChilrenList = await Promise.all(threadChilrenListPromises);

    res.status(200).json({
      message: "Fetched",
      success: true,
      body: threadChilrenList,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getChildrenByParentThread",
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
  genChildToRoot,
  getChildrenByParentThread,
  genChildToChild,
  addRootThreadToShare,
  getRootThreads,
};
