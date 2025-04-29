const multer = require("multer");
const path = require("path");
const fs = require("fs");

// // Function to reorganize files in the directory
// function reorganizeFiles(directory, deleteIndices = []) {
//   console.log(directory, deleteIndices);
//   const files = fs
//     .readdirSync(directory)
//     .filter((file) => file.startsWith("image-"));
//   // Delete files as per indices provided
//   deleteIndices.sort((a, b) => b - a); // Sort indices in descending order for deletion
//   deleteIndices.forEach((index) => {
//     const filePath = path.join(directory, files[index]);
//     if (fs.existsSync(filePath)) {
//       fs.unlinkSync(filePath);
//     }
//   });
//   // Rename remaining files to maintain sequence
//   const remainingFiles = fs
//     .readdirSync(directory)
//     .filter((file) => file.startsWith("image-"));
//   remainingFiles.forEach((file, index) => {
//     const newFileName = `image-${index + 1}${path.extname(file)}`;
//     const oldFilePath = path.join(directory, file);
//     const newFilePath = path.join(directory, newFileName);
//     fs.renameSync(oldFilePath, newFilePath);
//   });
// }

// Configure storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(
      __dirname,
      "..",
      "uploads",
      "IdentityCards",
      req.body.username
    );
    fs.mkdirSync(uploadPath, { recursive: true });
    // No more wiping the whole folder!
    // Just pass back the path
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${req.body.cardFace}${ext}`;
    const uploadPath = path.join(
      __dirname,
      "..",
      "uploads",
      "IdentityCards",
      req.body.username
    );
    const fullFilePath = path.join(uploadPath, filename);

    // if an old IDCardFront.png (or PassportFront.png) already exists, delete it
    if (fs.existsSync(fullFilePath)) {
      fs.unlinkSync(fullFilePath);
    }

    cb(null, filename);
  },
});


const uploadIDCard = multer({ storage: storage });

module.exports = uploadIDCard;
