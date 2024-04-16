require("dotenv").config();
const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("connection made");
  })
  .catch((err) => {
    console.log("error establishing connection", err);
  });