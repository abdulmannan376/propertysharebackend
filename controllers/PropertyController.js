const PropertyRequest = require("../models/PropertyRequestSchema");
const PropertyListing = require("../models/PropertySchema");
const PropertyAmenities = require("../models/AmenitiesSchema");
const PropertyShare = require("../models/PropertyShareSchema");
const PropertyInspection = require("../models/PropertyInspectionSchema");
const JWTController = require("../helpers/jwtController");
const { sendEmail } = require("../helpers/emailController");
const Properties = require("../models/PropertySchema");
const { default: slugify } = require("slugify");
const fs = require("fs");
const fsPromises = require("fs/promises"); // Use promises version for async operations
const path = require("path");
const { match } = require("assert");
const compCities = require("countrycitystatejson");
const Shareholders = require("../models/ShareholderSchema");
const Users = require("../models/UserSchema");
const { sendUpdateNotification } = require("./notificationController");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

const addPropertyRequest = async (req, res) => {
  try {
    const body = req.body;

    const propertyLocation = {
      type: "Point",
      coordinates: [body.long, body.lat],
    };

    let areaRange = [];

    if (body.areaRange[1] === "ANY") {
      areaRange = [body.areaRange[0], "1000000"];
    } else {
      areaRange = body.areaRange;
    }

    let priceRange = [];

    if (body.priceRange[1] === "ANY") {
      priceRange = [body.priceRange[0], "10000000"];
    } else {
      priceRange = body.priceRange;
    }

    const newPropertyRequest = new PropertyRequest({
      location: propertyLocation,
      personDetails: {
        name: body.name,
        email: body.email,
        contact: body.contact,
      },
      requirementDetails: {
        propertyType: body.propertyType,
        areaRange: areaRange,
        priceRange: priceRange,
      },
    });

    await newPropertyRequest.save().then(() => {
      const recipient = body.email;
      const subject = "New Property Request at Beach Bunny House";
      const emailBody = `Dear ${body.name}, \nYour request has been successfully submitted into our system any property according to your requirement will be infromed to you by our email. \nRegards \nBeach Bunny House.`;

      sendEmail(recipient, subject, emailBody);

      const adminEmailBody = `Dear Admin, \nNew Property request marker has been added. \nName: ${
        body.name
      }\nEmail: ${body.email}\nContact: ${
        body.contact ? body.contact : "no contact added"
      }. \nRegards \nBeach Bunny House.`;

      sendEmail(process.env.ADMIN_EMAIL, subject, adminEmailBody);
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
      { notifyCount: { $lt: 2 } },
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

const testRun = async (req, res) => {
  const { propertyID, propertyType, area, price } = req.body;
  findNearbyMarkers(propertyID, propertyType, area, price);
  // const result = await openInspections();
  res.status(200).json({ message: true });
};

async function findNearbyMarkers(propertyID, propertyType, area, price) {
  const propertyFound = await Properties.findOne({ propertyID: propertyID });

  const pipeline = [];

  const matchQuery = {
    "requirementDetails.propertyType": { $in: ["All", propertyType] },
  };

  if (area) {
    matchQuery["requirementDetails.areaRange.0"] = { $lte: parseInt(area) };
    matchQuery["requirementDetails.areaRange.1"] = { $gte: parseInt(area) };
  }

  if (price) {
    matchQuery["requirementDetails.priceRange.0"] = { $lte: parseInt(price) };
    matchQuery["requirementDetails.priceRange.1"] = { $gte: parseInt(price) };
  }

  pipeline.push({
    $geoNear: {
      near: {
        type: "Point",
        coordinates: propertyFound.location.coordinates.map(Number),
      },
      distanceField: "distance",
      maxDistance: 200000, // 10000 kilometers in meters
      spherical: true,
      query: matchQuery,
    },
  });

  pipeline.push({ $match: matchQuery });

  const nearbyMarkers = await PropertyRequest.aggregate(pipeline);

  console.log("nearbyMarkers: ", nearbyMarkers);
  const nearbyMarkersListPromises = nearbyMarkers.filter((marker) => {
    if (marker.notifyCount < 2) {
      const notifyMarker = PropertyRequest.findOne({
        requestID: marker.requestID,
      });

      return notifyMarker;
    }
  });

  const nearbyMarkersList = await Promise.all(nearbyMarkersListPromises);

  console.log("nearbyMarkersList: ", nearbyMarkersList);
  if (nearbyMarkersList.length > 0) {
    const notifiedMarkers = nearbyMarkersList.map(async (marker) => {
      const subject = `Property Request update`;
      const body = `Dear ${
        marker.personDetails.name
      }, \nIt is to update you, a property is added in your interested location:\nState/Province: ${
        propertyFound.addressOfProperty.state
      }\nCountry: ${
        compCities.getCountryByShort(propertyFound.addressOfProperty.country)
          .name
      } \n title: ${propertyFound.title}. \nRegards, \nBeach Bunny House.`;

      sendEmail(marker.personDetails.email, subject, body);

      const notifiedMarker = await PropertyRequest.findOne({
        requestID: marker.requestID,
      });

      notifiedMarker.notifyCount += 1;
      return notifiedMarker.save();
    });
    await Promise.all(notifiedMarkers);
  }
}

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
    } else if (listingStatus !== "draft" && listingStatus !== "live") {
      listingStatus = "draft";
    }

    let propertyAmenitiesFound;

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
      findNearbyMarkers(
        propertyFound.propertyID,
        propertyFound.propertyType,
        propertyFound.area,
        propertyFound.valuePerShare
      );
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

    const startDate = new Date(body.startDate);
    if (startDate.getDay() !== 6) {
      const dateDiff = 6 - startDate.getDay();
      const newDate = startDate.getDate() + dateDiff;
      startDate.setDate(newDate);
    }

    console.log(startDate);

    const newProperty = new PropertyListing({
      title: body.title,
      slug: slug,
      location: {
        type: "Point",
        coordinates: [body.coordinates.long, body.coordinates.lat],
      },
      detail: body.overview,
      totalStakes: parseInt(body.numOfShares) + 1,
      valueOfProperty: body.totalPrice,
      area: body.areaSize,
      startDurationFrom: startDate,
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
      valuePerShare: Math.round(body.totalPrice / body.numOfShares),
      publishedBy: body.username,
      publisherRole: body.userRole,
      amenitiesID: newAmenities._id,
    });

    await newAmenities.save();
    await newProperty.save();
    const startDurationFrom = startDate;
    const shareDocIDList = [];

    for (let i = 0; i <= body.numOfShares; i++) {
      const startAt = i * 14;
      const endAt = startAt + 13;

      const startDateOfShare = new Date(startDurationFrom);
      startDateOfShare.setDate(startDurationFrom.getDate() + startAt);
      const endDate = new Date(startDurationFrom);
      endDate.setDate(startDurationFrom.getDate() + endAt);

      console.log(
        "startDateOfShare: ",
        startDateOfShare,
        "\n",
        "endDate",
        endDate
      );

      let shareIndex;
      if (i >= 0 && i <= 9) {
        shareIndex = `0${i}`;
      } else {
        shareIndex = i;
      }

      // console.log("start Date: ", startDateOfShare, "end date: ", endDate);
      const newPropertyShare = new PropertyShare({
        availableInDuration: {
          startDate: startDateOfShare,
          startDateString: startDateOfShare.toISOString().split("T")[0],
          endDate: endDate,
          endDateString: endDate.toISOString().split("T")[0],
        },
        propertyDocID: newProperty._id,
        shareID: `${newProperty.propertyID}${shareIndex}`,
      });
      // console.log("1");
      await newPropertyShare.save();
      shareDocIDList.push(newPropertyShare._id);
    }

    // console.log("2");-

    if (body.userRole === "user") {
      const userFound = await Users.findOne({ username: body.username });

      const propertyShareFound = await PropertyShare.findOne({
        shareID: `${newProperty.propertyID}00`,
      });

      // console.log("shareDocID: ", propertyShareFound._id);

      const shareDocIDList = [];
      shareDocIDList.push({ shareDocID: propertyShareFound._id });

      const newShareholder = new Shareholders({
        userID: userFound._id,
        username: body.username,
        purchasedShareIDList: shareDocIDList,
      });

      userFound.role = "shareholder";
      await userFound.save();

      await newShareholder.save();
      propertyShareFound.currentBoughtAt = newProperty.valuePerShare;
      propertyShareFound.utilisedStatus = "Purchased";
      propertyShareFound.currentOwnerDocID = newShareholder._id;

      newProperty.stakesOccupied += 1;

      propertyShareFound.save();
    } else {
      const shareholderFound = await Shareholders.findOne({
        username: body.username,
      });

      const propertyShareFound = await PropertyShare.findOne({
        shareID: `${newProperty.propertyID}00`,
      })
        .populate("propertyDocID")
        .exec();

      propertyShareFound.currentBoughtAt = newProperty.valuePerShare;
      propertyShareFound.utilisedStatus = "Purchased";
      propertyShareFound.currentOwnerDocID = shareholderFound._id;

      await propertyShareFound.save();

      const shareDocIDList = [...shareholderFound.purchasedShareIDList];
      shareDocIDList.push({ shareDocID: propertyShareFound._id });
      shareholderFound.purchasedShareIDList = shareDocIDList;

      await shareholderFound.save();

      newProperty.stakesOccupied += 1;
    }

    newProperty.shareDocIDList = shareDocIDList;

    findNearbyMarkers(
      newProperty.propertyID,
      newProperty.propertyType,
      newProperty.area,
      newProperty.valuePerShare
    );

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

const deletePropertyData = async () => {
  try {
    const { propertyID } = req.body;

    const propertyFound = await Properties.findOne({ propertyID: propertyID });
    if (!propertyFound) {
      throw new Error("property not found");
    }

    const propertySharesPromises = propertyFound.shareDocIDList.map(
      (shareDocID) => {
        const shareFound = PropertyShare.findOne({ _id: shareDocID });
      }
    );

    const propertyShares = await Promise.all(propertySharesPromises);
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
  // console.log(directory, deleteIndices);
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

async function openInspections() {
  try {
    const today = new Date(); // Get the current date and time
    const twoDaysLater = new Date(today); // Copy today's date to a new variable
    twoDaysLater.setDate(twoDaysLater.getDate() + 30); // Add two days

    // Format dates to ignore the time component, if necessary
    today.setHours(0, 0, 0, 0); // Set time to 00:00:00.000
    twoDaysLater.setHours(23, 59, 59, 999); // Set time to the end of the day

    const pipeline = [
      {
        $match: {
          "availableInDuration.endDate": {
            $gte: today, // Greater than or equal to the start of today
            $lte: twoDaysLater, // Less than or equal to the end of the day two days later
          },
          utilisedStatus: "Purchased",
        },
      },
    ];

    const propertyShares = await PropertyShare.aggregate(pipeline);

    const newInspections = [];

    for (const share of propertyShares) {
      if (!share.currentInspectionDocID) {
        try {
          const propertyShare = await PropertyShare.findOne({
            shareID: share.shareID,
          }).populate("currentOwnerDocID", "username");

          if (propertyShare) {
            // Create a new inspection
            const newInspection = new PropertyInspection({
              propertyDocID: propertyShare.propertyDocID,
              shareDocID: propertyShare._id,
              shareholderDocID: propertyShare.currentOwnerDocID,
            });
            await newInspection.save(); // Save the inspection first

            // Update the property share with new inspection details
            propertyShare.currentInspectionDocID = newInspection._id;
            propertyShare.inspectionIDList.push(newInspection._id);

            await propertyShare.save(); // Save the property share
            newInspections.push(propertyShare); // Collect the saved shares for any further processing
          }
        } catch (error) {
          console.error("Error processing property share:", error);
        }
      }
    }

    for (const share of newInspections) {
      const user = await Users.findOne({
        username: share.currentOwnerDocID.username,
      }).populate("userDefaultSettingID", "notifyUpdates");

      const subject = `Share Inspection Status`;
      const body = `Dear ${user.name}, \nYour Share duration inspection is started, and is pending for submission. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        user.userDefaultSettingID.notifyUpdates,
        user.username
      );
    }
    return propertyShares;
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "openInspections",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
  }
}

const fetchShareInspectionByUsername = async (req, res) => {
  try {
    const { username, action } = req.params;

    const shareholderFound = await Shareholders.findOne({ username: username });
    if (!shareholderFound) {
      throw new Error("shareholder not found.");
    }

    if (action === "my") {
      const myInspections = await PropertyInspection.find({
        shareholderDocID: shareholderFound._id,
      })
        .populate({
          path: "propertyDocID",
          model: "properties",
          select:
            "propertyID imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
          populate: {
            path: "amenitiesID",
            model: "property_amenities",
            select: "roomDetails",
          },
        })
        .populate("shareDocID", "availableInDuration shareID");

      return res
        .status(200)
        .json({ message: "Fetched", success: true, body: myInspections });
    } else if (action === "all") {
      const sharesByUsernamePromises =
        shareholderFound.purchasedShareIDList.map((share) => {
          const shareDetail = PropertyShare.findOne(share.shareDocID)
            .populate("propertyDocID", "propertyID")
            .exec();
          console.log("shareDetail: ", shareDetail);
          return shareDetail;
        });

      const sharesByUsername = await Promise.all(sharesByUsernamePromises);

      // Assuming sharesByUsername is an array of share objects
      const sharesPerProperty = sharesByUsername.reduce((acc, share) => {
        // console.log("acc: ", acc);
        const propertyID = share.propertyDocID.propertyID;

        acc[propertyID] = {
          propertyID: propertyID,
          propertyDetails: share.propertyDocID,
        };
        return acc;
      }, {});

      // To convert the object back into an array if needed:
      const shareholderPropertyList = Object.values(sharesPerProperty);

      console.log(shareholderPropertyList);

      const inspectionsList = [];

      for (const property of shareholderPropertyList) {
        const inspection = await PropertyInspection.findOne({
          propertyDocID: property.propertyDetails._id,
        })
          .populate({
            path: "propertyDocID",
            model: "properties",
            select:
              "propertyID imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
            populate: {
              path: "amenitiesID",
              model: "property_amenities",
              select: "roomDetails",
            },
          })
          .populate("shareDocID", "availableInDuration shareID");

        if (inspection) {
          inspectionsList.push(inspection);
        }
      }

      return res
        .status(200)
        .json({ message: "Fetched", success: true, body: inspectionsList });
    } else {
      return res
        .status(403)
        .json({ message: "Forbidden or invalid action", success: true });
    }
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "fetchShareInspectionByUsername",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const handleInspectionSubmission = async (req, res) => {
  try {
    const body = req.body;
    const files = req.files;

    console.log(body);

    const userFound = await Users.findOne({ username: body.username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );

    const inspectionFound = await PropertyInspection.findOne({
      inspectionID: body.inspectionID,
    });
    if (!inspectionFound) {
      throw new Error("inspection not found.");
    }

    const uploadPath = `uploads/Inspections/${body.propertyID}/${body.shareID}/${inspectionFound.inspectionID}`;

    // Update property with new information
    inspectionFound.imageDirURL = uploadPath;
    inspectionFound.imageCount = fs
      .readdirSync(uploadPath)
      .filter((file) => file.startsWith("image-")).length;

    inspectionFound.commentsByShareholder = body.comment;
    inspectionFound.status = "In Progress";
    await inspectionFound.save();

    const subject = `Inspection for property (${body.propertyTitle})`;
    const emailBody = `Hello ${body.userName},\nYour inspection is submitted and will be reviewed by other shareholders. Once it passes 80% successfull vote your inspection closes successfully.\nRegards,\nBunny Beach House.`;

    sendUpdateNotification(
      subject,
      emailBody,
      userFound.userDefaultSettingID.notifyUpdates,
      body.username
    );

    res.status(200).json({
      message: "Inspection images updated successfully.",
      success: true,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleInspectionSubmission",
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
    const {
      coordinates,
      propertyType,
      beds,
      area,
      priceRange,
      page,
      category,
    } = body;
    const matchQuery = { status: "Featured" }; // Default match query

    if (category && category === "rent") {
      matchQuery.stakesOnRent = { $gt: 0 };
    }
    // Adding dynamic filters based on the request body
    if (propertyType && propertyType.length > 0)
      matchQuery.propertyType = { $in: propertyType };
    if (area && area.length === 2) {
      if (area[0] !== "0") {
        matchQuery.area = { $gte: parseFloat(area[0]) };
      } else {
        matchQuery.area = { $gte: parseFloat("0") };
      }
      if (area[1] !== "ANY") {
        matchQuery.area = { ...matchQuery.area, $lte: parseFloat(area[1]) };
      }
    }

    if (priceRange && priceRange.length === 2) {
      if (priceRange[0] !== "0") {
        matchQuery.valuePerShare = { $gte: parseFloat(priceRange[0]) };
      } else {
        matchQuery.valuePerShare = { $gte: parseFloat("0") };
      }
      if (priceRange[1] !== "ANY") {
        matchQuery.valuePerShare = {
          ...matchQuery.valuePerShare,
          $lte: parseFloat(priceRange[1]),
        };
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
    const {
      coordinates,
      propertyType,
      beds,
      area,
      priceRange,
      page,
      category,
    } = body;
    const matchQuery = { viewedCount: { $gte: 5 } }; // Using viewedCount greater than or equal to 20

    if (category && category === "rent") {
      matchQuery.stakesOnRent = { $gt: 0 };
    }

    // console.log("body: ", body);
    // Adding dynamic filters based on the request body
    if (propertyType && propertyType.length > 0)
      matchQuery.propertyType = { $in: propertyType };
    if (area && area.length === 2) {
      if (area[0] !== "0") {
        matchQuery.area = { $gte: parseFloat(area[0]) };
      } else {
        matchQuery.area = { $gte: parseFloat("0") };
      }
      if (area[1] !== "ANY") {
        matchQuery.area = { ...matchQuery.area, $lte: parseFloat(area[1]) };
      }
    }

    if (priceRange && priceRange.length === 2) {
      if (priceRange[0] !== "0") {
        matchQuery.valuePerShare = { $gte: parseFloat(priceRange[0]) };
      } else {
        matchQuery.valuePerShare = { $gte: parseFloat("0") };
      }
      if (priceRange[1] !== "ANY") {
        matchQuery.valuePerShare = {
          ...matchQuery.valuePerShare,
          $lte: parseFloat(priceRange[1]),
        };
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
    const {
      coordinates,
      propertyType,
      beds,
      area,
      priceRange,
      page,
      category,
    } = body;

    // Calculate the date 5 days ago
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 60);

    // Match query to find properties added within the last 5 days
    const matchQuery = {
      createdAt: { $gte: fiveDaysAgo },
    };

    if (category && category === "rent") {
      matchQuery.stakesOnRent = { $gt: 0 };
    }

    // console.log("body: ", body);
    // Adding dynamic filters based on the request body
    if (propertyType && propertyType.length > 0)
      matchQuery.propertyType = { $in: propertyType };
    if (area && area.length === 2) {
      if (area[0] !== "0") {
        matchQuery.area = { $gte: parseFloat(area[0]) };
      } else {
        matchQuery.area = { $gte: parseFloat("0") };
      }
      if (area[1] !== "ANY") {
        matchQuery.area = { ...matchQuery.area, $lte: parseFloat(area[1]) };
      }
    }

    if (priceRange && priceRange.length === 2) {
      if (priceRange[0] !== "0") {
        matchQuery.valuePerShare = { $gte: parseFloat(priceRange[0]) };
      } else {
        matchQuery.valuePerShare = { $gte: parseFloat("0") };
      }
      if (priceRange[1] !== "ANY") {
        matchQuery.valuePerShare = {
          ...matchQuery.valuePerShare,
          $lte: parseFloat(priceRange[1]),
        };
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
  testRun,
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
  fetchShareInspectionByUsername,
  handleInspectionSubmission,
};
