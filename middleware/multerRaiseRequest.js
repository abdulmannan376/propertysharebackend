// middleware/uploadRaiseRequestImages.js
// —————————————————————————————————————————————————————————
// we switch to in-memory storage so we only ever write .png in the controller
const multer = require("multer");
module.exports = multer({ storage: multer.memoryStorage() });
