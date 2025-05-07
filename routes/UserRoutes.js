const express = require("express");
const router = express.Router();
const UsersController = require("../controllers/UsersController");
const uploadUserProFilePic = require("../middleware/multerUserProfilePic");
const upload = require("../middleware/multerWithdrawalReciept");
const uploadIDCard = require("../middleware/multerUserIdentityCards");

//POST
router.post("/user-signup", UsersController.userSignUp);
router.post("/user-login", UsersController.userLogin);
router.post("/user-login-copy", UsersController.userLoginCopy);
router.post("/user-resetPasswordGenCode", UsersController.resetPasswordGenCode);
router.post("/user-newResetPasswordSubmission", UsersController.newResetPasswordSubmission);
router.post("/gen-withdrawal", UsersController.genWithdrawal);

//PUT
router.put("/verify-resetPasswordCode", UsersController.verifyResetPasswordCode);
router.put(
  "/gen-new-reset-password-code",
  UsersController.genNewResetPasswordCode
);
router.put("/verify-email", UsersController.verifyEmailVerficationCode);
router.put("/verify-email-copy", UsersController.verifyEmailVerficationCodeCopy);
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
router.put("/update-user-favourites", UsersController.handleUserFavouriteList);
router.put("/update-user-wishlist", UsersController.handleUserWishList);
router.put(
  "/upload-profile-pic",
  uploadUserProFilePic.single("imageFile"),
  UsersController.uploadProfilePic
);
router.put(
  "/upload-id-card-pics",
  uploadIDCard.single("imageFile"),
  UsersController.uploadIDCardPic
);
router.put("/update-user-profile", UsersController.updateUserProfileDetails);
router.put(
  "/update-withdrawal",
  upload.single("imageFile"),
  UsersController.updateWithdrawal
);

//GET
router.get("/get-user-detail/:key", UsersController.getUserDetails);
router.get("/get-default-settings/:key", UsersController.getUserDefaultSetting);
router.get("/get-user-data", UsersController.getUserData);
router.get(
  "/get-user-favourites/:username",
  UsersController.fetchUserFavouriteList
);
router.get("/get-user-wishlist/:username", UsersController.fetchUserWishList);
router.get(
  "/get-user-profile-details/:username",
  UsersController.getUserProfileDetails
);
router.get("/search-users", UsersController.searchUsers);
router.get("/get-user-withdrawals", UsersController.getUserWithdrawals);

router.get("/decrypt-password", UsersController.decryptPassword);

module.exports = router;
