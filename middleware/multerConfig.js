// upload.js
// ─────────────────────────────
const multer = require("multer");

// Use memoryStorage so we can convert with Sharp from Buffer
const storage = multer.memoryStorage();

module.exports = multer({ storage });
