const Users = require("../models/UserSchema");
const jwt = require("jsonwebtoken");
const CryptoJS = require("crypto-js");

function sendVerficationEmail() {}

const userSignUp = async (req, res) => {
  try {
    const body = req.body;
    console.log("body: ", body);
    const userFound = await Users.findOne({ email: body.email });
    if (userFound) {
      res
        .status(400)
        .json({ message: "Email already resgistered.", success: false });
    }

    const { password } = body;
    body.password = CryptoJS.AES.encrypt(password, process.env.PASSWORD_SECRET);
    const newUser = new Users({
      name: body.name,
      username: body.username,
      email: body.email,
      password: body.password,
      role: body.role,
      loggedIn: false,
      emailVerified: false,
    });

    await newUser.save();
    res.status(201).json({ message: "User signed up.", success: true });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

module.exports = { userSignUp };
