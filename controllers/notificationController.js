const Notification = require("../models/NotificationSchema");
const Users = require("../models/UserSchema");
const currentDate = require("../helpers/currentDate");
const { sendEmail } = require("../helpers/emailController");
const { io, getRecieverID } = require("../socket/socket");

async function sendUpdateNotification(
  subject,
  body,
  sendingChannels,
  username
) {
  try {
    const newNotification = new Notification({
      subject: subject,
      body: body,
      username: username,
    });
    const userFound = await Users.findOne({ username: username });

    userFound.notificationByIDList.push(newNotification._id);

    const savedData = await Promise.all([
      userFound.save(),
      newNotification.save(),
    ]);
    sendingChannels.map(async (channel) => {
      if (channel === "email") {
        sendEmail(userFound.email, subject, body);
        newNotification.sentChannels.push("email");
      } else if (channel === "website") {
        newNotification.sentChannels.push("website");
        const recieverSocketID = getRecieverID(username);
        console.log("in sendUpdateNotification", recieverSocketID);
        io.to(recieverSocketID).emit("getNewNotification", savedData[1]);
      } else if (channel === "contact") {
        newNotification.sentChannels.push("contact");
      }
    });

    await newNotification.save();

    return true;
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "sendUpdateNotification",
      fileLocation: "controllers/notificationController.js",
      timestamp: currentDate,
    });
    return false;
  }
}

const getUpdateNotificationByWebsite = async (req, res) => {
  try {
    const { key } = req.params;

    const userFound = await Users.findOne({ username: key })
      .populate("userDefaultSettingID")
      .exec();

    if (!userFound.userDefaultSettingID.notifyUpdates.includes("website")) {
      return res.status(403).json({
        message: "Notifications disabled for website.",
        success: false,
      });
    }

    const pipeline = [
      {
        $match: {
          username: key,
          sentChannels: { $in: ["website"] },
        },
      },
      { $sort: { createdAt: -1 } },
    ];
    const updateNotificationList = await Notification.aggregate(pipeline);

    const unreadNotifications = updateNotificationList.filter(
      (notification) => notification.inAppStatus === "unread"
    );

    res.status(200).json({
      message: "Fetched",
      success: true,
      body: {
        notificationList: updateNotificationList,
        notificationsCount: unreadNotifications.length,
      },
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getUpdateNotificationByWebsite",
      fileLocation: "controllers/notificationController.js",
      timestamp: currentDate,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { key } = req.params;
    console.log(key);
    const notificationFound = await Notification.findOne({
      notificationID: key,
    });

    if (!notificationFound) {
      throw new Error("notification not found in database.");
    }
    console.log("notification: ", notificationFound);
    notificationFound.inAppStatus = "read";

    notificationFound.save().then(() => {
      res
        .status(200)
        .json({ message: "Notification marked read", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "markNotificationRead",
      fileLocation: "controllers/notificationController.js",
      timestamp: currentDate,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

module.exports = {
  sendUpdateNotification,
  getUpdateNotificationByWebsite,
  markNotificationRead,
};
