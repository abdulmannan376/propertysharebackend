const PropertyRequest = require("../models/PropertyRequestSchema");
const JWTController = require("../helpers/jwtController");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

const addPropertyRequest = async (req, res) => {
  try {
    const body = req.body;

    const propertyCoordinates = { lat: body.lat, long: body.long };
    const newPropertyRequest = new PropertyRequest({
      coordinates: propertyCoordinates,
      personDetails: {
        name: body.name,
        email: body.email,
        contact: body.contact,
      },
    });

    await newPropertyRequest.save();

    res.status(201).json({ message: "Request submitted", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "addPropertyRequest",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const fetchCoordinatesOfProperties = async (req, res) => {
  try {
    const { id, key } = req.params;
    if (id === "All requests") {
      // Query to fetch only the coordinates from all PropertyRequest documents
      const coordinates = await PropertyRequest.find(
        {},
        "coordinates -_id"
      ).exec();

      // Return the coordinates to the client
      res.status(200).json({
        message: "Coordinates fetched successfully",
        data: coordinates,
        success: true,
      });
    }
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "fetchCoordinatesOfRequestedProperties",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const addNewProperty = async (req, res) => {
  try {
    const body = req.body;
    const isTokenValid = await JWTController.verifyJWT(body.token);
    if (!isTokenValid) {
      // await session.abortTransaction();
      // session.endSession();
      return res
        .status(403)
        .json({ message: "Not authorized.", success: false });
    }

    res.status(201).json({ message: "success", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "addNewProperty",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const addPropertyImages = async (req, res) => {
  try {
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "addPropertyImages",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};
module.exports = {
  addPropertyRequest,
  fetchCoordinatesOfProperties,
  addNewProperty,
};
