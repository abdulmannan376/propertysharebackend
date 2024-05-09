const mongoose = require("mongoose");

const PropertyAmenitiesSchema = new mongoose.Schema({
  mainFeatures: {
    type: {
      inputs: {
        yearBuilt: Number,
        floorCount: Number,
        parkingSpace: Number,
        elevators: Number,
      },
      tags: {
        type: [String],
        enum: [
          "doubleGlazedWindows",
          "centralAC",
          "electricityBackup",
          "lobby",
          "centralHeating",
          "wasteDisposal",
          "serviceElevator",
          "other",
        ],
      },
    },
  },
  roomDetails: {
    type: {
      inputs: {
        beds: Number,
        baths: Number,
        servantQuater: Number,
        kitchen: Number,
      },
      tags: {
        type: [String],
        enum: [
          "drawingRoom",
          "studyRoom",
          "gym",
          "lounge",
          "powderRoom",
          "steamRoom",
          "other",
        ],
      },
    },
  },
  business: {
    type: {
      tags: {
        type: [String],
        enum: [
          "internet",
          "conferenceRoom",
          "cableTV",
          "satelliteTV",
          "intercom",
          "mediaRoom",
          "atmMachine",
          "other",
        ],
      },
    },
  },
  community: {
    type: {
      tags: {
        type: [String],
        enum: [
          "communityLawn",
          "communityGarden",
          "firstAid",
          "medicalCentre",
          "barbequeArea",
          "campFireArea",
          "swimmingPool",
          "dayCareCentre",
          "mosque",
          "prayerArea",
          "communityGym",
          "kids PlayArea",
          "communityCentre",
          "other",
        ],
      },
    },
  },
  healthAndRecreational: {
    type: {
      tags: {
        type: [String],
        enum: ["sauna", "jacuzzi", "other"],
      },
    },
  },
  nearbyFacilitiesAndLocations: {
    type: {
      inputs: {
        distanceFromAirport: Number,
      },
      tags: {
        type: [String],
        enum: [
          "schools",
          "restaurants",
          "hospitals",
          "shoppingMalls",
          "publicTransport",
          "other",
        ],
      },
    },
  },
});

const PropertyAmenities = mongoose.model(
  "property_amenities",
  PropertyAmenitiesSchema
);
module.exports = PropertyAmenities;
