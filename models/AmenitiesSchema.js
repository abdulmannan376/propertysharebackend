const mongoose = require("mongoose");

const PropertyAmenitiesSchema = new mongoose.Schema({
  mainFeatures: {
    type: {
      yearBuilt: Number,
      windowsType: String,
      floorCount: Number,
      parkingspace: Number,
      centralAC: Boolean,
      electricityBackup: Boolean,
      elevators: Number,
      lobbyInBuilding: Boolean,
      centralHeating: Boolean,
      wasteDisposal: Boolean,
      serviceElevator: Boolean,
      other: String,
    }
  },
  roomDetails: {
    type: {
      beds: Number,
      baths: Number,
      drawingRoom: Boolean,
      studyRoom: Boolean,
      gym: Boolean,
      lounge: Boolean,
      servantQuater: Number,
      kitchen: Number,
      powderRoom: Boolean,
      steamRoom: Boolean,
      other: String,
    }
  },
  business: {
    type: {
      internet: Boolean,
      conferenceRoom: Boolean,
      cableTV: Boolean,
      satelliteTV: Boolean,
      intercom: Boolean,
      mediaRoom: Boolean,
      atmMachine: Boolean,
      other: String,
    }
  },
  community: {
    type: {
        communityLawn: Boolean,
        communityGarden: Boolean,
        firstAid: Boolean,
        medicalCentre: Boolean,
        barbequeArea: Boolean,
        campFireArea: Boolean,
        swimmingPool: Boolean,
        dayCareCentre: Boolean,
        mosque: Boolean,
        prayerArea: Boolean,
        communityGym: Boolean,
        kidsPlayArea: Boolean,
        communityCentre: Boolean,
        other: String
    }
  },
  healthAndRecreational: {
    type: {
        sauna: Boolean,
        jacuzzi: Boolean,
        other: String
    }
  },
  nearbyFacilitiesAndLocations: {
    type: {
        schools: Boolean,
        restaurants: Boolean,
        hospitals: Boolean,
        distanceFromAirport: Number,
        shoppingMalls: Boolean,
        publicTransport: Boolean,
        other: String
    }
  }
});

const PropertyAmenities = mongoose.model("property_amenities", PropertyAmenitiesSchema)
module.exports = PropertyAmenities
