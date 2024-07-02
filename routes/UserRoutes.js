const express = require("express")
const router = express.Router()
const UsersController = require("../controllers/UsersController")

router.post("/user-signup", UsersController.userSignUp)
router.put("/verify-email", UsersController.verifyEmailVerficationCode)
router.put("/gen-new-verification-code", UsersController.genNewVerificationCode)
router.post("/user-login", UsersController.userLogin)
router.put("/user-logout", UsersController.userLogout)
router.get("/get-default-settings/:key", UsersController.getUserDefaultSetting)
router.get("/get-user-detail/:key", UsersController.getUserDetails)
router.put("/update-account-settings/:key", UsersController.updateUserAccountSetting)
router.put("/change-login-password/:key", UsersController.changeUserLoginPassword)

router.get("/decrypt-password", UsersController.decryptPassword)

module.exports = router

