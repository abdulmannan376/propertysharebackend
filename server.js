require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const userRoutes = require("./routes/UserRoutes");
const propertyRoutes = require("./routes/PropertyRoutes");
const notificationRoutes = require("./routes/notificationRoutes")
const upload = require("./middleware/multerConfig");
const path = require("path");

app.use(cors());
app.use(express.json());

require("./middleware/dbConnect");

app.use("/user", userRoutes);
app.use("/property", propertyRoutes);
app.use("/notification", notificationRoutes)


// Serve images as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.post(
  "/upload-property-images",
  upload.array("imageFiles", 10),
  (req, res) => {
    // 'imageFiles' is the name of the form field for the files
    // '10' is the maximum number of files allowed
    if (req.files.length === 0) {
      return res.status(400).send("No files uploaded.");
    }
    let fileNames = req.files.map((file) => file.filename);

    
    res.send(`Files uploaded successfully!`);


  }
);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
