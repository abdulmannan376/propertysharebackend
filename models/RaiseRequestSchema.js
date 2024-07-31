const mongoose = require("mongoose");

const RaisedRequestSchema = new mongoose.Schema({}, { timestamps: true });

const RaisedRequests = mongoose.model(
  "property_raised_requests",
  RaisedRequestSchema
);

module.exports = RaisedRequests;
