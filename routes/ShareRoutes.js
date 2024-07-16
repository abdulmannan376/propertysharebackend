const express = require("express");
const router = express.Router();

const ShareController = require("../controllers/ShareController");

//POST
router.post("/buy-share", ShareController.buyShare);
router.post("/reserve-share", ShareController.reserveShare);
router.post("/open-share-by-category", ShareController.openShareByCategory);
router.post("/gen-new-offer", ShareController.genNewShareOffer);

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
router.get(
  "/get-shares-by-category/:key/:category",
  ShareController.getSharesByCategory
);
router.get(
  "/get-sent-offers-by-category/:username/:category",
  ShareController.fetchShareOffersOfOwnerByCategory
);
router.get(
  "/get-received-offers-by-category/:username/:category",
  ShareController.fetchShareOffersOfUserByCategory
);

module.exports = router;
