const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Function to reorganize files in the directory
function reorganizeFiles(directory, deleteIndices = []) {
    console.log(directory, deleteIndices)
    const files = fs.readdirSync(directory).filter(file => file.startsWith('image-'));
    // Delete files as per indices provided
    deleteIndices.sort((a, b) => b - a); // Sort indices in descending order for deletion
    deleteIndices.forEach(index => {
        const filePath = path.join(directory, files[index]);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    });
    // Rename remaining files to maintain sequence
    const remainingFiles = fs.readdirSync(directory).filter(file => file.startsWith('image-'));
    remainingFiles.forEach((file, index) => {
        const newFileName = `image-${index}${path.extname(file)}`;
        const oldFilePath = path.join(directory, file);
        const newFilePath = path.join(directory, newFileName);
        fs.renameSync(oldFilePath, newFilePath);
    });
}

// Configure storage for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = `uploads/${req.body.propertyID}/`;
        // Ensure the upload directory exists
        fs.mkdirSync(uploadPath, { recursive: true });
        // Delete specified images before saving new ones
        console.log(req.body)
        if (req.body.deleteImageList) {
            reorganizeFiles(uploadPath, req.body.deleteImageList.map(Number));
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const directory = `uploads/${req.body.propertyID}/`;
        const files = fs.readdirSync(directory).filter(file => file.startsWith('image-'));
        const imageNumber = files.length + 1; // Assign next number in sequence
        const filename = `image-${imageNumber}${path.extname(file.originalname)}`;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });

module.exports = upload;
