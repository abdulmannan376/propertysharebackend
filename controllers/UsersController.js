const Users = require("../models/UserSchema");
const UserDefaultSettings = require("../models/UserDefaultSettingSchema");
const UserProfile = require("../models/userProfileSchema");
const jwt = require("jsonwebtoken");
const CryptoJS = require("crypto-js");
const { sendEmail } = require("../helpers/emailController");
const { sendUpdateNotification } = require("./notificationController");
const { verifyJWT } = require("../helpers/jwtController");
const Properties = require("../models/PropertySchema");
const { removeRecieverID } = require("../socket/socket");
const { default: mongoose } = require("mongoose");
const Withdrawal = require("../models/WithdrawalSchema");
const { processAdminApprovedWithdrawal } = require("./PaymentController");
const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

function sendVerficationEmail(user, res) {
  const mailOptions = {
    from: "balaj.ali707@gmail.com",
    to: user.email, // The recipient's email address
    subject: `Email Verification Code: ${user.emailVerificationCode}`,
    text: `Hello, welcome to our service! Please add this code ${user.emailVerificationCode} as it will expire after 2 hours.\nWe are excited to have you on board. \nRegards,\n Bunny Beach House.`,
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
        const emailBody = `Hello, welcome to our service! Please add this code ${userFound.emailVerificationCode} as it will expire after 2 hours.\nWe are excited to have you on board. \nRegards,\n Bunny Beach House.`;
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
      if (code == userFound.emailVerificationCode) {
        userFound.emailVerified = true;
        userFound.emailVerificationCode = 0;
        let tokenExpiry = "1d";
        const token = jwt.sign(
          {
            username: userFound.username,
            name: userFound.name,
            role: userFound.role,
          },
          process.env.JWT_SECRET,
          { expiresIn: tokenExpiry }
        );

        await userFound.save();
        const subject = `Email verified successfully!`;
        const emailBody = `Dear ${userFound.name},\nYour email has been successfully verified.`;
        sendUpdateNotification(
          subject,
          emailBody,
          userFound.userDefaultSettingID.notifyUpdates,
          userFound.username
        );

        // Respond with token and user details
        return res.status(200).json({
          message: "Email verified.",
          token: token,
          body: {
            name: userFound.name,
            email: userFound.email,
            role: userFound.role,
            username: userFound.username,
            isProfileCompleted: userFound.isProfileCompleted,
          },
          success: true,
        });
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

    // removeRecieverID(userFound.username)

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
    const { username, password, rememberMe, ipAddress, country, city } =
      req.body;
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
    if (userPassword !== password) {
      return res
        .status(400)
        .json({ message: "Wrong password", success: false });
    }
    if (!userFound.emailVerified) {
      const verificationCode = Math.round(Math.random() * 1000000);
      userFound.emailVerificationCode = verificationCode;

      try {
        await userFound.save(); // Save the user data

        const subject = `Reset Password Verification Code: ${verificationCode}`;
        const emailBody = `Hello, welcome to our service! Please add this code ${verificationCode} as it will expire after 2 hours.`;

        // Send email notification
        sendUpdateNotification(
          subject,
          emailBody,
          userFound.userDefaultSettingID.notifyUpdates,
          userFound.username
        );

        // Return response and stop further execution
        return res.status(400).json({
          message: `Email Not Verified for ${userFound.email}`,
          success: false,
          email: userFound.email,
        });
      } catch (error) {
        // Handle any errors during the save or email process
        console.error("Error sending email:", error);
        return res.status(500).json({
          message: "An error occurred while processing your request.",
          success: false,
        });
      }
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
      const emailBody = `
      Did you Login from a new Device or Location?
      
      We noticed your Beachbunnyhouse account "${
        userFound.username || userFound.email
      }" 
      was accessed from a new IP address.
      
      When: ${new Date().toISOString()} (UTC)
      IP Address: ${ipAddress} Country: ${country} City: ${city}
      
      [Visit your Account](https://www.beachbunnyhouse.com/user/${
        userFound.username
      })
      
      Don't recognize this activity? Please [reset your password](https://www.beachbunnyhouse.com/reset-password) and [contact customer support](https://www.beachbunnyhouse.com/contactus) immediately.
      `;

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
          isProfileCompleted: userFound.isProfileCompleted,
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
    newUserDefaultSetting.userDocID = newUser._id;
    newUserProfile.userDocID = newUser._id;

    await newUserDefaultSetting.save();
    await newUserProfile.save();
    newUser.save().then(() => {
      const subject = `Email Verification Code: ${verificationCode}`;
      const emailBody = `Hello, welcome to our service! Please add this code ${verificationCode} as it will expire after 2 hours.\nWe are excited to have you on board. \nRegards,\n Bunny Beach House.`;
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

///////////reset pass//////////
const resetPasswordGenCode = async (req, res) => {
  try {
    const body = req.body;
    console.log("body: ", body);

    const userFound = await Users.findOne({ email: body.email }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );

    if (!userFound) {
      return res
        .status(400)
        .json({ message: "User dont exsist", success: false });
    }
    if (userFound.role === "admin" || userFound.role === "super admin") {
      return res
        .status(400)
        .json({ message: "User dont exsist", success: false });
    }

    const verificationCode = Math.round(Math.random() * 1000000);

    userFound.resetPasswordVerificationCode = verificationCode;
    userFound.resetPasswordVerified = false;
    //  userFound.save();

    await userFound.save().then(() => {
      const subject = `Reset Password Verification Code: ${verificationCode}`;
      const emailBody = `Hello, welcome to our service! Please add this code ${verificationCode} as it will expire after 2 hours.`;
      sendUpdateNotification(
        subject,
        emailBody,
        userFound.userDefaultSettingID.notifyUpdates,
        userFound.username
      );
      res.status(201).json({
        message: `A verification code sent to email.`,
        success: true,
      });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "resetPasswordGenCode",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};
const verifyResetPasswordCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    console.log("body: ", req.body);
    const userFound = await Users.findOne({ email: email }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      return res
        .status(400)
        .json({ message: "User Not Registered", success: false });
    }

    if (!userFound.resetPasswordVerified) {
      if (code == userFound.resetPasswordVerificationCode) {
        userFound.resetPasswordVerified = true;
        userFound.emailVerified = true;
        userFound.resetPasswordVerificationCode = 0;
        // let tokenExpiry = "1d";
        // const token = jwt.sign(
        //   {
        //     username: userFound.username,
        //     name: userFound.name,
        //     role: userFound.role,
        //   },
        //   process.env.JWT_SECRET,
        //   { expiresIn: tokenExpiry }
        // );

        await userFound.save();
        // const subject = `Email verified successfully!`;
        // const emailBody = `Dear ${userFound.name},\nYour email has been successfully verified.`;
        // sendUpdateNotification(
        //   subject,
        //   emailBody,
        //   userFound.userDefaultSettingID.notifyUpdates,
        //   userFound.username
        // );

        // Respond with token and user details
        return res.status(200).json({
          message: "Reset Password Code verified.",
          body: {
            resetPasswordVerified: userFound.resetPasswordVerified,
          },
          success: true,
        });
      } else {
        return res.status(400).json({
          message: "You have entered a expired or wrong code.",
          success: false,
        });
      }
    } else {
      return res.status(400).json({
        message: "Request for a new Verification code ",
        success: false,
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
const genNewResetPasswordCode = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("email: ", req.body.email);
    // const verificationCode = Math.round(Math.random() * 1000000);
    const userFound = await Users.findOne({ email: email }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      return res
        .status(400)
        .json({ message: "Error occured. Try again", success: false });
    }
    const verificationCode = Math.round(Math.random() * 1000000);

    userFound.resetPasswordVerificationCode = verificationCode;
    userFound.resetPasswordVerified = false;
    await userFound.save().then(() => {
      const subject = `Reset Password Verification Code: ${verificationCode}`;
      const emailBody = `Hello, welcome to our service! Please add this code ${verificationCode} as it will expire after 2 hours.`;
      sendUpdateNotification(
        subject,
        emailBody,
        userFound.userDefaultSettingID.notifyUpdates,
        userFound.username
      );
      res.status(201).json({
        message: `A verification code sent to email.`,
        success: true,
      });
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};
const newResetPasswordSubmission = async (req, res) => {
  try {
    const { email, password: newPassword } = req.body;

    // Find the user and populate related settings
    const userFound = await Users.findOne({ email }).populate(
      "userDefaultSettingID",
      "notifyUpdates lastPassword"
    );

    if (!userFound) {
      return res
        .status(400)
        .json({ message: "User not registered", success: false });
    }
    if (userFound.role === "admin" || userFound.role === "super admin") {
      return res
        .status(400)
        .json({ message: "User dont exsist", success: false });
    }
    if (!userFound.resetPasswordVerified) {
      return res.status(400).json({
        message: "Request for a new reset password code",
        success: false,
      });
    }

    const userDefaultSetting = userFound.userDefaultSettingID;

    // Decrypt existing passwords from lastPassword array
    const decryptedPasswords = userDefaultSetting.lastPassword.map(
      (encryptedPass) => {
        const bytes = CryptoJS.AES.decrypt(
          encryptedPass,
          process.env.PASSWORD_SECRET
        );
        return bytes.toString(CryptoJS.enc.Utf8);
      }
    );

    // Check if the new password has been used before
    if (decryptedPasswords.includes(newPassword)) {
      return res
        .status(400)
        .json({ message: "Password already used", success: false });
    }

    // Encrypt the new password
    const encryptedNewPassword = CryptoJS.AES.encrypt(
      newPassword,
      process.env.PASSWORD_SECRET
    ).toString();

    // Update user's password and reset verification status
    userFound.password = encryptedNewPassword;
    userFound.resetPasswordVerified = false;

    // Push the new password to the history
    userDefaultSetting.lastPassword.push(encryptedNewPassword);

    // Save changes
    await userDefaultSetting.save();
    await userFound.save();

    // Send confirmation email or notification
    const subject = `Login Password Changed.`;
    const emailBody = `
    Your Password Has Been Changed
    
    Hello ${userFound.name},
    
    We’re writing to confirm that the password for your Beachbunnyhouse account "${
      userFound.username || userFound.email
    }" has been successfully updated.
    
    If you made this change, no further action is required. This message is simply a confirmation of the update.
    
    **Don't recognize this activity?**
    - [Reset Your Password](https://www.beachbunnyhouse.com/reset-password)
    - [Contact Customer Support](https://www.beachbunnyhouse.com/contactus)
    
    Your account security is our top priority. If you notice any unusual activity, please act immediately using the links above.
    
    Thank you for being a valued member of the Beachbunnyhouse community,  
    The Beachbunnyhouse Team
    `;

    sendUpdateNotification(
      subject,
      emailBody,
      userDefaultSetting.notifyUpdates,
      userFound.username
    );

    res.status(200).json({
      message: "Password updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error in newResetPasswordSubmission:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      success: false,
    });
  }
};
// /////////////reset pass///////////

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

    console.log("userFound: ", userFound);

    await UserDefaultSettings.updateOne(
      {
        _id: userFound.userDefaultSettingID,
      },
      {
        $set: {
          currencySymbol: body.currencySymbol,
          currencyShortName: body.currencyShortName,
          languageChoosen: body.languageChoosen,
          areaUnit: body.areaUnit,
          notifyUpdates: body.notifyUpdates,
          notifyMessages: body.notifyMessages,
        },
      }
    );

    const subject = `Account Settings Updated`;
    const emailBody = `Dear ${userFound.name}, \nYour account settings changes have been updated. If you have done, this is the confirmation emal if not then please change your password for any security issues. \nThankyou. \nRegards, \nBeach Bunny House.`;
    sendUpdateNotification(subject, emailBody, body.notifyUpdates, key);
    res.status(201).json({
      message: `Changes updated.`,
      success: true,
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
      const emailBody = `
      Your Password Has Been Changed
      
      Hello ${userFound.name},
      
      We’re writing to confirm that the password for your Beachbunnyhouse account "${
        userFound.username || userFound.email
      }" has been successfully updated.
      
      If you made this change, no further action is required. This message is simply a confirmation of the update.
      
      **Don't recognize this activity?**
      - [Reset Your Password](https://www.beachbunnyhouse.com/reset-password)
      - [Contact Customer Support](https://www.beachbunnyhouse.com/contactus)
      
      Your account security is our top priority. If you notice any unusual activity, please act immediately using the links above.
      
      Thank you for being a valued member of the Beachbunnyhouse community,  
      The Beachbunnyhouse Team
      `;
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

    let data = {};
    const { username } = req.query;
    console.log(req.query);
    if (username) {
      data.username = username;
    } else {
      data = jwt.decode(token);
    }

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

const getUserWithdrawals = async (req, res) => {
  try {
    const { username, filter, isAdmin } = req.query;

    const userFound = await Users.findOne({ username: username });
    if (!userFound) {
      throw new Error("user not found");
    }

    let statusList = [];
    if (filter === "all") {
      statusList = ["Dispatched", "Cancelled", "Expired", "OnHold"];
    } else if (filter === "Pending") {
      statusList = ["Pending", "OnHold"];
    } else {
      statusList = [filter];
    }

    if (isAdmin === "true") {
      const withdrawalList = await Withdrawal.find({
        status: { $in: statusList },
      }).populate("userDocID", "username");

      res
        .status(200)
        .json({ message: "Fetched", success: true, body: withdrawalList });
    } else {
      const withdrawalList = await Withdrawal.find({
        userDocID: userFound._id,
        status: { $in: statusList },
      }).populate("userDocID", "username");

      res
        .status(200)
        .json({ message: "Fetched", success: true, body: withdrawalList });
    }
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getUserWithdrawals",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const genWithdrawal = async (req, res) => {
  try {
    const { username, amount, email, agree } = req.query;

    const userFound = await Users.findOne({ username: username });
    if (!userFound) {
      throw new Error("user not found");
    }

    if (userFound.availBalnc < amount) {
      return res
        .status(400)
        .json({ message: "Not enough balance available", success: false });
    }

    const newWithdrawalRequest = new Withdrawal({
      amount: amount,
      userDocID: userFound,
      payPalEmail: email,
      agree: agree,
    });

    await newWithdrawalRequest.save();

    await Users.updateOne(
      {
        _id: userFound._id,
      },
      {
        $set: {
          availBalnc: userFound.availBalnc - parseInt(amount),
        },
      }
    );

    res
      .status(200)
      .json({ message: "Withdrawal Request Generated", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "genWithdrawal",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const updateWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { withdrawalID, action } = req.body;

    const withdrawalFound = await Withdrawal.findOne({
      withdrawalID: withdrawalID,
    })
      .populate({
        path: "userDocID",
        model: "users",
        select: "userDefaultSettingID username name availBalnc",
        populate: {
          path: "userDefaultSettingID",
          model: "user_default_settings",
          select: "notifyUpdates",
        },
      })
      .session(session);

    if (!withdrawalFound) {
      throw new Error("Withdrawal not found.");
    }

    if (action === "dispatched") {
      const requestBody = {
        amount: withdrawalFound.amount,
        paypalEmail: withdrawalFound.payPalEmail,
        requestId: withdrawalFound._id,
        withdrawalID: withdrawalID,
      };

      const response = await processAdminApprovedWithdrawal(
        session,
        requestBody
      );
      if (response.success) {
        await session.commitTransaction();
        return res.status(200).json({
          message: "Withdrawal dispatched and processed successfully.",
          success: true,
        });
      } else {
        throw new Error(
          `Failed to process PayPal withdrawal: ${response.message}`
        );
      }
    } else if (action === "cancel") {
      await Withdrawal.updateOne(
        { _id: withdrawalFound._id },
        { $set: { status: "Cancelled" } }
      ).session(session);

      await Users.updateOne(
        { _id: withdrawalFound.userDocID._id },
        {
          $set: {
            availBalnc:
              withdrawalFound.userDocID.availBalnc + withdrawalFound.amount,
          },
        }
      ).session(session);

      await session.commitTransaction();
    } else if (action === "hold") {
      await Withdrawal.updateOne(
        { _id: withdrawalFound._id },
        { $set: { status: "OnHold" } }
      ).session(session);

      // await Users.updateOne(
      //   { _id: withdrawalFound.userDocID._id },
      //   {
      //     $set: {
      //       availBalnc:
      //         withdrawalFound.userDocID.availBalnc + withdrawalFound.amount,
      //     },
      //   }
      // ).session(session);

      await session.commitTransaction();
    } else if (action === "release") {
      await Withdrawal.updateOne(
        { _id: withdrawalFound._id },
        { $set: { status: "Pending" } }
      ).session(session);

      // await Users.updateOne(
      //   { _id: withdrawalFound.userDocID._id },
      //   {
      //     $set: {
      //       availBalnc:
      //         withdrawalFound.userDocID.availBalnc + withdrawalFound.amount,
      //     },
      //   }
      // ).session(session);

      await session.commitTransaction();
    } else {
      throw new Error("Forbidden or No action provided.");
    }

    res.status(200).json({ message: "Withdrawal updated", success: true });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in updateWithdrawal:", error);
    res.status(500).json({
      message: error.message || "Internal Server Error",
      success: false,
    });
  } finally {
    session.endSession();
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

const fetchUserFavouriteList = async (req, res) => {
  try {
    const { username } = req.params;

    const userFound = await Users.findOne({ username: username }).populate(
      "userProfile",
      "favouriteList"
    );
    if (!userFound) {
      throw new Error("user not found");
    }

    const propertyListPromises = userFound.userProfile.favouriteList.map(
      (data) => {
        return Properties.findOne({ propertyID: data }, "-shareDocIDList");
      }
    );

    const propertyList = await Promise.all(propertyListPromises);

    res
      .status(200)
      .json({ message: "Fetched", success: true, body: propertyList });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "fetchUserFavouriteList",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const fetchUserWishList = async (req, res) => {
  try {
    const { username } = req.params;

    const userFound = await Users.findOne({ username: username }).populate(
      "userProfile",
      "wishList"
    );
    if (!userFound) {
      throw new Error("user not found");
    }

    const propertyListPromises = userFound.userProfile.wishList.map((data) => {
      return Properties.findOne({ propertyID: data }, "-shareDocIDList");
    });

    const propertyList = await Promise.all(propertyListPromises);

    res
      .status(200)
      .json({ message: "Fetched", success: true, body: propertyList });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "fetchUserFavouriteList",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getUserProfileDetails = async (req, res) => {
  try {
    const { username } = req.params;

    const userFound = await Users.findOne(
      { username: username },
      "-password -emailVerificationCode -userDefaultSettingID"
    )
      .populate("userProfile")
      .exec();
    if (!userFound) {
      throw new Error(`user not found. entry: ${username}`);
    }

    if (userFound.userProfile.paymentDetails) {
      const bytes = CryptoJS.AES.decrypt(
        userFound.userProfile.paymentDetails.cardNumber,
        process.env.USER_CARD_SECRET
      );
      userFound.userProfile.paymentDetails.cardNumber = bytes.toString(
        CryptoJS.enc.Utf8
      );
    }
    if (userFound.userProfile.withdrawalDetails) {
      const bytes = CryptoJS.AES.decrypt(
        userFound.userProfile.withdrawalDetails.ibanNumber,
        process.env.USER_IBAN_SECRET
      );
      userFound.userProfile.withdrawalDetails.ibanNumber = bytes.toString(
        CryptoJS.enc.Utf8
      );
    }

    res
      .status(200)
      .json({ message: "Fetched", success: true, body: userFound });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getUserProfileDetails",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const uploadProfilePic = async (req, res) => {
  try {
    const body = req.body;

    const userFound = await Users.findOne({ username: body.username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found");
    }

    const userProfileFound = await UserProfile.findOne({
      userDocID: userFound._id,
    });

    const uploadPath = `uploads/ProfilePics/${body.username}/`;
    userProfileFound.profilePicURL = uploadPath;

    await userProfileFound.save();

    res.status(201).json({
      message: "Profile pic updated.",
      success: true,
      body: uploadPath,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getUserProfileDetails",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const uploadIDCardPic = async (req, res) => {
  try {
    const body = req.body;

    const userFound = await Users.findOne({ username: body.username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found");
    }

    const userProfileFound = await UserProfile.findOne({
      userDocID: userFound._id,
    });

    const uploadPath = `uploads/IdentityCards/${body.username}/`;

    if (body.cardFace === "Front") {
      await UserProfile.updateOne(
        { _id: userProfileFound._id },
        {
          $set: {
            idCardPicsDir: uploadPath,
            idCardFrontAdded: true,
          },
        }
      );
    } else if (body.cardFace === "Back") {
      await UserProfile.updateOne(
        { _id: userProfileFound._id },
        {
          $set: {
            idCardPicsDir: uploadPath,
            idCardBackAdded: true,
          },
        }
      );
    }

    res.status(201).json({
      message: "Id Card Pic Updated.",
      success: true,
      body: uploadPath,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "uploadIDCardPic",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const updateUserProfileDetails = async (req, res) => {
  try {
    const { action, body, username } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found.");
    }

    const userProfileFound = await UserProfile.findOne({
      userDocID: userFound._id,
    });

    if (action === "Primary Details") {
      userFound.name = body.name;
      userProfileFound.gender = body.gender;
      const date = new Date(body.dobString);
      userProfileFound.dobString = body.dobString ?? "";
      userProfileFound.dob = date ?? null;
      userProfileFound.nicNumber = body.nicNumber;
      userProfileFound.nationality = body.nationality;
      userProfileFound.religion = body.religion;
      userProfileFound.bloodGroup = body.bloodGroup;
      if (userProfileFound.profileCompletePercentage <= 25) {
        userProfileFound.profileCompletePercentage = 25;
      }
    } else if (action === "Contact Details") {
      userFound.contact = body.contact;
      userProfileFound.permanentAddress = body.permanentAddress;
      if (userProfileFound.profileCompletePercentage <= 50) {
        userProfileFound.profileCompletePercentage = 50;
      }
    } else if (action === "Next of Kin") {
      userProfileFound.nextOfKinDetails = body.nextOfKinDetails;
      if (userProfileFound.profileCompletePercentage <= 75) {
        userProfileFound.profileCompletePercentage = 75;
      }
    } else if (action === "Payment Details") {
      userProfileFound.paymentDetails = body.paymentDetails;
      userProfileFound.paymentDetails.cardNumber = CryptoJS.AES.encrypt(
        body.paymentDetails.cardNumber,
        process.env.USER_CARD_SECRET
      );
    } else if (action === "Withdrawal Details") {
      if (body.payPalEmail && body.agreeCondition) {
        userProfileFound.payPalEmail = body.payPalEmail;
        userProfileFound.agreeCondition = body.agreeCondition;
        userProfileFound.withdrawalMethodAdded = body.agreeCondition;
        if (userProfileFound.profileCompletePercentage <= 100) {
          userProfileFound.profileCompletePercentage = 100;
        }
      } else {
        userProfileFound.withdrawalDetails = body.withdrawalDetails;
        userProfileFound.withdrawalDetails.ibanNumber = CryptoJS.AES.encrypt(
          body.withdrawalDetails.ibanNumber,
          process.env.USER_IBAN_SECRET
        );
        userProfileFound.withdrawalMethodAdded = true;
        if (userProfileFound.profileCompletePercentage <= 100) {
          userProfileFound.profileCompletePercentage = 100;
        }
      }
    }

    // Check if all necessary fields are completed
    const isPrimaryDetailsComplete = Boolean(
      userFound.name &&
        userProfileFound.gender &&
        userProfileFound.dob &&
        userProfileFound.nicNumber &&
        userProfileFound.nationality &&
        userProfileFound.religion
    );

    const isContactDetailsComplete = Boolean(
      userFound.contact && userProfileFound.permanentAddress
    );

    const isNextOfKinComplete = Boolean(
      userProfileFound.nextOfKinDetails &&
        userProfileFound.nextOfKinDetails.fullName &&
        userProfileFound.nextOfKinDetails.contact &&
        userProfileFound.nextOfKinDetails.relation &&
        userProfileFound.nextOfKinDetails.email &&
        userProfileFound.nextOfKinDetails.nicNumber &&
        userProfileFound.nextOfKinDetails.dobString
    );
    const iswithdrawalDetailsComplete = Boolean(
      userProfileFound.withdrawalMethodAdded
    );

    // Determine if the profile is completed
    userFound.isProfileCompleted =
      isPrimaryDetailsComplete &&
      isContactDetailsComplete &&
      isNextOfKinComplete &&
      iswithdrawalDetailsComplete;

    await userFound.save();
    userProfileFound.save().then(() => {
      if (
        action === "Next of Kin" ||
        action === "Payment Details" ||
        action === "Withdrawal Details"
      ) {
        const subject = `Profile Settings Updated`;
        const notificationBody = `Dear ${userFound.name}, \nYour profile settings changes have been updated. If you have done, this is the confirmation emal if not then please change your password for any security issues. \nThankyou.\nRegards, \nBeach Bunny House.`;
        const adminEmailBody = `Dear Admin, \n ${userFound.username} have Updated there Paypal Email to ${userProfileFound.payPalEmail}`
        sendUpdateNotification(
          subject,
          notificationBody,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );
        if (action === "Withdrawal Details") {
          sendEmail(process.env.ADMIN_EMAIL, subject, adminEmailBody);
        }
      }
    });

    res.status(200).json({ message: "Changes updated.", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "updateUserProfileDetails",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.mesaage || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { username } = req.query;

    if (username.length === 0) {
      return res.status(200).json({ users: [], success: true });
    }

    const users = await Users.find(
      {
        username: { $regex: username, $options: "i" }, // 'i' makes it case-insensitive
        role: { $in: ["user", "shareholder"] },
      },
      "name email username"
    );

    res.status(200).json({ users, success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "searchUsers",
      fileLocation: "controllers/UserController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.mesaage || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

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
  fetchUserFavouriteList,
  fetchUserWishList,
  getUserProfileDetails,
  uploadProfilePic,
  updateUserProfileDetails,
  searchUsers,
  getUserWithdrawals,
  genWithdrawal,
  updateWithdrawal,
  uploadIDCardPic,
  resetPasswordGenCode,
  verifyResetPasswordCode,
  genNewResetPasswordCode,
  newResetPasswordSubmission,
};
