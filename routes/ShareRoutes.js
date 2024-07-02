const express = require("express");
const router = express.Router();

const ShareController = require("../controllers/ShareController");

router.post("/buy-share", ShareController.buyShare);
router.get(
  "/get-shares-by-username/:key",
  ShareController.getBuySharesDetailByUsername
);
router.get("/get-shares-by-property/:key/:status", ShareController.getSharesByProperty);
router.post("/reserve-share", ShareController.reserveShare);
router.get("/get-reservations-by-username/:key", ShareController.getReservationsByUsername);

module.exports = router;
