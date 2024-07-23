const express = require("express");
const router = express.Router();

const ShareController = require("../controllers/ShareController");

//POST
router.post("/buy-share", ShareController.buyShare);
router.post("/reserve-share", ShareController.reserveShare);
router.post("/open-share-by-category", ShareController.handleShareByCategory);
router.post("/gen-new-offer", ShareController.genNewShareOffer);

//PUT
router.put(
  "/update-share-rent-offer",
  ShareController.handleShareRentOfferAction
);
router.put(
  "/update-share-sell-offer",
  ShareController.handleShareSellOfferAction
);

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
router.get(
  "/get-share-rentals-by-user/:username",
  ShareController.fetchUserShareRentals
);
router.get("/get-all-shares-by-username/:username/:propertyID", ShareController.getSharesByUsername);

module.exports = router;
