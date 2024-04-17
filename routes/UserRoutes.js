const express = require("express")
const router = express.Router()
const UsersController = require("../controllers/UsersController")

router.post("/user-signup", UsersController.userSignUp)
router.put("/verify-email", UsersController.verifyEmailVerficationCode)
router.put("/gen-new-verification-code", UsersController.genNewVerificationCode)
router.post("/user-login", UsersController.userLogin)

module.exports = router

