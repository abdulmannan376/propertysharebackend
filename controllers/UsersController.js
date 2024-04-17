const Users = require("../models/UserSchema");
const jwt = require("jsonwebtoken");
const CryptoJS = require("crypto-js");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "balaj.ali707@gmail.com",
    pass: "zyyo rgfk dsrr wxfx",
  },
});

function sendVerficationEmail(user, res) {
  const mailOptions = {
    from: "anam.sal60@gmail.com",
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
    const userFound = await Users.findOne({ email: email });
    if (!userFound) {
      return res
        .status(400)
        .json({ message: "Error occured. Try again", success: false });
    }

    if (!userFound.emailVerified) {
      userFound.emailVerificationCode = verificationCode;
      await userFound.save().then(() => sendVerficationEmail(userFound, res));
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
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const userLogin = async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    const userFound = await Users.findOne({ username: username });
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
    const userPassword = bytes.toString(CryptoJS.enc.Utf8)
    console.log("userPassword: ", userPassword)
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

    await userFound.save();

    res.status(200).json({ message: "Logged in", success: true, token: token });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
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
    const newUser = new Users({
      name: body.name,
      username: body.username,
      email: body.email,
      password: body.password,
      role: body.role,
      loggedIn: false,
      emailVerified: false,
      emailVerificationCode: verificationCode,
    });

    newUser.save().then(() => sendVerficationEmail(newUser, res));

    // res.status(201).json({ message: "User signed up.", success: true });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

module.exports = {
  userSignUp,
  verifyEmailVerficationCode,
  genNewVerificationCode,
  userLogin,
};
