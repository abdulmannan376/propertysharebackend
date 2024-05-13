const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Function to get the next image number
function getNextImageNumber(directory) {
    try {
        const files = fs.readdirSync(directory);
        return files.filter(file => file.startsWith('image-')).length + 1;
    } catch (error) {
        console.error('Error reading directory:', error);
        return 1;
    }
}

// Configure storage for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = `uploads/${req.body.propertyID}/`;
        // Ensure the upload directory exists
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Use the propertyID sent from the frontend
        const directory = `uploads/${req.body.propertyID}/`;
        const imageNumber = getNextImageNumber(directory);
        const filename = `image-${imageNumber}${path.extname(file.originalname)}`;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });

module.exports = upload;
