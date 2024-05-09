const PropertyRequest = require("../models/PropertyRequestSchema");
const PropertyListing = require("../models/PropertySchema");
const PropertyAmenities = require("../models/AmenitiesSchema");
const JWTController = require("../helpers/jwtController");
const { sendEmail } = require("../helpers/emailController");
const Properties = require("../models/PropertySchema");
const { default: slugify } = require("slugify");

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

const getPropertyByUsername = async (req, res) => {
  try {
    // const body = req.body;
    // const isTokenValid = await JWTController.verifyJWT(body.token);
    // if (!isTokenValid) {
    //   // await session.abortTransaction();
    //   // session.endSession();
    //   return res
    //     .status(403)
    //     .json({ message: "Not authorized.", success: false });
    // }

    const { key } = req.params;

    const propertiesByUsername = await Properties.find({
      publishedBy: key,
    });

    console.log("propertiesByUsername: ", propertiesByUsername);

    res
      .status(200)
      .json({ message: "Fetched", body: propertiesByUsername, success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getPropertyByUsername",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const updateProperty = async (req, res) => {
  try {
    const body = req.body;
    const { id } = req.params;
    const isTokenValid = await JWTController.verifyJWT(body.token);
    if (!isTokenValid) {
      // await session.abortTransaction();
      // session.endSession();
      return res
        .status(403)
        .json({ message: "Not authorized.", success: false });
    }

    const propertyFound = await Properties.findOne({ propertyID: id });

    if (!propertyFound) {
      return res.status(404).json({ message: "Try Again", success: false });
    }

    let listingStatus = body.listingStatus;
    if (body.userRole === "admin" && listingStatus === "completed") {
      listingStatus = "live";
    } else if (body.userRole === "user" && listingStatus === "completed") {
      listingStatus = "pending approval";
    } else if (listingStatus !== "draft") {
      listingStatus = "draft";
    }

    let propertyAmenitiesFound;

    console.log("formPhase: ", body.formPhase, typeof body.formPhase);
    if (body.formPhase == 2) {
      propertyAmenitiesFound = await PropertyAmenities.findOneAndUpdate(
        { _id: propertyFound.amenitiesID },
        {
          mainFeatures: body.amenities.mainFeatures,
          roomDetails: body.amenities.roomDetails,
          business: body.amenities.business,
          community: body.amenities.community,
          healthAndRecreational: body.amenities.healthAndRecreational,
          nearbyFacilitiesAndLocations:
            body.amenities.nearbyFacilitiesAndLocations,
        }
      );
    } else if (body.formPhase == 3) {
    } else {
      propertyAmenitiesFound = new PropertyAmenities();
    }

    (propertyFound.title = body.title),
      (propertyFound.coordinates = {
        latitude: body.coordinates.lat,
        longitude: body.coordinates.long,
      }),
      (propertyFound.detail = body.overview),
      (propertyFound.totalStakes = body.numOfShares),
      (propertyFound.valueOfProperty = body.totalPrice),
      (propertyFound.area = body.areaSize),
      (propertyFound.startDurationFrom = body.startDate),
      (propertyFound.propertyType = body.propertyType),
      (propertyFound.beds = body.numOfBeds),
      (propertyFound.baths = body.numOfBaths),
      (propertyFound.addressOfProperty = {
        houseNumber: body.houseNumber,
        streetNumber: body.streetNumber,
        zipCode: body.zipCode,
        country: body.country,
        state: body.state,
        city: body.city,
        addressInString: body.fullAddress,
      }),
      (propertyFound.listingStatus = listingStatus),
      await propertyAmenitiesFound.save();
    await propertyFound.save().then(() => {
      if (listingStatus === "live") {
        const subject = `Property (${propertyFound.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully live on our platform and is ready for operations from the start date: ${body.startDate}. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody, res, {
          message: `Successfull.`,
          success: true,
        });
      } else if (listingStatus === "pending approval") {
        const subject = `Property (${propertyFound.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully sent for approval. Our team will review your request and get back to you for further proceedings. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody, res, {
          message: `Successfull.`,
          success: true,
        });
      } else if (listingStatus === "draft") {
        const subject = `Property (${propertyFound.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully saved. \nPlease complete it quick with all the details as this draft will be deleted after 7 days. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody, res, {
          message: `Successfull.`,
          success: true,
        });
      }
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "updateProperty",
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

    let listingStatus = body.listingStatus;
    if (body.userRole === "admin" && listingStatus === "completed") {
      listingStatus = "live";
    } else if (body.userRole === "user" && listingStatus === "completed") {
      listingStatus = "pending approval";
    } else if (listingStatus !== "draft") {
      listingStatus = "draft";
    }

    let newAmenities;

    if (body.formPhase == 2) {
      newAmenities = new PropertyAmenities({
        mainFeatures: body.amenities.mainFeatures,
        roomDetails: body.amenities.roomDetails,
        business: body.amenities.business,
        community: body.amenities.community,
        healthAndRecreational: body.amenities.healthAndRecreational,
        nearbyFacilitiesAndLocations:
          body.amenities.nearbyFacilitiesAndLocations,
      });
    } else if (body.formPhase == 3) {
    } else {
      newAmenities = new PropertyAmenities();
    }

    const slug = slugify(body.title, { lower: true, strict: true });

    const newProperty = new PropertyListing({
      title: body.title,
      slug: slug,
      coordinates: {
        latitude: body.coordinates.lat,
        longitude: body.coordinates.long,
      },
      detail: body.overview,
      totalStakes: body.numOfShares,
      valueOfProperty: body.totalPrice,
      area: body.areaSize,
      startDurationFrom: body.startDate,
      propertyType: body.propertyType,
      beds: body.numOfBeds,
      baths: body.numOfBaths,
      addressOfProperty: {
        houseNumber: body.houseNumber,
        streetNumber: body.streetNumber,
        zipCode: body.zipCode,
        country: body.country,
        state: body.state,
        city: body.city,
        addressInString: body.fullAddress,
      },
      listingStatus: listingStatus,
      publishedBy: body.username,
      publisherRole: body.userRole,
      amenitiesID: newAmenities._id,
    });

    await newAmenities.save();
    await newProperty.save().then(() => {
      if (listingStatus === "live") {
        const subject = `Property (${newProperty.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully live on our platform and is ready for operations from the start date: ${body.startDate}. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody, res, {
          message: `Successfull.`,
          success: true,
        });
      } else if (listingStatus === "pending approval") {
        const subject = `Property (${newProperty.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully sent for approval. Our team will review your request and get back to you for further proceedings. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody, res, {
          message: `Successfull.`,
          success: true,
        });
      } else if (listingStatus === "draft") {
        const subject = `Property (${newProperty.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully saved. \nPlease complete it quick with all the details as this draft will be deleted after 7 days. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody, res, {
          message: `Successfull.`,
          success: true,
        });
      }
    });
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
  getPropertyByUsername,
  updateProperty,
};
