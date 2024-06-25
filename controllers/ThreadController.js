const Threads = require("../models/threadSchema");

const genNewThread = async (req, res) => {
  try {
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "genNewThread",
      fileLocation: "controllers/ThreadController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

module.exports = {
    genNewThread,
}
