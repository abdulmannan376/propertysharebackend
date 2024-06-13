const express = require("express");
const router = express.Router();
const PropertyController = require("../controllers/PropertyController");
const upload = require("../middleware/multerConfig");

router.post("/add-property-request", PropertyController.addPropertyRequest);
router.get(
  "/fetch-coordinates-of-property",
  PropertyController.fetchCoordinatesOfRequestes
);
router.post("/add-new-property", PropertyController.addNewProperty);
router.get(
  "/get-properties-by-username/:key",
  PropertyController.getPropertyByUsername
);
router.put("/update-property/:id", PropertyController.updateProperty);
router.post(
  "/upload-property-images",
  upload.array("imageFiles", 10),
  PropertyController.addPropertyImages
);

router.get(
  "/get-featured-property/:key",
  PropertyController.getFeaturedProperty
);
router.get(
  "/get-most-viewed-property/:key",
  PropertyController.getMostViewedProperties
);
router.get(
  "/get-recently-added-property/:key",
  PropertyController.getRecentlyAddedProperties
);

router.get(
  "/get-property-by-type/:key",
  PropertyController.getPropertiesByType
);

router.get(
  "/get-property-by-available-shares/:key",
  PropertyController.getPropertiesByAvailableShares
);

router.get("/get-property-by-id/:key", PropertyController.getPropertyByID);

// router.get("/test-share-ID", PropertyController.testGenerateShareID)

module.exports = router;
