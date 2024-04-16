const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema({
  coordinates: {
    type: {
      latitude: String,
      longitude: String,
    },
    required: true,
  },
  totalStakes: { type: Number, default: 26 },
  stakesOccupied: { type: Number, required: true, default: 0 },
  valueOfProperty: { type: Number, required: true },
  addressOfProperty: {
    type: {
      houseNumber: Number,
      streetNumber: Number,
      zipCode: Number,
      city: String,
      country: String,
      addressInString: String,
    },
    required: true,
  },
  detail: { type: String, required: true },
  remarks: { type: String, required: true },
  imageDirURL: { type: String, required: true },
  propertyID: { type: String, required: true },
  amenitiesID: { type: mongoose.Types.ObjectId },
});

const Properties = mongoose.model("properties", PropertySchema);

module.exports = Properties;
