const express = require("express")
const router = express.Router()
const NotificationController = require("../controllers/notificationController")


//GET
router.get("/get-website-notifications/:key", NotificationController.getUpdateNotificationByWebsite)
router.put("/mark-notification-read/:key", NotificationController.markNotificationRead)

module.exports = router