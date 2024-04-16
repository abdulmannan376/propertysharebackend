const express = require("express")
const router = express.Router()
const UsersController = require("../controllers/UsersController")

router.post("/user-signup", UsersController.userSignUp)

module.exports = router

