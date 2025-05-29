const PropertyRequest = require("../models/PropertyRequestSchema");
const PropertyListing = require("../models/PropertySchema");
const PropertyAmenities = require("../models/AmenitiesSchema");
const PropertyShare = require("../models/PropertyShareSchema");
const PropertyInspection = require("../models/PropertyInspectionSchema");
const RaiseRequest = require("../models/RaiseRequestSchema");
const JWTController = require("../helpers/jwtController");
const { sendEmail } = require("../helpers/emailController");
const Properties = require("../models/PropertySchema");
const { default: slugify } = require("slugify");
const fs = require("fs");
const fsPromises = require("fs/promises"); // Use promises version for async operations
const path = require("path");
const sharp = require("sharp");
const { match } = require("assert");
const compCities = require("countrycitystatejson");
const Shareholders = require("../models/ShareholderSchema");
const Users = require("../models/UserSchema");
const { sendUpdateNotification } = require("./notificationController");
const { model } = require("mongoose");
const Payments = require("../models/PaymentSchema");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

const addPropertyRequest = async (req, res) => {
  try {
    const body = req.body;

    const propertyLocation = {
      type: "Point",
      coordinates: [body.long, body.lat],
    };

    console.log(body);

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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const testRun = async (req, res) => {
  const { propertyID, propertyType, area, price, category } = req.body;
  // findNearbyMarkers(propertyID, propertyType, area, price);
  // const result = await notifyPropertyShareOwnerByPropertyID(
  //   propertyID,
  //   category
  // );

  // openInspections();
  calPropertyDurationCompletion();
  res.status(200).json({ message: true, body: "" });
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
      publisherRole: body.userRole === "user" ? "shareholder" : body.userRole,
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
        publishedByUser: body.username,
      });
      // console.log("1");
      await newPropertyShare.save();
      shareDocIDList.push(newPropertyShare._id);
    }

    // console.log("2");-

    const shareholderFound = await Shareholders.findOne({
      username: body.username,
    });

    if (!shareholderFound) {
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const getPendingApprovalProperties = async (req, res) => {
  try {
    // Authorization header should be checked if it exists
    if (!req.headers.authorization) {
      return res.status(401).json({
        message: "No authorization token provided.",
        success: false,
      });
    }

    const token = req.headers.authorization.split(" ")[1];

    if (token.length === 0) {
      return res.status(401).json({
        message: "No authorization token provided.",
        success: false,
      });
    }
    const isTokenValid = await JWTController.verifyJWT(token);
    if (!isTokenValid) {
      return res.status(404).json({
        message: "Session expired.",
        success: false,
        action: "login",
      });
    }

    const { username } = req.params;

    const userFound = await Users.findOne({ username: username }, "role");
    if (!userFound && userFound.role !== "admin") {
      return res.status(401).json({
        message: "Not Authorized",
        success: false,
      });
    }
    const pipeline = [];

    pipeline.push({
      $match: {
        listingStatus: "pending approval",
      },
    });

    pipeline.push({
      $sort: { createdAt: -1 },
    });
    const propertyList = await Properties.aggregate(pipeline);

    res
      .status(200)
      .json({ message: "Fetched", success: true, body: propertyList });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getPendingApprovals",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const handlePropertyAction = async (req, res) => {
  try {
    const { action, comment, username, propertyID } = req.body;

    const propertyFound = await Properties.findOne({ propertyID: propertyID });
    if (!propertyFound) {
      throw new Error("property not found");
    }
    const publisherFound = await Users.findOne({
      username: propertyFound.publishedBy,
    }).populate("userDefaultSettingID", "notifyUpdates");

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );

    if (action === "approved") {
      await Properties.updateOne(
        { _id: propertyFound._id },
        {
          $set: {
            listingStatus: "live",
            approvedBy: username,
          },
        }
      );

      const publisherSubject = `Property (${propertyFound.title}) listing status`;
      const publisherBody = `Dear ${publisherFound.name}, \nYour property ${propertyFound.title} has been approved by our team and is live on beachbunnyhouse.com. \n Click the link below to Check:\n https://www.beachbunnyhouse.com/buy-shares/property/${propertyFound?.propertyID} \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        publisherSubject,
        publisherBody,
        publisherFound.userDefaultSettingID.notifyUpdates,
        publisherFound.username
      );

      const subject = `Property (${propertyFound.title}) listing status`;
      const body = `Dear ${userFound.name}, \nYou approved property ${propertyFound.title} and is now live on. \n Click the link below to Check:\n https://www.beachbunnyhouse.com/buy-shares/property/${propertyFound?.propertyID} \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        userFound.userDefaultSettingID.notifyUpdates,
        userFound.username
      );

      return res.status(200).json({ message: "Status Updated", success: true });
    } else if (action === "rejected") {
      await Properties.updateOne(
        { _id: propertyFound._id },
        {
          $set: {
            listingStatus: "rejected",
            rejectedBy: username,
          },
        }
      );

      const publisherSubject = `Property (${propertyFound.title}) listing status`;
      const publisherBody = `Dear ${publisherFound.name}, \nYour property ${propertyFound.title} has been rejected by our team. \nComments: ${comment} \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        publisherSubject,
        publisherBody,
        publisherFound.userDefaultSettingID.notifyUpdates,
        publisherFound.username
      );

      const subject = `Property (${propertyFound.title}) listing status`;
      const body = `Dear ${userFound.name}, \nYou rejected property ${propertyFound.title}. \nComments: ${comment} \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        userFound.userDefaultSettingID.notifyUpdates,
        userFound.username
      );
      return res.status(200).json({ message: "Status Updated", success: true });
    } else {
      return res
        .status(200)
        .json({ message: "Forbidden or No action provided", success: false });
    }
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "handlePropertyAction",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};
// function reorganizeFiles(directory, deleteIndices = []) {
//   // console.log(directory, deleteIndices);
//   const files = fs
//     .readdirSync(directory)
//     .filter((file) => file.startsWith("image-"));
//   // Delete files as per indices provided
//   deleteIndices.sort((a, b) => b - a); // Sort indices in descending order for deletion
//   deleteIndices.forEach((index) => {
//     const filePath = path.join(directory, files[parseInt(index) - 1]);
//     if (fs.existsSync(filePath)) {
//       fs.unlinkSync(filePath);
//     }
//   });
//   // Rename remaining files to maintain sequence
//   const remainingFiles = fs
//     .readdirSync(directory)
//     .filter((file) => file.startsWith("image-"));
//   remainingFiles.forEach((file, index) => {
//     const newFileName = `image-${index + 1}${path.extname(file)}`;
//     const oldFilePath = path.join(directory, file);
//     const newFilePath = path.join(directory, newFileName);
//     fs.renameSync(oldFilePath, newFilePath);
//   });
// }

