const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = `uploads/withdrawal-reciepts/${req.body.withdrawalID}/`;
    // Ensure the upload directory exists
    fs.mkdirSync(uploadPath, { recursive: true });
    // Clear the directory of any existing files before saving the new one
    const files = fs.readdirSync(uploadPath);
    files.forEach((file) => {
      fs.unlinkSync(path.join(uploadPath, file)); // Delete each file in the directory
    });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Use a fixed filename for the profile picture
    const filename = `reciept${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});

const upload = multer({ storage: storage });

module.exports = upload;
