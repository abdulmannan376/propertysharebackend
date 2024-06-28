const express = require("express");
const router = express.Router();
const ThreadsController = require("../controllers/ThreadController");

//POST routes

router.post("/create-root-thread", ThreadsController.genNewRootThread);
router.post("/add-child-thread", ThreadsController.genChildToRoot);

//GET routes

router.get(
  "/get-all-by-property/:key",
  ThreadsController.getAllThreadsByProperty
);
router.get("/get-childern-by-parent/:key", ThreadsController.getChildrenByParentThread)

module.exports = router;