// Function to reorganize files in the directory
function reorganizeFiles(directory, deleteIndices = []) {
  console.log("▶️ [reorganizeFiles] directory:", directory);
  console.log("▶️ [reorganizeFiles] deleteIndices (raw):", deleteIndices);

  // 1) Read all image files
  let files;
  try {
    files = fs.readdirSync(directory).filter((f) => f.startsWith("image-"));
  } catch (err) {
    console.error(
      `❌ [reorganizeFiles] cannot read directory ${directory}:`,
      err
    );
    return;
  }
  console.log("▶️ [reorganizeFiles] found files:", files);

  if (files.length === 0) {
    console.warn("⚠️ [reorganizeFiles] no image-* files to process—exiting.");
    return;
  }

  // 2) Normalize & filter indices into valid 1..files.length
  const valid = Array.from(
    new Set(
      deleteIndices
        .map((i) => {
          const n = Number(i);
          return Number.isInteger(n) ? n : null;
        })
        .filter((n) => n !== null && n >= 1 && n <= files.length)
    )
  ).sort((a, b) => b - a); // descending

  console.log(
    "▶️ [reorganizeFiles] validIndices (filtered, descending):",
    valid
  );

  // 3) Delete each valid index
  valid.forEach((idx) => {
    const fileName = files[idx - 1];
    if (!fileName) {
      console.warn(
        `⚠️ [reorganizeFiles] files[${
          idx - 1
        }] is undefined—skipping index ${idx}`
      );
      return;
    }
    const filePath = path.join(directory, fileName);
    console.log(`  ➡️ Deleting index ${idx}:`, { fileName, filePath });

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`    ✔️ Deleted ${fileName}`);
    } else {
      console.warn(`    ⚠️ File does not exist: ${filePath}`);
    }
  });

  // 4) Re-list & rename remaining files
  let remaining;
  try {
    remaining = fs.readdirSync(directory).filter((f) => f.startsWith("image-"));
  } catch (err) {
    console.error(
      `❌ [reorganizeFiles] cannot re-read directory ${directory}:`,
      err
    );
    return;
  }
  remaining.sort((a, b) => {
    const ai = Number(a.match(/^image-(\d+)/)?.[1]);
    const bi = Number(b.match(/^image-(\d+)/)?.[1]);
    return ai - bi;
  });

  console.log("▶️ [reorganizeFiles] remaining files before rename:", remaining);

  remaining.forEach((oldName, i) => {
    const newName = `image-${i + 1}${path.extname(oldName)}`;
    const oldPath = path.join(directory, oldName);
    const newPath = path.join(directory, newName);
    if (oldPath !== newPath) {
      console.log(`  🔄 Renaming ${oldName} → ${newName}`);
      try {
        fs.renameSync(oldPath, newPath);
      } catch (err) {
        console.error(`    ❌ Failed to rename ${oldName} → ${newName}:`, err);
      }
    }
  });

  console.log("▶️ [reorganizeFiles] done.");
}
async function openInspections() {
  try {
    console.log("openInspections cron runing");

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
          })
            .populate("currentOwnerDocID", "username")
            .populate("propertyDocID", "propertyID title availableInDuration");

          const ownerShare = await PropertyShare.findOne({
            shareID: `${propertyShare.propertyDocID.propertyID}00`,
          }).populate("currentOwnerDocID", "username");

          if (propertyShare) {
            // Create a new inspection
            const newInspection = new PropertyInspection({
              propertyDocID: propertyShare.propertyDocID,
              shareDocID: propertyShare._id,
              shareholderDocID: propertyShare.currentOwnerDocID,
              propertyOwnerDocID: ownerShare.currentOwnerDocID,
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
      const body = `Dear ${user.name}, \nYour Property Share titled "${
        share.propertyDocID?.title
      }" (Share Duration: ${share.propertyDocID.availableInDuration.startDate.toDateString()} - ${share.propertyDocID.availableInDuration.endDate.toDateString()}) has started its inspection process because the end date has been reached and the inspection is pending submission. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        user.userDefaultSettingID.notifyUpdates,
        user.username
      );

      notifyPropertyShareOwnerByPropertyID(
        share.propertyDocID.propertyID,
        "Inspection"
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
      throw new Error("No record of Inspections found.");
    }

    if (action === "my") {
      const myInspections = await PropertyInspection.find({
        shareholderDocID: shareholderFound._id,
      })
        .populate({
          path: "propertyDocID",
          model: "properties",
          select:
            "propertyID area imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
          populate: {
            path: "amenitiesID",
            model: "property_amenities",
            select: "roomDetails",
          },
        })
        .populate("shareDocID", "availableInDuration shareID")
        .populate({
          path: "shareholderDocID",
          model: "shareholders",
          select: "username userID",
          populate: {
            path: "userID",
            model: "users",
            select: "name",
          },
        });

      return res
        .status(200)
        .json({ message: "Fetched", success: true, body: myInspections });
    } else if (action === "all") {
      const sharesByUsernamePromises =
        shareholderFound.purchasedShareIDList.map((share) => {
          const shareDetail = PropertyShare.findOne(share.shareDocID)
            .populate("propertyDocID", "propertyID")
            .exec();
          // console.log("shareDetail: ", shareDetail);
          return shareDetail;
        });

      const sharesByUsername = await Promise.all(sharesByUsernamePromises);

      // Assuming sharesByUsername is an array of share objects
      const sharesPerProperty = sharesByUsername.reduce((acc, share) => {
        // console.log("acc: ", acc);
        const propertyID = share?.propertyDocID?.propertyID;

        if (propertyID)
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
              "propertyID area imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
            populate: {
              path: "amenitiesID",
              model: "property_amenities",
              select: "roomDetails",
            },
          })
          .populate("shareDocID", "availableInDuration shareID")
          .populate({
            path: "shareholderDocID",
            model: "shareholders",
            select: "username userID",
            populate: {
              path: "userID",
              model: "users",
              select: "name",
            },
          });

        if (inspection) {
          inspectionsList.push(inspection);
        }
      }

      return res
        .status(200)
        .json({ message: "Fetched", success: true, body: inspectionsList });
    } else if (action === "pending_approvals") {
      const inspectionsList = await PropertyInspection.find({
        propertyOwnerDocID: shareholderFound._id,
      })
        .populate({
          path: "propertyDocID",
          model: "properties",
          select:
            "propertyID area imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
          populate: {
            path: "amenitiesID",
            model: "property_amenities",
            select: "roomDetails",
          },
        })
        .populate("shareDocID", "availableInDuration shareID")
        .populate({
          path: "shareholderDocID",
          model: "shareholders",
          select: "username userID",
          populate: {
            path: "userID",
            model: "users",
            select: "name",
          },
        });

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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

/**
 * After multer has saved each file (named image-*.png),
 * convert the on-disk bytes to true PNG (lossless) with metadata.
 */
// async function convertFilesToPng(files) {
//   await Promise.all(
//     files.map(async (file) => {
//       const p = file.path; // e.g. uploads/.../image-3.png
//       // read/convert/write back
//       const buffer = await sharp(p)
//         .withMetadata()      // preserve EXIF, DPI, orientation
//         .toFormat("png")     // format-only change
//         .toBuffer();
//       fs.writeFileSync(p, buffer);
//     })
//   );
// }

// const handleInspectionSubmission = async (req, res) => {
//   try {
//     const {
//       username,
//       inspectionID,
//       propertyID,
//       shareID,
//       propertyTitle,
//       userName,
//       comment,
//     } = req.body;

//     // 1) Load user & inspection
//     const userFound = await Users.findOne({ username })
//       .populate("userDefaultSettingID", "notifyUpdates");
//     const inspectionFound = await PropertyInspection.findOne({ inspectionID });
//     if (!inspectionFound) throw new Error("Inspection not found.");

//     // 2) Immediately convert every newly saved file to PNG
//     await convertFilesToPng(req.files);

//     // 3) Update imageDirURL & count
//     const uploadPath = `uploads/Inspections/${propertyID}/${shareID}/${inspectionFound.inspectionID}`;
//     inspectionFound.imageDirURL = uploadPath;
//     inspectionFound.imageCount = fs
//       .readdirSync(uploadPath)
//       .filter(f => f.startsWith("image-")).length;

//     // 4) Other existing logic
//     // inspectionFound.commentsByShareholder = comment;
//     // inspectionFound.status = "In Progress";
//     await inspectionFound.save();

//     // 5) Notify
//     // const subject = `Inspection for property (${propertyTitle})`;
//     // const emailBody =
//     //   `Hello ${userName},\n` +
//     //   `Your inspection has been submitted and will be reviewed by other shareholders. ` +
//     //   `Once it passes an 80% approval vote, your inspection will close successfully.\n\n` +
//     //   `Regards,\nBunny Beach House.`;

//     // sendUpdateNotification(
//     //   subject,
//     //   emailBody,
//     //   userFound.userDefaultSettingID.notifyUpdates,
//     //   username
//     // );

//     // return res.status(200).json({
//     //   message: "Inspection images updated successfully.",
//     //   success: true,
//     // });
//   } catch (error) {
//     console.error("handleInspectionSubmission error:", error);
//     return res.status(500).json({
//       message: error.message || "Internal Server Error",
//       success: false,
//     });
//   }
// };

/**
 * Deletes all existing image-*.png (or any extension) in a folder.
 */
function clearAllImages(directory) {
  if (!fs.existsSync(directory)) return;
  fs.readdirSync(directory)
    .filter((f) => f.startsWith("image-"))
    .forEach((f) => fs.unlinkSync(path.join(directory, f)));
}

const handleInspectionSubmission = async (req, res) => {
  try {
    const {
      username,
      inspectionID,
      propertyID,
      shareID,
      propertyTitle,
      userName, // for emailBody
      comment,
    } = req.body;
    const files = req.files; // each has a .buffer

    // 1) Load user & inspection
    const userFound = await Users.findOne({ username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    const inspectionFound = await PropertyInspection.findOne({ inspectionID });
    if (!inspectionFound) throw new Error("Inspection not found.");

    // 2) Prepare folder
    const uploadPath = `uploads/Inspections/${propertyID}/${shareID}/${inspectionFound.inspectionID}`;
    fs.mkdirSync(uploadPath, { recursive: true });

    // Only clear + replace images if there are new files
    if (files && files.length > 0) {
      // clear out old images
      clearAllImages(uploadPath);

      // 3) Convert+save each new buffer → PNG with metadata preserved
      await Promise.all(
        files.map(async (file, idx) => {
          if (!file.buffer) {
            throw new Error("Missing file.buffer—check your Multer config");
          }
          const outName = `image-${idx + 1}.png`;
          const outPath = path.join(uploadPath, outName);

          await sharp(file.buffer)
            .withMetadata() // preserve EXIF, orientation, DPI
            .toFormat("png") // switch format only
            .toFile(outPath);
        })
      );
    }

    // 4) Update the inspection document
    inspectionFound.imageDirURL = uploadPath;
    inspectionFound.imageCount = fs
      .readdirSync(uploadPath)
      .filter((f) => f.startsWith("image-")).length;
    inspectionFound.commentsByShareholder = comment;
    inspectionFound.status = "In Progress";
    await inspectionFound.save();

    // 5) Send notification
    const subject = `Inspection for property (${propertyTitle})`;
    const emailBody =
      `Hello ${userName},\n` +
      `Your inspection is submitted and will be reviewed by other shareholders. ` +
      `Once it passes 80% successful vote your inspection closes successfully.\n\n` +
      `Regards,\nBunny Beach House.`;

    sendUpdateNotification(
      subject,
      emailBody,
      userFound.userDefaultSettingID.notifyUpdates,
      username
    );

    return res.status(200).json({
      message: "Inspection uploaded successfully.",
      success: true,
    });
  } catch (error) {
    console.error("handleInspectionSubmission error:", error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
      success: false,
    });
  }
};

const handleInspectionAction = async (req, res) => {
  try {
    const { inspectionID, action, username, occurence } = req.body;

    console.log(req.body);

    const inspectionFound = await PropertyInspection.findOne({
      inspectionID: inspectionID,
    })
      .populate({
        path: "shareholderDocID",
        model: "shareholders",
        select: "username userID",
        populate: {
          path: "userID",
          model: "users",
          select: "name",
        },
      })
      .populate({
        path: "propertyDocID",
        model: "properties",
        select:
          "propertyID area imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
        populate: {
          path: "amenitiesID",
          model: "property_amenities",
          select: "roomDetails",
        },
      })
      .populate("shareDocID", "availableInDuration shareID");
    if (!inspectionFound) {
      throw new Error("inspection not found");
    }

    for (let index = 0; index < occurence; index++) {
      if (action === "approved") {
        if (inspectionFound.rejectedUsersList.includes(username)) {
          const newRejectedList = inspectionFound.rejectedUsersList.filter(
            (username) => {
              return username !== username;
            }
          );
          inspectionFound.rejectedUsersList = newRejectedList;
        }
        inspectionFound.approvedByUsersList.push(username);
      } else if (action === "rejected") {
        if (inspectionFound.approvedByUsersList.includes(username)) {
          const newApprovedList = inspectionFound.approvedByUsersList.filter(
            (username) => {
              return username !== username;
            }
          );
          inspectionFound.approvedByUsersList = newApprovedList;
        }
        inspectionFound.rejectedUsersList.push(username);
      } else {
        return res
          .status(403)
          .json({ message: "Forbidden or no action provided", success: false });
      }
    }

    await inspectionFound.save().then(() => {
      res.status(200).json({
        message: "Inspection Updated.",
        success: true,
        body: inspectionFound,
      });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleInspectionAction",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const handleInspectionActionPropertyOwner = async (req, res) => {
  try {
    const { inspectionID, usernameList, username } = req.body;

    const shareholderFound = await Shareholders.findOne({
      username: username,
    }).populate({
      path: "userID",
      model: "users",
      select: "name userDefaultSettingID",
      populate: {
        path: "userDefaultSettingID",
        model: "user_default_settings",
        select: "notifyUpdates",
      },
    });
    if (!shareholderFound) {
      throw new Error("No record of Inspection found.");
    }

    const inspectionFound = await PropertyInspection.findOne({
      inspectionID: inspectionID,
      propertyOwnerDocID: shareholderFound._id,
    }).populate("propertyDocID", "title availableInDuration");
    if (!inspectionFound) {
      throw new Error("property inspection not found.");
    }

    usernameList.map((username) => {
      if (
        !inspectionFound.approvedByUsersList.includes(username) &&
        !inspectionFound.rejectedUsersList.includes(username)
      ) {
        inspectionFound.approvedByUsersList.push(username);
      }
    });

    inspectionFound.status = "Verified";

    const usersFoundPromises = await usernameList.map((username) => {
      return Users.findOne({ username: username }).populate(
        "userDefaultSettingID",
        "notifyUpdates"
      );
    });

    const usersFoundList = await Promise.all(usersFoundPromises);

    await inspectionFound.save().then(() => {
      usersFoundList.map((user) => {
        const userSubject = `Property ${inspectionFound.propertyDocID.title} Inspection status`;
        const userBody = `Dear ${user.name}, \nProperty, ${inspectionFound.propertyDocID.title}, inspection is approved by the property owner.Please go to the "Inspections" tab \n Click the link below to Check:\nhttps://www.beachbunnyhouse.com/user/${user.username} \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          userSubject,
          userBody,
          user.userDefaultSettingID.notifyUpdates,
          user.username
        );
      });

      const subject = `Property ${inspectionFound.propertyDocID.title} Inspection status`;
      const body = `Dear ${shareholderFound.userID.name}, \nProperty, ${inspectionFound.propertyDocID.title}, inspection has been approved. Please go to the "Inspections" tab \n Click the link below to Check:\nhttps://www.beachbunnyhouse.com/user/${username} \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        shareholderFound.userID.userDefaultSettingID.notifyUpdates,
        username
      );

      res.status(200).json({ message: "Inspection approved", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleInspectionActionPropertyOwner",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

async function notifyPropertyShareOwnerByPropertyID(
  propertyID,
  category,
  emailSubject,
  emailBody
) {
  const propertyFound = await Properties.findOne(
    { propertyID: propertyID },
    "shareDocIDList title"
  ).populate({
    path: "shareDocIDList",
    model: "property_shares",
    select: "currentOwnerDocID shareID availableInDuration",
    populate: {
      path: "currentOwnerDocID",
      model: "shareholders",
      select: "username userID",
      populate: {
        path: "userID",
        model: "users",
        select: "name userDefaultSettingID",
        populate: {
          path: "userDefaultSettingID",
          model: "user_default_settings",
          select: "notifyUpdates",
        },
      },
    },
  });

  const usernameList = [];
  const shareList = propertyFound.shareDocIDList.filter((share) => {
    if (!share.shareID.endsWith("00") && share.currentOwnerDocID) {
      if (!usernameList.includes(share.currentOwnerDocID.username)) {
        usernameList.push(share.currentOwnerDocID.username);
        return share;
      }
    }
  });

  shareList.map((share) => {
    // Skip if userID is null
    if (share?.currentOwnerDocID?.userID === null) {
      console.log("Skipping share with null userID:", share);
      return; // Continue to the next item
    }

    const subject =
      emailSubject || `Property ${propertyFound.title} ${category} requested`;
    const body =
      emailBody ||
      `Dear ${
        share?.currentOwnerDocID?.userID?.name
      }, It is to inform you a new ${category} is requested for property ${
        propertyFound.title
      } (Share Duration: ${share.availableInDuration.startDate.toDateString()} - ${share.availableInDuration.endDate.toDateString()}).Please go to the "Inspections" tab \n Click the link below to Check:\nhttps://www.beachbunnyhouse.com/user/${
        share.currentOwnerDocID.username
      } \nRegards, \nBeach Bunny House.`;

    sendUpdateNotification(
      subject,
      body,
      share.currentOwnerDocID.userID.userDefaultSettingID.notifyUpdates,
      share.currentOwnerDocID.username
    );
  });

  return shareList;
}

const getInspectionDetail = async (req, res) => {
  try {
    const { key } = req.params;

    const inspectionFound = await PropertyInspection.findOne({
      inspectionID: key,
    });
    if (!inspectionFound) {
      throw new Error("inspection not found");
    }

    const propertyFound = await Properties.findOne(
      {
        _id: inspectionFound.propertyDocID,
      },
      "shareDocIDList"
    ).populate({
      path: "shareDocIDList",
      model: "property_shares",
      populate: {
        path: "currentOwnerDocID",
        model: "shareholders",
        select: "username",
      },
    });

    const purchasedShareList = propertyFound.shareDocIDList.filter((share) => {
      return (
        share.utilisedStatus !== "Listed" && share.utilisedStatus !== "Reserved"
      );
    });

    res.status(200).json({
      message: "Fetched",
      success: true,
      body: { inspection: inspectionFound, sharesList: purchasedShareList },
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getInspectionDetail",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const genRaiseRequest = async (req, res) => {
  try {
    const {
      propertyID,
      username,
      title,
      details,
      price,
      type,
      URLsList,
      deleteImageList,
    } = req.body;
    const files = Array.isArray(req.files) ? req.files : []; // ← default to []

    // 1) Lookup shareholder & property (unchanged)
    const shareholderFound = await Shareholders.findOne({ username }).populate({
      path: "userID",
      model: "users",
      select: "name userDefaultSettingID",
      populate: {
        path: "userDefaultSettingID",
        model: "user_default_settings",
        select: "notifyUpdates",
      },
    });
    if (!shareholderFound) throw new Error("No record found.");

    const propertyFound = await Properties.findOne({ propertyID }).populate({
      path: "shareDocIDList",
      model: "property_shares",
      select: "shareID currentOwnerDocID",
    });
    if (!propertyFound) throw new Error("property not found.");

    const ownerShare = propertyFound.shareDocIDList.filter((s) =>
      s.shareID.endsWith("00")
    );

    // 2) Make the RaiseRequest doc
    const newRaiseRequest = new RaiseRequest({
      title,
      estimatedPrice: price,
      details,
      requestType: type,
      propertyDocID: propertyFound._id,
      shareholderDocID: shareholderFound._id,
      attachedURLsList: URLsList,
      propertyOwnerDocID: ownerShare[0].currentOwnerDocID,
    });

    // 3) Build and prepare the upload folder
    const today = new Date();
    const folderName = `${
      today.getDate() + 1
    }-${today.getMonth()}-${today.getFullYear()}`;
    const uploadPath = `uploads/RaiseRequest/${propertyID}/${folderName}/`;
    fs.mkdirSync(uploadPath, { recursive: true });

    // run your delete/reorg from deleteImageList exactly as before
    if (deleteImageList) reorganizeFiles(uploadPath, deleteImageList);

    // 4) If there are new files, write them; otherwise skip entirely
    if (files.length > 0) {
      await Promise.all(
        files.map((file, idx) => {
          const outName = `image-${idx + 1}.png`;
          const outPath = path.join(uploadPath, outName);
          return sharp(file.buffer).withMetadata().png().toFile(outPath);
        })
      );

      newRaiseRequest.imageDir = uploadPath;
      newRaiseRequest.imageCount = files.length;
    }

    // 5) Save + notify
    await newRaiseRequest.save();
    notifyPropertyShareOwnerByPropertyID(propertyID, type);

    return res
      .status(201)
      .json({ message: "New Request added.", success: true });
  } catch (error) {
    console.error("Error in genRaiseRequest:", error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
      error,
      success: false,
    });
  }
};

const fetchRaisedRequestByUsername = async (req, res) => {
  try {
    const { username, type, action } = req.params;

    console.log("req.perms", req.params);
    const shareholderFound = await Shareholders.findOne({ username: username });
    if (!shareholderFound) {
      throw new Error(`No record of ${type} Request found.`);
    }

    if (action === "my") {
      const requestsFound = await RaiseRequest.find({
        shareholderDocID: shareholderFound._id,
        requestType: type,
      })
        .populate({
          path: "propertyDocID",
          model: "properties",
          select:
            "propertyID area imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
          populate: {
            path: "amenitiesID",
            model: "property_amenities",
            select: "roomDetails",
          },
        })
        .populate({
          path: "shareholderDocID",
          model: "shareholders",
          select: "username userID",
          populate: {
            path: "userID",
            model: "users",
            select: "name",
          },
        });
      return res
        .status(200)
        .json({ message: "Fetched", success: true, body: requestsFound });
    } else if (action === "all") {
      const sharesByUsernamePromises =
        shareholderFound.purchasedShareIDList.map((share) => {
          const shareDetail = PropertyShare.findOne(share.shareDocID).populate(
            "propertyDocID",
            "propertyID"
          );
          // console.log("shareDetail: ", shareDetail);
          return shareDetail;
        });

      const sharesByUsername = await Promise.all(sharesByUsernamePromises);

      // Assuming sharesByUsername is an array of share objects
      const sharesPerProperty = sharesByUsername.reduce((acc, share) => {
        // console.log("acc: ", acc);
        const propertyID = share?.propertyDocID?.propertyID;
        console.log(propertyID);
        console.log(share?.propertyDocID);
        if (propertyID)
          acc[propertyID] = {
            propertyID: propertyID,
            propertyDetails: share.propertyDocID,
          };
        return acc;
      }, {});

      // To convert the object back into an array if needed:
      const shareholderPropertyList = Object.values(sharesPerProperty);

      const raiseRequestsList = [];

      for (const property of shareholderPropertyList) {
        const raiseRequestFound = await RaiseRequest.findOne({
          propertyDocID: property.propertyDetails._id,
          requestType: type,
        })
          .populate({
            path: "propertyDocID",
            model: "properties",
            select:
              "propertyID area imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
            populate: {
              path: "amenitiesID",
              model: "property_amenities",
              select: "roomDetails",
            },
          })
          .populate({
            path: "shareholderDocID",
            model: "shareholders",
            select: "username userID",
            populate: {
              path: "userID",
              model: "users",
              select: "name",
            },
          });

        if (raiseRequestFound) {
          raiseRequestsList.push(raiseRequestFound);
        }
      }

      return res
        .status(200)
        .json({ message: "Fetched", success: true, body: raiseRequestsList });
    } else if (action === "pending_approval") {
      const raiseRequestsList = await RaiseRequest.find({
        propertyOwnerDocID: shareholderFound._id,
        requestType: type,
      })
        .populate({
          path: "propertyDocID",
          model: "properties",
          select:
            "propertyID area imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
          populate: {
            path: "amenitiesID",
            model: "property_amenities",
            select: "roomDetails",
          },
        })
        .populate({
          path: "shareholderDocID",
          model: "shareholders",
          select: "username userID",
          populate: {
            path: "userID",
            model: "users",
            select: "name",
          },
        });

      return res
        .status(200)
        .json({ message: "Fetched", success: true, body: raiseRequestsList });
    } else {
      return res
        .status(403)
        .json({ message: "Forbidden or invalid action", success: true });
    }
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "fetchRaisedRequestByUsername",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const getRaiseRequestDetail = async (req, res) => {
  try {
    const { key } = req.params;

    const raiseRequestFound = await RaiseRequest.findOne({
      raisedRequestID: key,
    }).populate({
      path: "shareholderDocID",
      model: "shareholders",
      select: "userID username",
      populate: {
        path: "userID",
        model: "users",
        select: "name",
      },
    });
    if (!raiseRequestFound) {
      throw new Error("raise request not found");
    }

    const propertyFound = await Properties.findOne(
      {
        _id: raiseRequestFound.propertyDocID,
      },
      "shareDocIDList"
    ).populate({
      path: "shareDocIDList",
      model: "property_shares",
      populate: {
        path: "currentOwnerDocID",
        model: "shareholders",
        select: "username",
      },
    });

    const purchasedShareList = propertyFound.shareDocIDList.filter((share) => {
      return (
        share.utilisedStatus !== "Listed" && share.utilisedStatus !== "Reserved"
      );
    });

    res.status(200).json({
      message: "Fetched",
      success: true,
      body: { raiseRequest: raiseRequestFound, sharesList: purchasedShareList },
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getInspectionDetail",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const handleRaiseRequestAction = async (req, res) => {
  try {
    const { requestID, action, username, occurence } = req.body;

    console.log(req.body);

    const raiseRequestFound = await RaiseRequest.findOne({
      raisedRequestID: requestID,
    })
      .populate({
        path: "shareholderDocID",
        model: "shareholders",
        select: "username userID",
        populate: {
          path: "userID",
          model: "users",
          select: "name",
        },
      })
      .populate({
        path: "propertyDocID",
        model: "properties",
        select:
          "propertyID area imageDirURL imageCount title stakesOccupied totalStakes pinnedImageIndex addressOfProperty amenitiesID",
        populate: {
          path: "amenitiesID",
          model: "property_amenities",
          select: "roomDetails",
        },
      });
    if (!raiseRequestFound) {
      throw new Error("request not found");
    }

    for (let index = 0; index < occurence; index++) {
      if (action === "approved") {
        if (raiseRequestFound.rejectedByUsersList.includes(username)) {
          const newRejectedList = raiseRequestFound.rejectedByUsersList.filter(
            (username) => {
              return username !== username;
            }
          );
          raiseRequestFound.rejectedByUsersList = newRejectedList;
        }
        raiseRequestFound.approvedByUsersList.push(username);
      } else if (action === "rejected") {
        if (raiseRequestFound.approvedByUsersList.includes(username)) {
          const newApprovedList = raiseRequestFound.approvedByUsersList.filter(
            (username) => {
              return username !== username;
            }
          );
          raiseRequestFound.approvedByUsersList = newApprovedList;
        }
        raiseRequestFound.rejectedByUsersList.push(username);
      } else {
        return res
          .status(403)
          .json({ message: "Forbidden or no action provided", success: false });
      }
    }

    const propertyFound = await Properties.findOne(
      {
        _id: raiseRequestFound.propertyDocID,
      },
      "shareDocIDList"
    ).populate({
      path: "shareDocIDList",
      model: "property_shares",
      populate: {
        path: "currentOwnerDocID",
        model: "shareholders",
        select: "username",
      },
    });

    const purchasedShareList = propertyFound.shareDocIDList.filter((share) => {
      return share.utilisedStatus !== "Listed";
    });

    const answer =
      raiseRequestFound.approvedByUsersList.length / purchasedShareList.length;
    const percentage = Math.round(answer * 100);
    if (
      percentage >= 80 &&
      raiseRequestFound.status !== "Property Owner Approval Pending"
    )
      raiseRequestFound.status = "Property Owner Approval Pending";
    await raiseRequestFound.save().then(() => {
      res.status(200).json({
        message: "Inspection Updated.",
        success: true,
        body: raiseRequestFound,
      });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleRaiseRequestAction",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const handleRaisedRequestPaymentAction = async (data, session) => {
  try {
    const { requestID } = data;

    const requestFound = await RaiseRequest.findOne({
      raisedRequestID: requestID,
    }).session(session);
    if (!requestFound) {
      throw new Error("raised request not found.");
    }

    // console.log("Request Found: ", requestFound)

    const paidByUsers = requestFound.paidByUsersCount + 1;

    if (requestFound.paidByUsersCount < paidByUsers) {
      if (requestFound.payingUserCount === paidByUsers) {
        await RaiseRequest.updateOne(
          {
            _id: requestFound._id,
          },
          {
            $set: {
              paidByUsersCount: paidByUsers,
              status: "Successfull",
            },
          },
          { session }
        );
      } else {
        await RaiseRequest.updateOne(
          {
            _id: requestFound._id,
          },
          {
            $set: {
              paidByUsersCount: paidByUsers,
            },
          },
          { session }
        );
      }
    } else {
      throw new Error("Forbidden request.");
    }

    return true;
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleRaisedRequestPaymentAction",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    throw new Error(error.message);
  }
};

const handleRaiseRequestActionPropertyOwner = async (req, res) => {
  try {
    const { requestID, usernameList, username } = req.body;

    console.log(req.body);
    const shareholderFound = await Shareholders.findOne({
      username: username,
    }).populate({
      path: "userID",
      model: "users",
      select: "name userDefaultSettingID",
      populate: {
        path: "userDefaultSettingID",
        model: "user_default_settings",
        select: "notifyUpdates",
      },
    });
    if (!shareholderFound) {
      throw new Error("No record found.");
    }

    const raiseRequestFound = await RaiseRequest.findOne({
      raisedRequestID: requestID,
      propertyOwnerDocID: shareholderFound._id,
    }).populate("propertyDocID", "title propertyID");
    if (!raiseRequestFound) {
      throw new Error("raised request not found.");
    }

    usernameList.map((username) => {
      if (
        !raiseRequestFound.approvedByUsersList.includes(username) &&
        !raiseRequestFound.rejectedByUsersList.includes(username)
      ) {
        raiseRequestFound.approvedByUsersList.push(username);
      }
    });

    raiseRequestFound.status = "Payment Pending";
    raiseRequestFound.payingUserCount = usernameList.length;

    const usersFoundPromises = await usernameList.map((username) => {
      return Users.findOne({ username: username }).populate(
        "userDefaultSettingID",
        "notifyUpdates"
      );
    });

    const usersFoundList = await Promise.all(usersFoundPromises);

    const userFound = await Users.findOne({ username: username });

    const companyFeePercentage =
      parseInt(process.env.COMPANY_FEE_PERCENTAGE) / 100;
    const companyFee =
      parseInt(
        raiseRequestFound.estimatedPrice / raiseRequestFound.payingUserCount
      ) * companyFeePercentage;

    for (const user of usersFoundList) {
      const newPayment = new Payments({
        category: "Raised Request",
        totalAmount:
          raiseRequestFound.estimatedPrice / raiseRequestFound.payingUserCount,
        companyFee: companyFee,
        payingAmount:
          raiseRequestFound.estimatedPrice / raiseRequestFound.payingUserCount,
        userDocID: user._id,
        initiatedBy: userFound._id,
        purpose: `Modification Request of ${raiseRequestFound.title} payment required`,
        raisedRequestDocID: raiseRequestFound._id,
        status: "Pending",
      });

      await newPayment.save();
    }

    await raiseRequestFound.save().then(() => {
      usersFoundList.map((user) => {
        const userSubject = `Property ${raiseRequestFound.propertyDocID.title} ${raiseRequestFound.requestType} status`;
        const userBody = `Dear ${user.name}, \nProperty, ${
          raiseRequestFound.propertyDocID.title
        }, ${raiseRequestFound.requestType.toLowerCase()} request is approved by the property owner.Please go to the "Inspections" tab \n Click the link below to Check:\nhttps://www.beachbunnyhouse.com/user/${
          user.username
        } \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          userSubject,
          userBody,
          user.userDefaultSettingID.notifyUpdates,
          user.username
        );
      });

      const subject = `Property ${raiseRequestFound.propertyDocID.title} ${raiseRequestFound.requestType} status`;
      const body = `Dear ${shareholderFound.userID.name}, \nProperty, ${
        raiseRequestFound.propertyDocID.title
      }, ${raiseRequestFound.requestType.toLowerCase()} request has been approved. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        shareholderFound.userID.userDefaultSettingID.notifyUpdates,
        username
      );

      res
        .status(200)
        .json({ message: "Raised Request approved", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleRaiseRequestActionPropertyOwner",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

async function handleVotingDaysOfRaisedRequest() {
  try {
    const raisedRequestList = await RaiseRequest.find({
      status: { $in: ["Decision Pending", "Property Owner Approval Pending"] },
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleVotingDaysOfRaisedRequest",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
}

/**
 * Delete all existing image-*.png (or any extension) in a folder.
 */
function clearAllImages(directory) {
  if (!fs.existsSync(directory)) return;
  fs.readdirSync(directory)
    .filter((f) => f.startsWith("image-"))
    .forEach((f) => fs.unlinkSync(path.join(directory, f)));
}

const addPropertyImages = async (req, res) => {
  try {
    const {
      propertyID,
      pinnedImage,
      deleteImageList,
      userRole,
      userName,
      email,
    } = req.body;

    // 1) Lookup property
    const propertyFound = await Properties.findOne({ propertyID });
    if (!propertyFound) {
      return res
        .status(400)
        .json({ message: "Property not found", success: false });
    }

    const uploadPath = `uploads/${propertyID}/`;
    fs.mkdirSync(uploadPath, { recursive: true });

    // Only clear + replace images if there are new files
    if (req.files && req.files.length > 0) {
      // 2) Clear all existing images
      clearAllImages(uploadPath);

      // 3) Convert + save each new upload → PNG, starting from 1
      await Promise.all(
        req.files.map(async (file, idx) => {
          if (!file.buffer) {
            throw new Error("Missing file.buffer—check your Multer config");
          }
          const imageIndex = idx + 1;
          const outName = `image-${imageIndex}.png`;
          const outPath = path.join(uploadPath, outName);

          await sharp(file.buffer)
            .withMetadata() // keep original metadata
            .toFormat("png") // exactly switch format to PNG
            .toFile(outPath);
        })
      );
    }
    // Handle deletion of specified images
    if (deleteImageList != null && deleteImageList.length > 0) {
      console.log(
        "deleteImageList: ",
        deleteImageList,
        " uploadPath: ",
        uploadPath
      );
      reorganizeFiles(uploadPath, deleteImageList.map(Number));
    }
    // 4) Update pinned image if provided
    if (pinnedImage != null) {
      propertyFound.pinnedImageIndex = parseInt(pinnedImage, 10);
    }

    // 5) Recount + listing status + save
    propertyFound.imageDirURL = uploadPath;
    propertyFound.imageCount = fs
      .readdirSync(uploadPath)
      .filter((f) => f.startsWith("image-")).length;
    if (userRole === "admin") {
      propertyFound.listingStatus = "live";
    }
    if (req.files && req.files.length > 0 ) {
      console.log("in 1st IF");

      if( propertyFound.listingStatus === "pending approval" || propertyFound.listingStatus === "draft" || propertyFound.listingStatus === "live" ) {
      console.log("in 2nd IF");
        propertyFound.listingStatus =
        userRole === "admin" ? "live" : "pending approval";
    }
  }
    // propertyFound.listingStatus = "live"
    await propertyFound.save();

    // 6) Send notification email
    const subject = `Property (${propertyID}) status of listing.`;
    const emailBody =
      userRole === "admin"
        ? `Hello ${userName},\nYour property "${propertyFound.title}" is now live on our platform.\nRegards,\nBunny Beach House.`
        : `Hello ${userName},\nYour property "${propertyFound.title}" is under review for approval.\nRegards,\nBunny Beach House.`;

    sendEmail(email, subject, emailBody);

    // 7) Final response
    return res.status(200).json({
      message: "Property images processed successfully.",
      success: true,
    });
  } catch (error) {
    console.error("addPropertyImages error:", error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
      success: false,
    });
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
//       .json({ message: error.message || "Internal Server Error", error: error, success: false });
//   }
// };

const getProperties = async (req, res) => {
  try {
    const { filter } = req.query;

    let propertiesList = [];

    if (filter === "Featured") {
      propertiesList = await Properties.find({ status: "Featured" }).sort({
        createdAt: -1,
      });
    } else {
      throw new Error("No or invalid filter provided");
    }

    res
      .status(200)
      .json({ message: "Fetched", success: true, body: propertiesList });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getProperties",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

async function featuredExpiry() {
  try {
    const propertiesList = await Properties.find({ status: "Featured" });

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let expiryCount = 0;
    for (const property of propertiesList) {
      if (property.featuredEndDate.date < today) {
        await Properties.updateOne(
          { _id: property._id },
          {
            $set: {
              status: "Non-Featured",
              featuredEndDate: null,
            },
          }
        );
        expiryCount++;
      }
    }

    console.log({
      message: `${expiryCount} expired featured properties.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.log(`Error: ${error}`, "/nlocation: ", {
      function: "featuredExpiry",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
}

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

    matchQuery.listingStatus = { $in: ["live"] };
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
    if (category && category === "rent") {
      // Lookup to join with the PropertyShares collection
      pipeline.push({
        $lookup: {
          from: "property_shares", // Collection name for shares
          localField: "_id", // `_id` in the `properties` collection
          foreignField: "propertyDocID", // Link field in `property_shares`
          as: "shares", // Output field containing the matching shares
        },
      });

      // Add a $match stage to filter for properties with shares on rent
      pipeline.push({
        $match: {
          "shares.onRent": true,
        },
      });
    }
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
    // console.log(propertiesTotal);
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
      totalPages:
        Math.floor(properties.length / propertiesPerPage) +
        (properties.length % propertiesPerPage !== 0 ? 1 : 0),
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getFeaturedProperty",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const getMostViewedProperties = async (req, res) => {
  try {
    const body = JSON.parse(req.params.key); // Parsing the key from params which should be a JSON string
    console.log(body);
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
    matchQuery.listingStatus = { $in: ["live"] };
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
    // Lookup to join with the PropertyShares collection
    if (category && category === "rent") {
      pipeline.push({
        $lookup: {
          from: "property_shares", // Collection name for shares
          localField: "_id", // `_id` in the `properties` collection
          foreignField: "propertyDocID", // Link field in `property_shares`
          as: "shares", // Output field containing the matching shares
        },
      });

      // Add a $match stage to filter for properties with shares on rent
      pipeline.push({
        $match: {
          "shares.onRent": true,
        },
      });
    }
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
    // console.log(propertiesTotal)
    const properties = await Properties.aggregate(pipeline);

    const propertyPromises = properties.map(async (propertyData) => {
      let property = await Properties.findById(propertyData._id); // Retrieve the full Mongoose document
      if (property) {
        property.viewedCount++;
        return property.save(); // Now .save() is available
      }
    });

    const allProperties = await Promise.all(propertyPromises);

    console.log(properties.length);

    res.status(200).json({
      message: "Fetched properties with high view counts successfully",
      success: true,
      body: properties,
      page: page,
      totalPages:
        Math.floor(properties.length / propertiesPerPage) +
        (properties.length % propertiesPerPage !== 0 ? 1 : 0),
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getMostViewedProperties",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
    matchQuery.listingStatus = { $in: ["live"] };
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

    const propertiesPerPage = 12;
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
    // Lookup to join with the PropertyShares collection
    if (category && category === "rent") {
      pipeline.push({
        $lookup: {
          from: "property_shares", // Collection name for shares
          localField: "_id", // `_id` in the `properties` collection
          foreignField: "propertyDocID", // Link field in `property_shares`
          as: "shares", // Output field containing the matching shares
        },
      });

      // Add a $match stage to filter for properties with shares on rent
      pipeline.push({
        $match: {
          "shares.onRent": true,
        },
      });
    }
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
      totalPages:
        Math.floor(properties.length / propertiesPerPage) +
        (properties.length % propertiesPerPage !== 0 ? 1 : 0),
    });
  } catch (error) {
    console.log(`Error: ${error}`, "location: ", {
      function: "getRecentlyAddedProperties",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const getPropertiesByType = async (req, res) => {
  try {
    // console.log(JSON.parse(req.params.key));
    const { propertyType } = JSON.parse(req.params.key);

    const matchQuery = {};

    if (propertyType && propertyType.length > 0)
      if (propertyType.includes("ALL")) {
        matchQuery.propertyType = {
          $in: [
            "Mansion",
            "Villa",
            "Apartment",
            "Suite",
            "Condo",
            "Townhouse",
            "Bungalow",
            "Cabin",
            "Studio",
            "Single family home",
          ],
        };
      } else matchQuery.propertyType = { $in: propertyType };

    matchQuery.listingStatus = { $in: ["live"] };
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
    matchQuery.listingStatus = { $in: ["live"] };
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const getPropertyByID = async (req, res) => {
  try {
    const { key } = req.params;
    const { role, filter } = req.query;

    const propertyFound = await Properties.findOne({
      propertyID: key,
      listingStatus:
        role && role === "admin"
          ? { $in: ["live", "pending approval"] }
          : "live",
      status: filter ? filter : { $in: ["Featured", "Non-Featured"] },
    })
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const handlePropertyFeatured = async (req, res) => {
  try {
    const { id, action } = req.query;

    const propertyFound = await Properties.findOne({ propertyID: id });

    if (!propertyFound) {
      throw new Error("property not found");
    }

    const userFound = await Users.findOne({
      username: propertyFound.publishedBy,
    }).populate("userDefaultSettingID", "notifyUpdates");
    if (!userFound) {
      throw new Error("user not found");
    }

    if (action === "true") {
      const today = new Date();
      const expiryDate = new Date();

      expiryDate.setDate(today.getDate() + 7);
      await Properties.updateOne(
        {
          _id: propertyFound._id,
        },
        {
          $set: {
            status: "Featured",
            featuredEndDate: {
              date: expiryDate,
              dateString: expiryDate.toDateString(),
            },
          },
        }
      );

      const notifySubject = `Property (${propertyFound.propertyID}) Featured`;
      const notifyBody = `Dear ${userFound.name}, Your property \nTitle:${propertyFound.title} \nPropertyID:${propertyFound.propertyID} \nIs featured on our platform.\n Click the link below to Check:\n https://www.beachbunnyhouse.com \nRegards,\nBeach Bunny House. `;

      sendUpdateNotification(
        notifySubject,
        notifyBody,
        userFound.userDefaultSettingID.notifyUpdates,
        userFound.username
      );
    } else {
      throw new Error("No or forbidden action provided");
    }

    res.status(200).json({ message: "Status updated", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handlePropertyFeatured",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

async function handleDraftProperties() {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    today.setDate(today.getDate() - 7);

    const piplineForDraftProperties = [
      {
        $match: {
          createdAt: { $gte: today },
          listingStatus: "draft",
        },
      },
    ];

    const properties = await Properties.aggregate(piplineForDraftProperties);
    console.log("properties: ", properties);
    const response = {
      message: "",
    };
    if (properties.length > 0) {
      for (const property of properties) {
        const userFound = await Users.findOne({
          username: property.publishedBy,
        }).populate("userDefaultSettingID", "notifyUpdates");

        const subject = `Property (${property.title}) status of listing`;
        const body = `Dear ${userFound.name}, \nYou property listing ${property.title} is waiting to be live please fill up the necessary fields to make it live. \n Please go to the "Property Management" tab, then Click Property  ${property.title} to check the Amount.\n Click the link below to Check:\nhttps://www.beachbunnyhouse.com/user/${userFound.username} \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          subject,
          body,
          userFound.userDefaultSettingID.notifyUpdates,
          userFound.username
        );
      }

      response.message += `${properties.length} properties with draft status has been notified.`;
    } else {
      response.message += `0 properties with draft status notified.`;
    }

    const piplineForDeleteDocs = [
      {
        $match: {
          createdAt: { $lt: today },
          listingStatus: "draft",
        },
      },
      {
        $project: { _id: 1 }, // Only project the _id as it's needed for deletion
      },
    ];

    const propertiesToDiscard = await Properties.aggregate(
      piplineForDeleteDocs
    );

    if (propertiesToDiscard.length > 0) {
      const idsToDelete = propertiesToDiscard.map((doc) => doc._id);
      for (const id of idsToDelete) {
        const shareDocIDs = await PropertyShare.find(
          { propertyDocID: id },
          "_id"
        );
        await PropertyShare.deleteMany({ _id: { $in: shareDocIDs } });
      }
      const deletionResult = await Properties.deleteMany({
        _id: { $in: idsToDelete },
      });
      response.message += `\nDeleted ${deletionResult.deletedCount} properties.`;
    } else {
      response.message += "\nNo properties to delete.";
    }

    console.log(`Response: ${response.message}`, "\nlocation: ", {
      function: "handleShareReservation",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleDraftProperties",
      fileLocation: "controllers/PropertyController.js",
      timestamp: currentDateString,
    });
    return {
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    };
  }
}

const handlePropertyStatus = async (req, res) => {
  try {
    const { propertyID, action, username } = req.body;
    let finalStatus = "";
    const propertyFound = await Properties.findOne({
      propertyID: propertyID,
    }).populate({
      path: "shareDocIDList",
      model: "property_shares",
      select: "shareID currentOwnerDocID",
      populate: {
        path: "currentOwnerDocID",
        model: "shareholders",
        select: "username",
      },
    });

    if (propertyFound.shareDocIDList[0].currentOwnerDocID.username === username)
      if (action === "Feature") {
        finalStatus =
          propertyFound.status === "Featured" ? "removed from" : "added to";
        await Properties.updateOne(
          {
            _id: propertyFound._id,
          },
          {
            $set: {
              status:
                propertyFound.status === "Featured"
                  ? "Non-Featured"
                  : "Featured",
            },
          }
        );
      } else if (action === "Hide") {
        finalStatus =
          propertyFound.listingStatus === "hidden"
            ? "Deactivated"
            : "Activated";
        await Properties.updateOne(
          {
            _id: propertyFound._id,
          },
          {
            $set: {
              listingStatus:
                propertyFound.listingStatus === "hidden" ? "live" : "hidden",
            },
          }
        );
      } else if (action === "Buy") {
        finalStatus =
          propertyFound.buyStatus === "Inactive" ? "Activated" : "Deactivated";
        await Properties.updateOne(
          {
            _id: propertyFound._id,
          },
          {
            $set: {
              buyStatus:
                propertyFound.buyStatus === "Inactive" ? "Active" : "Inactive",
            },
          }
        );
      } else {
        return res
          .status(403)
          .json({ message: "Forbidden or No action provided", success: false });
      }
    else
      return res
        .status(401)
        .json({ message: "Authorisation Error", success: false });
    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found");
    }

    const subject = `Property (${propertyFound.title}) ${finalStatus} ${action} update`;
    const body = `Dear ${userFound.name}, \nYour action: ${finalStatus} ${action} has been updated for property: ${propertyFound.title}. \n Click the link below to Check:\n https://www.beachbunnyhouse.com/buy-shares/property/${propertyFound?.propertyID} \nRegards, \nBeach Bunny House.`;

    sendUpdateNotification(
      subject,
      body,
      userFound.userDefaultSettingID.notifyUpdates,
      username
    );

    res.status(200).json({ message: "Updated", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handlePropertyStatus",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const getPropertySharesByID = async (req, res) => {
  try {
    const { propertyID } = req.query;

    const propertyFound = await Properties.findOne(
      { propertyID: propertyID },
      "title shareDocIDList"
    ).populate({
      path: "shareDocIDList",
      options: { skip: 1 },
      model: "property_shares",
      select:
        "availableInDuration currentOwnerDocID shareID onRent onSwap onSale",
      populate: {
        path: "currentOwnerDocID",
        model: "shareholders",
        select: "username",
      },
    });

    res
      .status(200)
      .json({ message: "Fetched", success: true, body: propertyFound });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getPropertySharesByID",
      fileLocation: "controllers/PropertyController.js",
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

async function calPropertyDurationCompletion() {
  const currentMidnight = new Date();
  currentMidnight.setHours(23, 59, 59, 999);
  console.log("cron job running");

  let properties = await Properties.find({
    "shareDocIDList.availableInDuration.endDate": currentMidnight,
    listingStatus: "live",
  }).populate({
    path: "shareDocIDList",
    model: "property_shares",
    select:
      "availableInDuration shareID _id currentOwnerDocID utilisedStatus originalOwnerDocID",
    populate: {
      path: "currentOwnerDocID",
      model: "shareholders",
      select: "userID username",
      populate: {
        path: "userID",
        model: "users",
        select: "name userDefaultSettingID",
        populate: {
          path: "userDefaultSettingID",
          model: "user_default_settings",
          select: "notifyUpdates",
        },
      },
    },
  });

  const filteredProperties = properties.filter((property) =>
    property.shareDocIDList.some((share) => share.utilisedStatus === "On Swap")
  );

  for (const property of filteredProperties) {
    const shareList = property.shareDocIDList;

    for (const share of shareList) {
      if (share.utilisedStatus === "On Swap") {
        console.log(`Restoring share ${share.shareID} to original owner`);

        const originalOwnerId = share.originalOwnerDocID;
        const previousOwnerId = share.currentOwnerDocID;

        // Revert share to original owner
        share.currentOwnerDocID = originalOwnerId;
        share.utilisedStatus = "Purchased"; // Or appropriate status
        share.originalOwnerDocID = null;

        try {
          await share.save();

          // Update original owner's purchased and sold lists
          const originalOwner = await Shareholders.findById(originalOwnerId);
          if (originalOwner) {
            // Add to purchased if not present
            const isInPurchased = originalOwner.purchasedShareIDList.some(
              (entry) => entry.shareDocID.toString() === share._id.toString()
            );
            if (!isInPurchased) {
              originalOwner.purchasedShareIDList.push({
                shareDocID: share._id,
              });
            }
            // Remove from sold
            originalOwner.soldShareIDList =
              originalOwner.soldShareIDList.filter(
                (entry) => entry.shareDocID.toString() !== share._id.toString()
              );
            await originalOwner.save();
          }

          // Update previous owner's purchased list
          const previousOwner = await Shareholders.findById(previousOwnerId);
          if (previousOwner) {
            previousOwner.purchasedShareIDList =
              previousOwner.purchasedShareIDList.filter(
                (entry) => entry.shareDocID.toString() !== share._id.toString()
              );
            await previousOwner.save();
          }
        } catch (error) {
          console.error(`Error reverting share ${share._id}:`, error);
          continue;
        }
      }
    }
  }
  // Find properties where the last share's end date is at current midnight
  properties = await Properties.find({
    "shareDocIDList.availableInDuration.endDate": currentMidnight,
    listingStatus: "live",
  }).populate({
    path: "shareDocIDList",
    model: "property_shares",
    select: "availableInDuration shareID _id currentOwnerDocID",
    populate: {
      path: "currentOwnerDocID",
      model: "shareholders",
      select: "userID username",
      populate: {
        path: "userID",
        model: "users",
        select: "name userDefaultSettingID",
        populate: {
          path: "userDefaultSettingID",
          model: "user_default_settings",
          select: "notifyUpdates",
        },
      },
    },
  });

  for (const property of properties) {
    const shareList = property.shareDocIDList;
    console.log("propertyFound ===> ", property?.shareDocIDList);

    // Rotate the share list (e.g., move the first element to the last position)
    const rotatedShareList = [...shareList.slice(1), shareList[0]];

    // Update the dates based on the end date of the previous share
    for (let i = 0; i < rotatedShareList.length; i++) {
      let previousEndDate;

      if (i === 0) {
        // For the first share, use the end date of the last share before rotation
        previousEndDate =
          shareList[shareList.length - 1].availableInDuration.endDate;
      } else {
        // For other shares, use the end date of the previous share in the rotated list
        previousEndDate = rotatedShareList[i - 1].availableInDuration.endDate;
      }

      const currentDuration = rotatedShareList[i].availableInDuration;

      // Set the new start date to the day after the previous end date
      currentDuration.startDate = new Date(
        previousEndDate.getTime() + 24 * 60 * 60 * 1000
      ); // Adding 1 day

      currentDuration.startDateString = currentDuration.startDate
        .toISOString()
        .split("T")[0];

      // Adjust the end date to maintain the same duration as before
      const originalDuration =
        shareList[i].availableInDuration.endDate.getTime() -
        shareList[i].availableInDuration.startDate.getTime();
      currentDuration.endDate = new Date(
        currentDuration.startDate.getTime() + originalDuration
      );

      currentDuration.endDateString = currentDuration.endDate
        .toISOString()
        .split("T")[0];

      if (i === 0) {
        await PropertyShare.updateOne(
          { _id: shareList[0].availableInDuration.endDate },
          {
            $set: {
              availableInDuration: currentDuration,
            },
          }
        );
      } else {
        await PropertyShare.updateOne(
          { _id: rotatedShareList[i].availableInDuration.endDate },
          {
            $set: {
              availableInDuration: currentDuration,
            },
          }
        );
      }
    }

    // Log the updated share list to see the new dates after rotation and rearrangement
    console.log("rotatedShareList==>", rotatedShareList);
  }
}

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
  getProperties,
  getPropertiesByType,
  getPropertiesByAvailableShares,
  getPropertyByID,
  fetchShareInspectionByUsername,
  handleInspectionSubmission,
  getInspectionDetail,
  handleInspectionAction,
  handleInspectionActionPropertyOwner,
  genRaiseRequest,
  fetchRaisedRequestByUsername,
  getRaiseRequestDetail,
  handleRaiseRequestAction,
  handleRaiseRequestActionPropertyOwner,
  handleDraftProperties,
  getPendingApprovalProperties,
  handlePropertyAction,
  openInspections,
  handlePropertyStatus,
  getPropertySharesByID,
  calPropertyDurationCompletion,
  handleRaisedRequestPaymentAction,
  handlePropertyFeatured,
  featuredExpiry,
};
