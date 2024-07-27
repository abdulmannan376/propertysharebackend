const express = require("express");
const router = express.Router();
const UsersController = require("../controllers/UsersController");

//POST
router.post("/user-signup", UsersController.userSignUp);
router.post("/user-login", UsersController.userLogin);

//PUT
router.put("/verify-email", UsersController.verifyEmailVerficationCode);
router.put(
  "/gen-new-verification-code",
  UsersController.genNewVerificationCode
);
router.put("/user-logout", UsersController.userLogout);
router.put(
  "/update-account-settings/:key",
  UsersController.updateUserAccountSetting
);
router.put(
  "/change-login-password/:key",
  UsersController.changeUserLoginPassword
);
router.put("/update-user-favourites", UsersController.handleUserFavouriteList)
router.put("/update-user-wishlist", UsersController.handleUserWishList)

//GET
router.get("/get-user-detail/:key", UsersController.getUserDetails);
router.get("/get-default-settings/:key", UsersController.getUserDefaultSetting);
router.get("/get-user-data", UsersController.getUserData);
router.get("/get-user-favourites/:username", UsersController.fetchUserFavouriteList)
router.get("/get-user-wishlist/:username", UsersController.fetchUserWishList)

router.get("/decrypt-password", UsersController.decryptPassword);

module.exports = router;
