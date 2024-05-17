const express = require("express")
const router = express.Router()
const NotificationController = require("../controllers/notificationController")

router.get("/get-website-notifications/:key", NotificationController.getUpdateNotificationByWebsite)

module.exports = router