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

// const allowedMimes = ["image/png", "image/jpeg", "image/jpg"];
// const uploadUserProFilePic = multer({
//   storage,
//   fileFilter: (req, file, cb) => {
//     if (allowedMimes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(
//         new Error(
//           "Unsupported file type. Only PNG, JPG and JPEG are allowed."
//         ),
//         false
//       );
//     }
//   },
// });
// Configure storage for Multer

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = `uploads/ProfilePics/${req.body.username}/`;
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
    const filename = `profile-pic${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});

const uploadUserProFilePic = multer({ storage: storage });

module.exports = uploadUserProFilePic;
