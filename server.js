require("dotenv").config();
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;



const userRoutes = require("./routes/UserRoutes");
const propertyRoutes = require("./routes/PropertyRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const upload = require("./middleware/multerConfig");
const shareRoutes = require("./routes/ShareRoutes");
const threadRoutes = require("./routes/threadRoutes");
const path = require("path");
const { sendEmail } = require("./helpers/emailController");
const startCronJobs = require("./helpers/cronJobs");
// const startWebsocket = require("./middleware/handleWebsocket");
const { app, server } = require("./socket/socket");

// app.use(cors());
// app.use(express.json());

// io.on("connection", (socket) => {
//   console.log("A user connected");

//   socket.on("disconnect", () => {
//     console.log("User disconnected");
//   });

//   // Example: listen for messages and broadcast
//   socket.on("message", (msg) => {
//     io.emit("message", "Hello Client"); // Emitting to all clients
//   });
// });

// startWebsocket(io);

require("./middleware/dbConnect");
startCronJobs();

app.use("/user", userRoutes);
app.use("/property", propertyRoutes);
app.use("/notification", notificationRoutes);
app.use("/share", shareRoutes);
app.use("/thread", threadRoutes);

// Serve images as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

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

app.post("/contact-us", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    const subject = `Query from ${name} `;
    sendEmail(
      process.env.CONTACT_EMAIL_ADDRESS,
      subject,
      `name: ${name}\nemail:${email}\nmessage: ${message}`
    );

    res
      .status(200)
      .json({ message: "Message sent successfully", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "contactUs",
      fileLocation: "/server.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
});


// Listen on port 443
server.listen(443, () => {
  console.log("HTTPS Server running on port 443");
});

// server.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });
