const express = require("express");
const router = express.Router();

const ShareController = require("../controllers/ShareController");

//POST
router.post("/buy-share", ShareController.buyShare);
router.post("/reserve-share", ShareController.reserveShare);
router.post("/open-share-by-category", ShareController.openShareByCategory);

//GET
router.get(
  "/get-shares-by-username/:key",
  ShareController.getBuySharesDetailByUsername
);
router.get(
  "/get-shares-by-property/:key/:status",
  ShareController.getSharesByProperty
);
router.get(
  "/get-reservations-by-username/:key",
  ShareController.getReservationsByUsername
);
router.get("/get-shares-by-category/:key/:category", ShareController.getSharesByCategory)

module.exports = router;
