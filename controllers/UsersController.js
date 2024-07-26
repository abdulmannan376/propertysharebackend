const Users = require("../models/UserSchema");
const UserDefaultSettings = require("../models/UserDefaultSettingSchema");
const UserProfile = require("../models/userProfileSchema");
const jwt = require("jsonwebtoken");
const CryptoJS = require("crypto-js");
const { sendEmail } = require("../helpers/emailController");
const { sendUpdateNotification } = require("./notificationController");
const { verifyJWT } = require("../helpers/jwtController");
const Properties = require("../models/PropertySchema");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

function sendVerficationEmail(user, res) {
  const mailOptions = {
    from: "balaj.ali707@gmail.com",
    to: user.email, // The recipient's email address
    subject: `Email Verification Code: ${user.emailVerificationCode}`,
    text: `Hello, welcome to our service! Please add this code ${user.emailVerificationCode} as it will expire after 2 hours.\nWe are excited to have you on board. \nRegards,\nRapids AI Team`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      res
        .status(400)
        .json({ message: "Some error occured. Try again.", success: false });
    } else {
      res.status(201).json({
        message: `A verification code sent to email.`,
        success: true,
      });
    }
  });
}

const genNewVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("email: ", req.body);
    const verificationCode = Math.round(Math.random() * 1000000);
    const userFound = await Users.findOne({ email: email }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      return res
        .status(400)
        .json({ message: "Error occured. Try again", success: false });
    }

    if (!userFound.emailVerified) {
      userFound.emailVerificationCode = verificationCode;
      await userFound.save().then(() => {
        const subject = `Email Verification Code: ${userFound.emailVerificationCode}`;
        const emailBody = `Hello, welcome to our service! Please add this code ${userFound.emailVerificationCode} as it will expire after 2 hours.\nWe are excited to have you on board. \nRegards,\nRapids AI Team`;
        sendUpdateNotification(
          subject,
          emailBody,
          userFound.userDefaultSettingID.notifyUpdates,
          userFound.username
        );
        res.status(200).json({
          message: `A verification code sent to email.`,
          success: true,
        });
      });
    } else {
      return res
        .status(200)
        .json({ message: "Email already verified.", success: true });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const verifyEmailVerficationCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    console.log("body: ", req.body);
    const userFound = await Users.findOne({ email: email });
    if (!userFound) {
      return res
        .status(400)
        .json({ message: "Error occured. Try again", success: false });
    }

    if (!userFound.emailVerified) {
      if (code == userFound.emailVerificationCode) {
        userFound.emailVerified = true;
        userFound.emailVerificationCode = 0;
        await userFound.save();
        return res
          .status(200)
          .json({ message: "Email verified.", success: true });
      } else {
        return res.status(400).json({
          message: "You have entered a expired or wrong code.",
          success: false,
        });
      }
    } else {
      return res.status(200).json({
        message: "Email already verified.",
        success: true,
      });
    }
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "verifyEmailVerficationCode",
      fileLocation: "controllers/UsersController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const userLogout = async (req, res) => {
  try {
    const { email } = req.body;

    const userFound = await Users.findOne({ email: email });
    if (!userFound) {
      return res.status(400).json({
        message: "No user data.",
        success: false,
      });
    }

    userFound.loggedIn = false;

    await userFound.save();

    res.status(200).json({ mesaage: "Logged out", success: true });
  } catch (error) {
    console.log("Error: ", {
      function: "userLogout",
      fileLocation: "controllers/UsersController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const userLogin = async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    console.log("body: ", req.body);
    if (!userFound) {
      return res
        .status(400)
        .json({ message: "Wrong username.", success: false });
    }

    const bytes = CryptoJS.AES.decrypt(
      userFound.password,
      process.env.PASSWORD_SECRET
    );
    const userPassword = bytes.toString(CryptoJS.enc.Utf8);
    console.log("userPassword: ", userPassword);
    if (userPassword !== password) {
      return res
        .status(400)
        .json({ message: "Wrong password", success: false });
    }
    let tokenExpiry = "1d";
    if (rememberMe) {
      tokenExpiry = "7d";
    }
    const token = jwt.sign(
      { username: username, name: userFound.name, role: userFound.role },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry }
    );

    userFound.loggedIn = true;

    await userFound.save().then(() => {
      const subject = `Login activity.`;
      const emailBody = `Dear ${userFound.name},\nYou have successfully logged in your account`;
      sendUpdateNotification(
        subject,
        emailBody,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );
      res.status(200).json({
        message: "Logged in",
        token: token,
        body: {
          name: userFound.name,
          email: userFound.email,
          role: userFound.role,
          username: userFound.username,
        },
        success: true,
      });
    });

    // res.status(200).json({ message: "Logged in", success: true, token: token });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error, success: false });
  }
};

const userSignUp = async (req, res) => {
  try {
    const body = req.body;
    console.log("body: ", body);
    const userFoundByUsername = await Users.findOne({
      username: body.username,
    });
    if (userFoundByUsername) {
      return res
        .status(400)
        .json({ message: "Username already taken", success: false });
    }

    const userFound = await Users.findOne({ email: body.email });
    if (userFound) {
      return res
        .status(400)
        .json({ message: "Email already resgistered.", success: false });
    }

    const { password } = body;
    const verificationCode = Math.round(Math.random() * 1000000);
    body.password = CryptoJS.AES.encrypt(password, process.env.PASSWORD_SECRET);
    const newUserDefaultSetting = new UserDefaultSettings();
    const newUserProfile = new UserProfile();
    const newUser = new Users({
      name: body.name,
      username: body.username,
      email: body.email,
      password: body.password,
      role: body.role,
      loggedIn: false,
      emailVerified: false,
      emailVerificationCode: verificationCode,
      userDefaultSettingID: newUserDefaultSetting._id,
      userProfile: newUserProfile._id,
    });

    await newUserDefaultSetting.save();
    await newUserProfile.save();
    newUser.save().then(() => {
      const subject = `Email Verification Code: ${verificationCode}`;
      const emailBody = `Hello, welcome to our service! Please add this code ${verificationCode} as it will expire after 2 hours.\nWe are excited to have you on board. \nRegards,\nRapids AI Team`;
      sendUpdateNotification(
        subject,
        emailBody,
        newUserDefaultSetting.notifyUpdates,
        body.username
      );
      res.status(201).json({
        message: `A verification code sent to email.`,
        success: true,
      });
    });

    // res.status(201).json({ message: "User signed up.", success: true });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getUserDefaultSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const userFound = await Users.findOne({ username: key })
      .populate("userDefaultSettingID")
      .exec();
    if (!userFound) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    res.status(200).json({
      message: "Fetched",
      body: userFound.userDefaultSettingID,
      success: true,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getUserDefaultSetting",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const { key } = req.params;

    const userFound = await Users.findOne({ username: key })
      .select("-password")
      .populate("userProfile")
      .exec();

    if (!userFound) {
      return res.status(400).json({ message: "Try Again", success: false });
    }

    res
      .status(200)
      .json({ message: "Success", success: true, body: userFound });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getUserDetails",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const decryptPassword = async (req, res) => {
  const { key } = req.body;

  const bytes = CryptoJS.AES.decrypt(key, process.env.PASSWORD_SECRET);
  const userPassword = bytes.toString(CryptoJS.enc.Utf8);

  res.status(200).json({ password: userPassword });
};

const updateUserAccountSetting = async (req, res) => {
  try {
    const body = req.body;
    const { key } = req.params;
    const userFound = await Users.findOne({ username: key });

    if (!userFound) {
      return res
        .status(400)
        .json({ message: "Error. Try Again", success: false });
    }

    const userDefaultSetting = await UserDefaultSettings.findOne({
      _id: userFound.userDefaultSettingID,
    });
    console.log("userFound: ", userFound);
    userDefaultSetting.currencySymbol = body.currencySymbol;
    userDefaultSetting.currencyShortName = body.currencyShortName;
    userDefaultSetting.languageChoosen = body.languageChoosen;
    userDefaultSetting.areaUnit = body.areaUnit;
    userDefaultSetting.notifyUpdates = body.notifyUpdates;
    userDefaultSetting.notifyMessages = body.notifyMessages;

    await userDefaultSetting.save().then(() => {
      const subject = `Account Settings Updated`;
      const emailBody = `Dear ${userFound.name}, \nYour account settings changes have been updated. If you have done, this is the confirmation emal if not then please change your password for any security issues. \nThankyou.`;
      sendUpdateNotification(subject, emailBody, body.notifyUpdates, key);
      res.status(201).json({
        message: `Changes updated.`,
        success: true,
      });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "updateUserAccountSetting",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const changeUserLoginPassword = async (req, res) => {
  try {
    const body = req.body;
    const { key } = req.params;

    const userFound = await Users.findOne({ username: key });

    if (!userFound) {
      return res
        .status(400)
        .json({ message: "Error. Try Again", success: false });
    }

    const userDefaultSetting = await UserDefaultSettings.findOne({
      _id: userFound.userDefaultSettingID,
    });

    const bytes = CryptoJS.AES.decrypt(
      userFound.password,
      process.env.PASSWORD_SECRET
    );
    const userCurrentPassword = bytes.toString(CryptoJS.enc.Utf8);

    if (userCurrentPassword !== body.currentPassword) {
      return res
        .status(400)
        .json({ message: "Current password not matched.", success: false });
    }

    userDefaultSetting.lastPassword.push(userCurrentPassword);

    if (userDefaultSetting.lastPassword.includes(body.newPassword)) {
      return res
        .status(400)
        .json({ message: "Password already used.", success: false });
    }
    const newPassword = CryptoJS.AES.encrypt(
      body.newPassword,
      process.env.PASSWORD_SECRET
    );

    userFound.password = newPassword;

    await userDefaultSetting.save();
    userFound.save().then(() => {
      const subject = `Login Password Changed.`;
      const emailBody = `Dear ${userFound.name}, \nYour login password have been changed. If you have done, this is the confirmation email if not then please contact our support for further assistance. \nThankyou.`;
      sendUpdateNotification(
        subject,
        emailBody,
        userDefaultSetting.notifyUpdates,
        key
      );
      res.status(201).json({
        message: `Changes updated.`,
        success: true,
      });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "changeUserLoginPassword",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getUserData = async (req, res) => {
  try {
    // Authorization header should be checked if it exists
    if (!req.headers.authorization) {
      return res.status(401).json({
        message: "No authorization token provided.",
        success: false,
      });
    }

    const token = req.headers.authorization.split(" ")[1];

    const isTokenValid = await verifyJWT(token);
    if (!isTokenValid) {
      return res.status(404).json({
        message: "Session expired.",
        success: false,
        action: "login",
      });
    }

    const data = jwt.decode(token);

    const userFound = await Users.findOne(
      { username: data.username },
      "-notificationByIDList -password -emailVerificationCode"
    )
      .populate("userDefaultSettingID")
      .populate("userProfile");

    if (!userFound) {
      return res.status(404).json({
        message: "User error. Login again",
        success: false,
        action: "login",
      });
    }

    res
      .status(200)
      .json({ message: "User data found.", success: true, body: userFound });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getUserData",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const handleUserFavouriteList = async (req, res) => {
  try {
    const { propertyID, username, action } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found.");
    }

    const propertyFound = await Properties.findOne({ propertyID: propertyID });
    if (!propertyFound) {
      throw new Error("property not found.");
    }

    const userProfileFound = await UserProfile.findOne({
      _id: userFound.userProfile,
    });

    if (action === "add") {
      userProfileFound.favouriteList.push(propertyID);
      userProfileFound.save().then(() => {
        const subject = `Property added to favourites`;
        const body = `Dear ${userFound.name}, \nProperty: ${propertyFound.title} added to your favourites. \nRegards \nBeach Bunny House.`;

        sendUpdateNotification(
          subject,
          body,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );
      });
      return res.status(201).json({
        message: "Added to favourites",
        success: true,
        body: userProfileFound.favouriteList,
      });
    } else if (action === "remove") {
      const prevDetails = [...userProfileFound.favouriteList];
      userProfileFound.favouriteList = prevDetails.filter((data) => {
        return data !== propertyID;
      });
      userProfileFound.save().then(() => {
        const subject = `Property removed to favourites`;
        const body = `Dear ${userFound.name}, \nProperty: ${propertyFound.title} removed to your favourites. \nRegards \nBeach Bunny House.`;

        sendUpdateNotification(
          subject,
          body,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );
      });

      return res.status(200).json({
        message: "Removed from favourites",
        success: true,
        body: userProfileFound.favouriteList,
      });
    } else {
      return res
        .status(403)
        .json({ message: "Forbidden or no action provided", success: false });
    }
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleUserFavouriteList",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const handleUserWishList = async (req, res) => {
  try {
    const { propertyID, username, action } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found.");
    }

    const propertyFound = await Properties.findOne({ propertyID: propertyID });
    if (!propertyFound) {
      throw new Error("property not found.");
    }

    const userProfileFound = await UserProfile.findOne({
      _id: userFound.userProfile,
    });

    if (action === "add") {
      userProfileFound.wishList.push(propertyID);
      userProfileFound.save().then(() => {
        const subject = `Property added to wishlist`;
        const body = `Dear ${userFound.name}, \nProperty: ${propertyFound.title} added to your wishlist. \nRegards \nBeach Bunny House.`;

        sendUpdateNotification(
          subject,
          body,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );
      });
      return res.status(201).json({
        message: "Added to favourites",
        success: true,
        body: userProfileFound.wishList,
      });
    } else if (action === "remove") {
      const prevDetails = [...userProfileFound.wishList];
      userProfileFound.wishList = prevDetails.filter((data) => {
        return data !== propertyID;
      });
      userProfileFound.save().then(() => {
        const subject = `Property removed to wishlist`;
        const body = `Dear ${userFound.name}, \nProperty: ${propertyFound.title} removed to your wishlist. \nRegards \nBeach Bunny House.`;

        sendUpdateNotification(
          subject,
          body,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );
      });

      return res.status(200).json({
        message: "Removed from favourites",
        success: true,
        body: userProfileFound.wishList,
      });
    } else {
      return res
        .status(403)
        .json({ message: "Forbidden or no action provided", success: false });
    }
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleUserWishList",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

// const fetchUserFavouriteList = async (req, res) => {
//   try {
//     const { username } = req.params;

//     const userFound = await Users.findOne({ username: username }).populate(
//       "userProfile",
//       "favouriteList"
//     );
//     if (!userFound) {
//       throw new Error("user not found");
//     }

//   } catch (error) {
//     console.log(`Error: ${error}`, "\nlocation: ", {
//       function: "fetchUserFavouriteList",
//       fileLocation: "controllers/UserController.js",
//       timestamp: currentDateString,
//     });
//     res
//       .status(500)
//       .json({ message: "Internal Server Error", error: error, success: false });
//   }
// };

module.exports = {
  userSignUp,
  verifyEmailVerficationCode,
  genNewVerificationCode,
  userLogin,
  userLogout,
  getUserDefaultSetting,
  getUserDetails,
  updateUserAccountSetting,
  changeUserLoginPassword,
  decryptPassword, // to be deleted
  getUserData,
  handleUserFavouriteList,
  handleUserWishList,
};
