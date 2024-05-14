const express = require("express");
const router = express.Router();
const PropertyController = require("../controllers/PropertyController");
const upload = require("../middleware/multerConfig");

router.post("/add-property-request", PropertyController.addPropertyRequest);
router.get(
  "/fetch-coordinates-of-property/:id/:key",
  PropertyController.fetchCoordinatesOfProperties
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

module.exports = router;
