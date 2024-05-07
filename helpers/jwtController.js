const Users = require("../models/UserSchema");
const jwt = require("jsonwebtoken");

async function verifyJWT(token) {
  try {
    const user = await jwt.verify(
      token,
      process.env.JWT_SECRET,
      async (err, decoded) => {
        if (err) {
          throw err;
        }
        return decoded;
      }
    );
    const userFound = await Users.findOne({ username: user.username});
    if (!userFound) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {verifyJWT}
