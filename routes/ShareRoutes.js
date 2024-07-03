const express = require("express");
const router = express.Router();

const ShareController = require("../controllers/ShareController");

//POST
router.post("/buy-share", ShareController.buyShare);
router.post("/reserve-share", ShareController.reserveShare);
router.post("/open-share-for-rent", ShareController.openShareForRent);

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
router.get("/get-rent-shares-by-property/:key/:category", ShareController.getRentSharesByProperty)

module.exports = router;
