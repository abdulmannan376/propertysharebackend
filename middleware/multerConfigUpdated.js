// middleware/multerConfigUpdated.js
// ─────────────────────────────────────
const multer = require("multer");

// In-memory storage so we can hand a Buffer to sharp()
const storage = multer.memoryStorage();

module.exports = multer({ storage });
