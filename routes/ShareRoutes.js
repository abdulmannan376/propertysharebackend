const express = require("express");
const router = express.Router();

const ShareController = require("../controllers/ShareController");

router.post("/buy-share", ShareController.buyShare);
router.get("/get-shares-by-username/:key", ShareController.getBuySharesDetailByUsername)

module.exports = router;
