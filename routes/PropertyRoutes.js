const express = require("express");
const router = express.Router();
const PropertyController = require("../controllers/PropertyController");
const upload = require("../middleware/multerConfig");
const updatedUpload = require("../middleware/multerConfigUpdated");
const uploadRaiseRequestImages = require("../middleware/multerRaiseRequest");

//POST
router.post("/add-property-request", PropertyController.addPropertyRequest);
router.post("/add-new-property", PropertyController.addNewProperty);
router.post(
  "/upload-property-images",
  upload.array("imageFiles", 10),
  PropertyController.addPropertyImages
);
router.post(
  "/gen-raise-request",
  uploadRaiseRequestImages.array("imageFiles", 10),
  PropertyController.genRaiseRequest
);

//PUT
router.put("/update-property/:id", PropertyController.updateProperty);
router.put(
  "/delete-all-images-by-propertyID",
  PropertyController.deleteAllImages
);
router.put(
  "/update-inspection",
  updatedUpload.array("imageFiles", 10),
  PropertyController.handleInspectionSubmission
);
router.put(
  "/update-inspection-action",
  PropertyController.handleInspectionAction
);
router.put(
  "/update-inspection-action-by-PO",
  PropertyController.handleInspectionActionPropertyOwner
); //PO = Property Owner

router.put(
  "/update-raise-request-action",
  PropertyController.handleRaiseRequestAction
);

router.put(
  "/update-raise-request-action-by-PO",
  PropertyController.handleRaiseRequestActionPropertyOwner
); //PO = Property Owner

router.put(
  "/update-property-approval-action",
  PropertyController.handlePropertyAction
);
router.put("/update-property-status", PropertyController.handlePropertyStatus);


//PATCH
router.patch(
  "/update-property-status",
  PropertyController.handlePropertyFeatured
);

//GET
router.get(
  "/fetch-coordinates-of-property",
  PropertyController.fetchCoordinatesOfRequestes
);
router.get(
  "/get-properties-by-username/:key",
  PropertyController.getPropertyByUsername
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
router.get(
  "/get-inspections-by-user/:username/:action",
  PropertyController.fetchShareInspectionByUsername
);

router.get(
  "/get-inspection-detail/:key",
  PropertyController.getInspectionDetail
);
router.get(
  "/get-raise-request-by-username/:username/:type/:action",
  PropertyController.fetchRaisedRequestByUsername
);
router.get(
  "/get-raise-request-detail/:key",
  PropertyController.getRaiseRequestDetail
);
router.get(
  "/get-pending-approval-properties/:username",
  PropertyController.getPendingApprovalProperties
);
router.get("/get-property-shares", PropertyController.getPropertySharesByID);
router.get("/get-properties", PropertyController.getProperties);

// router.get("/test-share-ID", PropertyController.testGenerateShareID)

router.get("/test-run", PropertyController.testRun);

module.exports = router;
