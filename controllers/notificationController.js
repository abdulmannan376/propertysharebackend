const Notification = require("../models/NotificationSchema");
const Users = require("../models/UserSchema");
const currentDate = require("../helpers/currentDate");
const { sendEmail } = require("../helpers/emailController");

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

    sendingChannels.map(async (channel) => {
      if (channel === "email") {
        sendEmail(userFound.email, subject, body);
        newNotification.sentChannels.push("email");
      } else if (channel === "website") {
        newNotification.sentChannels.push("website");
      } else if (channel === "contact") {
        newNotification.sentChannels.push("contact");
      }
    });

    userFound.notificationByIDList.push(newNotification._id);
    await userFound.save();
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

    const updateNotificationList = await Notification.find({
      username: key,
      sentChannels: { $in: ["website"] },
    });

    res.status(200).json({
      message: "Fetched",
      success: true,
      body: {
        notificationList: updateNotificationList,
        notificationsCount: updateNotificationList.length,
      },
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "sendUpdateNotification",
      fileLocation: "controllers/notificationController.js",
      timestamp: currentDate,
    });
    return false;
  }
};

module.exports = { sendUpdateNotification, getUpdateNotificationByWebsite };
