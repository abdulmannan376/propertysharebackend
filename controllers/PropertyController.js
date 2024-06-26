const PropertyRequest = require("../models/PropertyRequestSchema");
const PropertyListing = require("../models/PropertySchema");
const PropertyAmenities = require("../models/AmenitiesSchema");
const PropertyShare = require("../models/PropertyShareSchema");
const JWTController = require("../helpers/jwtController");
const { sendEmail } = require("../helpers/emailController");
const Properties = require("../models/PropertySchema");
const { default: slugify } = require("slugify");
const fs = require("fs");
const fsPromises = require("fs/promises"); // Use promises version for async operations
const path = require("path");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

const addPropertyRequest = async (req, res) => {
  try {
    const body = req.body;
    console.log(body);

    const propertyLocation = {
      type: "Point",
      coordinates: [body.long, body.lat],
    };

    const newPropertyRequest = new PropertyRequest({
      location: propertyLocation,
      personDetails: {
        name: body.name,
        email: body.email,
        contact: body.contact,
      },
      requirementDetails: {
        propertyType: body.propertyType,
        areaRange: body.areaRange,
        priceRange: body.priceRange,
      },
    });

    await newPropertyRequest.save().then(() => {
      const recipient = body.email;
      const subject = "New Property Request at Beach Bunny House";
      const emailBody = `Dear ${body.name}, \nYour request has been successfully submitted into our system any property according to your requirement will be infromed to you by our email. \nRegards \nBeach Bunny House.`;

      sendEmail(recipient, subject, emailBody);
      res.status(201).json({
        message: "A confirmation email is sent to you.",
        success: true,
      });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "addPropertyRequest",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const fetchCoordinatesOfRequestes = async (req, res) => {
  try {
    // Query to fetch only the coordinates from all PropertyRequest documents
    const coordinates = await PropertyRequest.find(
      {},
      "location propertyID -_id"
    ).exec();

    // Return the coordinates to the client
    res.status(200).json({
      message: "Coordinates fetched successfully",
      data: coordinates,
      success: true,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
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

    const propertiesWithAmenitiesPromises = propertiesByUsername.map(
      (property) => {
        const propertyWithAmenities = property.populate("amenitiesID");
        return propertyWithAmenities;
      }
    );

    const propertiesWithAmenities = await Promise.all(
      propertiesWithAmenitiesPromises
    );

    console.log("propertiesByUsername: ", propertiesWithAmenities);

    res.status(200).json({
      message: "Fetched",
      body: propertiesWithAmenities,
      success: true,
    });
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
    console.log("body: ", body);
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
    } else if (listingStatus !== "draft" && listingStatus !== "live") {
      listingStatus = "draft";
    }

    let propertyAmenitiesFound;

    console.log("formPhase: ", body.formPhase, typeof body.formPhase);
    if (body.formPhase === 1) {
      propertyFound.title = body.title;
      (propertyFound.location = {
        type: "Point",
        coordinates: [body.coordinates.long, body.coordinates.lat],
      }),
        (propertyFound.detail = body.overview);
      propertyFound.totalStakes = body.numOfShares;
      propertyFound.valueOfProperty = body.totalPrice;
      propertyFound.area = body.areaSize;
      propertyFound.startDurationFrom = body.startDate;
      propertyFound.propertyType = body.propertyType;
      propertyFound.addressOfProperty = {
        houseNumber: body.houseNumber,
        streetNumber: body.streetNumber,
        zipCode: body.zipCode,
        country: body.country,
        state: body.state,
        city: body.city,
        addressInString: body.fullAddress,
      };
      propertyFound.listingStatus = listingStatus;
    } else if (body.formPhase == 2) {
      propertyAmenitiesFound = await PropertyAmenities.findOneAndUpdate(
        { _id: propertyFound.amenitiesID },
        {
          mainFeatures: body.amenities.mainFeatures,
          roomDetails: body.amenities.roomsDetails,
          business: body.amenities.business,
          community: body.amenities.community,
          healthAndRecreational: body.amenities.healthAndRecreational,
          nearbyFacilitiesAndLocations:
            body.amenities.nearbyFacilitiesAndLocations,
        }
      );
      await propertyAmenitiesFound.save();
    }

    await propertyFound.save().then(() => {
      if (listingStatus === "live") {
        const subject = `Property (${propertyFound.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully live on our platform and is ready for operations from the start date: ${body.startDate}. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody);
        return res.status(200).json({
          message: `Successfull.`,
          success: true,
        });
      } else if (listingStatus === "pending approval") {
        const subject = `Property (${propertyFound.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully sent for approval. Our team will review your request and get back to you for further proceedings. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody);
        return res.status(200).json({
          message: `Successfull.`,
          success: true,
        });
      } else if (listingStatus === "draft") {
        const subject = `Property (${propertyFound.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully saved. \nPlease complete it quick with all the details as this draft will be deleted after 7 days. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody);
        return res.status(200).json({
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

    // console.log(body);
    let listingStatus = body.listingStatus;
    if (body.userRole === "admin" && listingStatus === "completed") {
      listingStatus = "live";
    } else if (body.userRole === "user" && listingStatus === "completed") {
      listingStatus = "pending approval";
    } else if (listingStatus !== "draft") {
      listingStatus = "draft";
    }

    const newAmenities = new PropertyAmenities();

    const slug = slugify(body.title, { lower: true, strict: true });

    const newProperty = new PropertyListing({
      title: body.title,
      slug: slug,
      location: {
        type: "Point",
        coordinates: [body.coordinates.long, body.coordinates.lat],
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
    await newProperty.save();
    const startDurationFrom = new Date(body.startDate);
    const shareDocIDList = [];

    for (let i = 0; i <= body.numOfShares; i++) {
      const startAt = i * 14;
      const endAt = (i + 1) * 14;

      const startDate = new Date(startDurationFrom);
      startDate.setDate(startDurationFrom.getDate() + startAt);
      const endDate = new Date(startDurationFrom);
      endDate.setDate(startDurationFrom.getDate() + endAt);

      let shareIndex;
      if (i >= 0 && i <= 9) {
        shareIndex = `0${i}`;
      } else {
        shareIndex = i;
      }

      // console.log("start Date: ", startDate, "end date: ", endDate);
      const newPropertyShare = new PropertyShare({
        availableInDuration: {
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        },
        propertyDocID: newProperty._id,
        shareID: `${newProperty.propertyID}${shareIndex}`,
      });

      await newPropertyShare.save();
      shareDocIDList.push(newPropertyShare._id);
    }

    console.log(shareDocIDList);
    newProperty.shareDocIDList = shareDocIDList;

    await newProperty.save().then(() => {
      if (listingStatus === "live") {
        const subject = `Property (${newProperty.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully live on our platform and is ready for operations from the start date: ${body.startDate}. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody);
        return res.status(200).json({
          message: `Successfull.`,
          success: true,
          body: newProperty,
        });
      } else if (listingStatus === "pending approval") {
        const subject = `Property (${newProperty.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully sent for approval. Our team will review your request and get back to you for further proceedings. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody);
        return res.status(200).json({
          message: `Successfull.`,
          success: true,
          body: newProperty,
        });
      } else if (listingStatus === "draft") {
        const subject = `Property (${newProperty.propertyID}) status of listing.`;
        const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully saved. \nPlease complete it quick with all the details as this draft will be deleted after 7 days. \nRegards,\nBunny Beach House.`;
        sendEmail(body.email, subject, emailBody);
        return res.status(200).json({
          message: `Successfull.`,
          success: true,
          body: newProperty,
        });
      }
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "addNewProperty",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

// Function to reorganize files in the directory
function reorganizeFiles(directory, deleteIndices = []) {
  console.log(directory, deleteIndices);
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.startsWith("image-"));
  // Delete files as per indices provided
  deleteIndices.sort((a, b) => b - a); // Sort indices in descending order for deletion
  deleteIndices.forEach((index) => {
    const filePath = path.join(directory, files[index]);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
  // Rename remaining files to maintain sequence
  const remainingFiles = fs
    .readdirSync(directory)
    .filter((file) => file.startsWith("image-"));
  remainingFiles.forEach((file, index) => {
    const newFileName = `image-${index + 1}${path.extname(file)}`;
    const oldFilePath = path.join(directory, file);
    const newFilePath = path.join(directory, newFileName);
    fs.renameSync(oldFilePath, newFilePath);
  });
}

// const addPropertyImages = async (req, res) => {
//   try {
//     const body = req.body;
//     const files = req.files;
//     const propertyFound = await Properties.findOne({
//       propertyID: body.propertyID,
//     });

//     if (!propertyFound) {
//       return res.status(400).json({ message: "Error occured", success: false });
//     }
//     // console.log("body: ", body);

//     let listingStatus = "";
//     if (body.userRole === "admin") {
//       listingStatus = "live";
//     } else if (body.userRole === "user") {
//       listingStatus = "pending approval";
//     }

//     const uploadPath = `uploads/${req.body.propertyID}/`;
//     // Ensure the upload directory exists
//     fs.mkdirSync(uploadPath, { recursive: true });
//     // Delete specified images before saving new ones
//     console.log(req.body);
//     if (req.body.deleteImageList) {
//       reorganizeFiles(uploadPath, req.body.deleteImageList.map(Number));
//     }

//     propertyFound.imageDirURL = uploadPath;
//     const updatedImageCount = fs
//       .readdirSync(propertyFound.imageDirURL)
//       .filter((file) => file.startsWith("image-")).length;
//     propertyFound.imageCount = updatedImageCount;
//     propertyFound.listingStatus = listingStatus;

//     await propertyFound.save().then(() => {
//       if (listingStatus === "live") {
//         const subject = `Property (${body.propertyID}) status of listing.`;
//         const emailBody = `Hello ${body.userName},\nYour property with title: ${propertyFound.title}, is successfully live on our platform and is ready for operations from the start date: ${propertyFound.startDate}. \nRegards,\nBunny Beach House.`;
//         sendEmail(body.email, subject, emailBody);
//         return res.status(200).json({
//           message: `Successfull.`,
//           success: true,
//         });
//       } else if (listingStatus === "pending approval") {
//         const subject = `Property (${body.propertyID}) status of listing.`;
//         const emailBody = `Hello ${body.userName},\nYour property with title: ${body.title}, is successfully sent for approval. Our team will review your request and get back to you for further proceedings. \nRegards,\nBunny Beach House.`;
//         sendEmail(body.email, subject, emailBody);
//         return res.status(200).json({
//           message: `Successfull.`,
//           success: true,
//         });
//       }
//     });
//   } catch (error) {
//     console.log(`Error: ${error}`, "\nlocation: ", {
//       function: "addPropertyImages",
//       fileLocation: "controllers/PropertyController.js",
//       timestamp: currentDateString,
//     });
//     res
//       .status(500)
//       .json({ message: "Internal Server Error", error: error, success: false });
//   }
// };

const addPropertyImages = async (req, res) => {
  try {
    const body = req.body;
    const files = req.files;

    console.log(body);
    const propertyFound = await Properties.findOne({
      propertyID: body.propertyID,
    });

    if (!propertyFound) {
      return res
        .status(400)
        .json({ message: "Property not found", success: false });
    }

    const uploadPath = `uploads/${body.propertyID}/`;
    // Ensure the upload directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Save new files (assuming diskStorage is used and files are automatically saved)
    const imageCount = propertyFound.imageCount;
    files.forEach((file, index) => {
      const newFilename = `image-${imageCount + index + 1}${path.extname(
        file.originalname
      )}`;
      const oldPath = file.path;
      const newPath = path.join(uploadPath, newFilename);

      // Rename file to maintain naming convention
      fs.renameSync(oldPath, newPath);
    });

    // Handle deletion of specified images
    if (body.deleteImageList && body.deleteImageList?.length) {
      reorganizeFiles(uploadPath, body.deleteImageList.map(Number));
    }

    if (body.pinnedImage) {
      propertyFound.pinnedImageIndex = parseInt(body.pinnedImage) + 1;
    }

    // Update property with new information
    propertyFound.imageDirURL = uploadPath;
    propertyFound.imageCount = fs
      .readdirSync(uploadPath)
      .filter((file) => file.startsWith("image-")).length;
    propertyFound.listingStatus =
      body.userRole === "admin" ? "live" : "pending approval";

    await propertyFound.save();

    const subject = `Property (${body.propertyID}) status of listing.`;
    const emailBody =
      body.userRole === "admin"
        ? `Hello ${body.userName},\nYour property with title: ${propertyFound.title}, is successfully live on our platform.\nRegards,\nBunny Beach House.`
        : `Hello ${body.userName},\nYour property with title: ${body.title}, is under review for approval.\nRegards,\nBunny Beach House.`;

    sendEmail(body.email, subject, emailBody);

    res.status(200).json({
      message: "Property images updated successfully.",
      success: true,
    });
  } catch (error) {
    console.error(`Error in addPropertyImages: ${error}\n`, {
      function: "addPropertyImages",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const deleteAllImages = async (req, res) => {
  try {
    const body = req.body;
    const propertyFound = await Properties.findOne({
      propertyID: body.propertyID,
    });

    if (!propertyFound) {
      return res.status(400).json({ message: "Error occured", success: false });
    }

    const imageDir = `uploads/${body.propertyID}/`;

    // Check if directory exists before attempting to remove it
    try {
      await fsPromises.access(imageDir);
      await fsPromises.rmdir(imageDir, { recursive: true });
      console.log(
        `All images have been deleted and directory ${imageDir} removed.`
      );
    } catch (dirError) {
      console.error(`Error accessing or removing directory: ${dirError}`);
      return res
        .status(500)
        .json({ message: "Failed to delete images directory", success: false });
    }

    // Optionally update the property record if needed
    propertyFound.imageCount = 0;
    propertyFound.imageDirURL = "";
    await propertyFound.save();

    res.json({ message: "All images successfully deleted", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "deleteAllImages",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

// const getFeaturedProperty = async (req, res) => {

//   try {
//     const body = JSON.parse(req.params.key);
//     const { coordinates, propertyType, beds, area, price, page } = body;
//     const matchQuery = { status: "Featured" }; // Default match query

//     console.log("body: ", body);
//     // Adding dynamic filters based on the request body
//     if (propertyType && propertyType !== "")
//       matchQuery.propertyType = propertyType;
//     if (beds && beds !== "") matchQuery.beds = beds;
//     if (area && area !== "") matchQuery.area = { $lte: area };
//     if (price && price !== "") matchQuery.price = { $lte: price };

//     const pipeline = [];

//     const propertiesPerPage = 8;
//     const skipDocuments = (page - 1) * propertiesPerPage; // Calculate number of documents to skip

//     // If coordinates are provided and they are not empty
//     if (coordinates && coordinates.length === 2) {
//       pipeline.push({
//         $geoNear: {
//           near: { type: "Point", coordinates: coordinates.map(Number) },
//           distanceField: "distance",
//           maxDistance: 3000, // 3 kilometers in meters
//           spherical: true,
//         },
//       });
//     }

//     pipeline.push({ $match: matchQuery });

//     // Add pagination to the pipeline
//     pipeline.push({ $skip: skipDocuments }, { $limit: propertiesPerPage });

//     const properties = await Properties.aggregate(pipeline);

//     const propertyPromises = properties.map(async (propertyData) => {
//       let property = await Properties.findById(propertyData._id); // Retrieve the full Mongoose document
//       if (property) {
//         property.viewedCount++;
//         return property.save(); // Now .save() is available
//       }
//     });

//     const allProperties = await Promise.all(propertyPromises);

//     res.status(200).json({
//       message: "Fetched featured properties successfully",
//       success: true,
//       body: allProperties,
//       page: page,
//     });
//   } catch (error) {
//     console.log(`Error: ${error}`, "location: ", {
//       function: "getFeaturedProperty",
//       fileLocation: "controllers/PropertyController.js",
//       timestamp: currentDateString,
//     });
//     res
//       .status(500)
//       .json({ message: "Internal Server Error", error: error, success: false });
//   }
// };

const getFeaturedProperty = async (req, res) => {
  try {
    const body = JSON.parse(req.params.key);
    const { coordinates, propertyType, beds, area, price, page } = body;
    const matchQuery = { status: "Featured" }; // Default match query

    // console.log("body: ", body);
    // Adding dynamic filters based on the request body
    if (propertyType && propertyType.length > 0)
      matchQuery.propertyType = { $in: propertyType };
    if (area && area.length === 2) {
      if (area[0] !== "0") {
        matchQuery.area = { $gte: parseFloat(area[0]) };
      }
      if (area[1] !== "ANY") {
        matchQuery.area = { ...matchQuery.area, $lte: parseFloat(area[1]) };
      }
    }

    if (price && price.length === 2) {
      if (price[0] !== "0") {
        matchQuery.price = { $gte: parseFloat(price[0]) };
      }
      if (price[1] !== "ANY") {
        matchQuery.price = { ...matchQuery.price, $lte: parseFloat(price[1]) };
      }
    }

    const pipeline = [];

    // If coordinates are provided and they are not empty
    if (coordinates && coordinates.length === 2) {
      pipeline.push({
        $geoNear: {
          near: { type: "Point", coordinates: coordinates.map(Number) },
          distanceField: "distance",
          maxDistance: 300000, // 10000 kilometers in meters
          spherical: true,
          query: matchQuery,
        },
      });
    }

    pipeline.push({ $match: matchQuery });

    // Lookup to join with the PropertyAmenities collection
    pipeline.push({
      $lookup: {
        from: "property_amenities",
        localField: "amenitiesID",
        foreignField: "_id",
        as: "amenities",
      },
    });

    // Unwind the result to deconstruct the amenities array
    pipeline.push({
      $unwind: {
        path: "$amenities",
        includeArrayIndex: "string",
        preserveNullAndEmptyArrays: false,
      },
    });

    // Adding dynamic filter for beds if specified
    if (beds && beds.length > 0) {
      pipeline.push({
        $match: {
          "amenities.roomDetails.inputs.beds": { $in: beds.map(Number) },
        },
      });
    }

    const propertiesPerPage = 8;
    const skipDocuments = (page - 1) * propertiesPerPage; // Calculate number of documents to skip

    // Add sorting by creation date, newest first
    pipeline.push({ $sort: { createdAt: -1 } });

    const pipelineForTotalData = [...pipeline];

    // Add pagination to the pipeline
    pipeline.push({ $skip: skipDocuments }, { $limit: propertiesPerPage });

    // console.log(pipeline);

    const propertiesTotal = await Properties.aggregate(pipelineForTotalData);
    const properties = await Properties.aggregate(pipeline);

    const propertyPromises = properties.map(async (propertyData) => {
      let property = await Properties.findById(propertyData._id); // Retrieve the full Mongoose document
      if (property) {
        property.viewedCount++;
        return property.save(); // Now .save() is available
      }
    });

    await Promise.all(propertyPromises);

    res.status(200).json({
      message: "Fetched featured properties successfully",
      success: true,
      body: properties,
      page: page,
      totalPages: Math.floor(propertiesTotal.length / 8) + 1,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getFeaturedProperty",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getMostViewedProperties = async (req, res) => {
  try {
    const body = JSON.parse(req.params.key); // Parsing the key from params which should be a JSON string
    const { coordinates, propertyType, beds, area, price, page } = body;
    const matchQuery = { viewedCount: { $gte: 5 } }; // Using viewedCount greater than or equal to 20

    // console.log("body: ", body);
    // Adding dynamic filters based on the request body
    if (propertyType && propertyType.length > 0)
      matchQuery.propertyType = { $in: propertyType };
    if (area && area.length === 2) {
      if (area[0] !== "0") {
        matchQuery.area = { $gte: parseFloat(area[0]) };
      }
      if (area[1] !== "ANY") {
        matchQuery.area = { ...matchQuery.area, $lte: parseFloat(area[1]) };
      }
    }

    if (price && price.length === 2) {
      if (price[0] !== "0") {
        matchQuery.price = { $gte: parseFloat(price[0]) };
      }
      if (price[1] !== "ANY") {
        matchQuery.price = { ...matchQuery.price, $lte: parseFloat(price[1]) };
      }
    }

    const pipeline = [];

    const propertiesPerPage = 8;
    const skipDocuments = (page - 1) * propertiesPerPage; // Calculate number of documents to skip

    // If coordinates are provided and they are not empty
    if (coordinates && coordinates.length === 2) {
      pipeline.push({
        $geoNear: {
          near: { type: "Point", coordinates: coordinates.map(Number) },
          distanceField: "distance",
          maxDistance: 300000, // 3 kilometers in meters
          spherical: true,
        },
      });
    }

    pipeline.push({ $match: matchQuery });

    // Lookup to join with the PropertyAmenities collection
    pipeline.push({
      $lookup: {
        from: "property_amenities",
        localField: "amenitiesID",
        foreignField: "_id",
        as: "amenities",
      },
    });

    // Unwind the result to deconstruct the amenities array
    pipeline.push({
      $unwind: {
        path: "$amenities",
        includeArrayIndex: "string",
        preserveNullAndEmptyArrays: false,
      },
    });

    // Adding dynamic filter for beds if specified
    if (beds && beds.length > 0) {
      pipeline.push({
        $match: {
          "amenities.roomDetails.inputs.beds": { $in: beds.map(Number) },
        },
      });
    }

    // Add sorting by creation date, newest first
    pipeline.push({ $sort: { viewedCount: -1 } });

    const pipelineForTotalData = [...pipeline];

    // Add pagination to the pipeline
    pipeline.push({ $skip: skipDocuments }, { $limit: propertiesPerPage });

    const propertiesTotal = await Properties.aggregate(pipelineForTotalData);
    const properties = await Properties.aggregate(pipeline);

    const propertyPromises = properties.map(async (propertyData) => {
      let property = await Properties.findById(propertyData._id); // Retrieve the full Mongoose document
      if (property) {
        property.viewedCount++;
        return property.save(); // Now .save() is available
      }
    });

    const allProperties = await Promise.all(propertyPromises);

    res.status(200).json({
      message: "Fetched properties with high view counts successfully",
      success: true,
      body: properties,
      page: page,
      totalPages: Math.floor(propertiesTotal.length / 8) + 1,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getMostViewedProperties",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getRecentlyAddedProperties = async (req, res) => {
  try {
    const body = JSON.parse(req.params.key);
    const { coordinates, propertyType, beds, area, price, page } = body;

    // Calculate the date 5 days ago
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 60);

    // Match query to find properties added within the last 5 days
    const matchQuery = {
      createdAt: { $gte: fiveDaysAgo },
    };

    // console.log("body: ", body);
    // Adding dynamic filters based on the request body
    if (propertyType && propertyType.length > 0)
      matchQuery.propertyType = { $in: propertyType };
    if (area && area.length === 2) {
      if (area[0] !== "0") {
        matchQuery.area = { $gte: parseFloat(area[0]) };
      }
      if (area[1] !== "ANY") {
        matchQuery.area = { ...matchQuery.area, $lte: parseFloat(area[1]) };
      }
    }

    if (price && price.length === 2) {
      if (price[0] !== "0") {
        matchQuery.price = { $gte: parseFloat(price[0]) };
      }
      if (price[1] !== "ANY") {
        matchQuery.price = { ...matchQuery.price, $lte: parseFloat(price[1]) };
      }
    }

    const propertiesPerPage = 8;
    const skipDocuments = (page - 1) * propertiesPerPage; // Calculate number of documents to skip

    const pipeline = [];

    // If coordinates are provided and they are not empty
    if (coordinates && coordinates.length === 2) {
      pipeline.push({
        $geoNear: {
          near: { type: "Point", coordinates: coordinates.map(Number) },
          distanceField: "distance",
          maxDistance: 300000, // 300 kilometers in meters
          spherical: true,
        },
      });
    }

    pipeline.push({ $match: matchQuery });

    // Lookup to join with the PropertyAmenities collection
    pipeline.push({
      $lookup: {
        from: "property_amenities",
        localField: "amenitiesID",
        foreignField: "_id",
        as: "amenities",
      },
    });

    // Unwind the result to deconstruct the amenities array
    pipeline.push({
      $unwind: {
        path: "$amenities",
        includeArrayIndex: "string",
        preserveNullAndEmptyArrays: false,
      },
    });

    // Adding dynamic filter for beds if specified
    if (beds && beds.length > 0) {
      pipeline.push({
        $match: {
          "amenities.roomDetails.inputs.beds": { $in: beds.map(Number) },
        },
      });
    }

    // Add sorting by creation date, newest first
    pipeline.push({ $sort: { createdAt: -1 } });

    const pipelineForTotalData = [...pipeline];
    // Add pagination to the pipeline
    pipeline.push({ $skip: skipDocuments }, { $limit: propertiesPerPage });

    const propertiesTotal = await Properties.aggregate(pipelineForTotalData);
    const properties = await Properties.aggregate(pipeline);

    const propertyPromises = properties.map(async (propertyData) => {
      let property = await Properties.findById(propertyData._id); // Retrieve the full Mongoose document
      if (property) {
        property.viewedCount++;
        return property.save(); // Now .save() is available
      }
    });

    await Promise.all(propertyPromises);

    res.status(200).json({
      message: "Fetched recently added properties successfully",
      success: true,
      body: properties,
      page: page,
      totalPages: Math.floor(propertiesTotal.length / 8) + 1,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getRecentlyAddedProperties",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getPropertiesByType = async (req, res) => {
  try {
    // console.log(JSON.parse(req.params.key));
    const { propertyType } = JSON.parse(req.params.key);

    const matchQuery = {};

    if (propertyType && propertyType.length > 0)
      matchQuery.propertyType = { $in: propertyType };

    const pipeline = [];
    pipeline.push({ $match: matchQuery });

    const properties = await Properties.aggregate(pipeline);

    const coordinates = [];

    properties.map((property) => {
      coordinates.push({
        coordinates: property.location.coordinates,
        propertyID: property.propertyID,
      });
    });

    res.status(200).json({
      message: "Fetched coordinates successfully",
      success: true,
      body: coordinates,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getPropertiesByType",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getPropertiesByAvailableShares = async (req, res) => {
  try {
    // console.log(JSON.parse(req.params.key));
    const { availableShares } = JSON.parse(req.params.key);

    let matchQuery = {};

    if (availableShares && availableShares.length > 0) {
      if (availableShares.includes("Fully Available")) {
        matchQuery.stakesOccupied = { $gte: 0, $lt: 3 };
      } else if (availableShares.includes("Partially Available")) {
        matchQuery = {
          $expr: {
            $and: [
              { $gt: ["$stakesOccupied", 0] },
              { $lt: ["$stakesOccupied", "$totalStakes"] },
            ],
          },
        };
      } else if (availableShares.includes("Sold")) {
        matchQuery.stakesOccupied = { $eq: "$totalStakes" };
      }
    }
    const properties = await Properties.aggregate([{ $match: matchQuery }]);

    const coordinates = [];

    properties.map((property) => {
      coordinates.push({
        coordinates: property.location.coordinates,
        propertyID: property.propertyID,
      });
    });

    res.status(200).json({
      message: "Fetched coordinates successfully",
      success: true,
      body: coordinates,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getPropertiesByAvailableShares",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getPropertyByID = async (req, res) => {
  try {
    const { key } = req.params;

    const propertyFound = await Properties.findOne({ propertyID: key })
      .populate("amenitiesID")
      .exec();

    if (!propertyFound) {
      return res.status(400).json({ message: "Try Again", success: false });
    }

    res.status(200).json({
      message: "Fetch property data",
      body: propertyFound,
      success: true,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getPropertyByID",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

module.exports = {
  addPropertyRequest,
  fetchCoordinatesOfRequestes,
  addNewProperty,
  getPropertyByUsername,
  updateProperty,
  addPropertyImages,
  deleteAllImages,
  getFeaturedProperty,
  getMostViewedProperties,
  getRecentlyAddedProperties,
  getPropertiesByType,
  getPropertiesByAvailableShares,
  getPropertyByID,
};
