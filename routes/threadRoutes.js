const express = require("express")
const router = express.Router()
const ThreadsController = require("../controllers/ThreadController")

router.post("/create-root-thread", ThreadsController.genNewRootThread)
router.get("/get-all-by-property/:key", ThreadsController.getAllThreadsByProperty)


module.exports = router

