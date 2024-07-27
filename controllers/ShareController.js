const PropertyShares = require("../models/PropertyShareSchema");
const Properties = require("../models/PropertySchema");
const Users = require("../models/UserSchema");
const Shareholders = require("../models/ShareholderSchema");
const ShareOffers = require("../models/PropertyShareOfferSchema");
const { sendUpdateNotification } = require("./notificationController");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

const buyShare = async (req, res) => {
  try {
    const { username, shareID, price } = req.body;
    const shareholderFound = await Shareholders.findOne({ username: username })
      .populate("userID")
      .exec();

    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
    })
      .populate("propertyDocID")
      .exec();
    // console.log("propertyShareFound: ", propertyShareFound);
    const propertyFound = await Properties.findOne({
      _id: propertyShareFound.propertyDocID._id,
    });

    if (!shareholderFound) {
      const userFound = await Users.findOne({ username: username }).populate(
        "userDefaultSettingID",
        "notifyUpdates"
      );
      if (!userFound) {
        return res.status(400).json({ message: "Try again.", success: false });
      }
      const shareDocIDList = [];
      shareDocIDList.push({ shareDocID: propertyShareFound._id });

      const newShareholder = new Shareholders({
        userID: userFound._id,
        username: username,
        purchasedShareIDList: shareDocIDList,
      });

      userFound.role = "shareholder";
      await userFound.save();

      await newShareholder.save();
      propertyShareFound.currentBoughtAt = price;
      propertyShareFound.utilisedStatus = "Purchased";
      propertyShareFound.currentOwnerDocID = newShareholder._id;

      propertyFound.stakesOccupied += 1;
      await propertyFound.save();

      propertyShareFound.save().then(() => {
        const recipient = userFound.email;
        const subject = "Successful Purchase of Share.";
        const body = `Dear ${userFound.name}, \nThis email is to confirm your purchase of a share in property with Title: ${propertyShareFound.propertyDocID?.title}. \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          subject,
          body,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );
      });
      return res
        .status(201)
        .json({ message: "Purchase successfull", success: true });
    }

    propertyShareFound.currentBoughtAt = price;
    propertyShareFound.utilisedStatus = "Purchased";
    propertyShareFound.currentOwnerDocID = shareholderFound._id;

    await propertyShareFound.save();

    const shareDocIDList = [...shareholderFound.purchasedShareIDList];
    shareDocIDList.push({ shareDocID: propertyShareFound._id });
    shareholderFound.purchasedShareIDList = shareDocIDList;

    propertyFound.stakesOccupied += 1;
    await propertyFound.save();

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );

    shareholderFound.save().then(() => {
      const recipient = shareholderFound.userID.email;
      const subject = "Successfull Purchase of Share.";
      const body = `Dear ${shareholderFound.userID.name}, \nThis email is to confirm your purchase of a share in property with Title: ${propertyShareFound.propertyDocID?.title}. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );
    });
    res.status(201).json({ message: "Purchase successfull", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "buyShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getBuySharesDetailByUsername = async (req, res) => {
  try {
    const { key } = req.params;

    const shareholderFound = await Shareholders.findOne({ username: key });

    if (!shareholderFound) {
      return res
        .status(400)
        .json({ message: "No Purchases found.", success: false });
    }

    const sharesByUsernamePromises = shareholderFound.purchasedShareIDList.map(
      (share) => {
        const shareDetail = PropertyShares.findOne(share.shareDocID)
          .populate(
            "propertyDocID",
            "propertyID imageDirURL imageCount title stakesOccupied totalStakes"
          )
          .exec();
        console.log("shareDetail: ", shareDetail);
        return shareDetail;
      }
    );

    const sharesByUsername = await Promise.all(sharesByUsernamePromises);

    console.log("sharesByUsername: ", sharesByUsername);

    // Assuming sharesByUsername is an array of share objects
    const sharesPerProperty = sharesByUsername.reduce((acc, share) => {
      console.log("acc: ", acc);
      const propertyID = share.propertyDocID.propertyID;
      // Check if the propertyID already has an entry in the accumulator
      if (acc[propertyID]) {
        // If yes, increment the count
        acc[propertyID].count++;
      } else {
        // If no, create a new entry
        acc[propertyID] = {
          propertyID: propertyID,
          propertyDetails: share.propertyDocID,
          count: 1,
        };
      }
      return acc;
    }, {});

    console.log(sharesPerProperty);

    // To convert the object back into an array if needed:
    const sharesPerPropertyArray = Object.values(sharesPerProperty);

    res.status(200).json({
      message: "Fetched data",
      success: true,
      body: {
        sharesPerProperty: sharesPerPropertyArray,
      },
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getBuySharesDetailByUsername",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getSharesByProperty = async (req, res) => {
  try {
    const { key, status } = req.params;

    const propertySharesFound = await PropertyShares.find({
      propertyDocID: key,
      utilisedStatus: status,
      onRent: false,
      onSale: false,
      onSwap: false,
    })
      .populate("currentOwnerDocID", "username")
      .exec();

    if (!propertySharesFound || propertySharesFound.length === 0) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    res.status(200).json({
      message: "Fetch successfull",
      success: true,
      body: propertySharesFound,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getSharesByProperty",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getSharesByUsername = async (req, res) => {
  try {
    const { username, propertyID } = req.params;

    const shareholderFound = await Shareholders.findOne({ username: username });

    if (!shareholderFound) {
      return res
        .status(400)
        .json({ message: "No Purchases found.", success: false });
    }

    const propertyFound = await Properties.findOne({ propertyID: propertyID });

    const sharesByUsername = await PropertyShares.find({
      propertyDocID: propertyFound._id,
      currentOwnerDocID: shareholderFound._id,
    })
      .populate(
        "propertyDocID",
        "propertyID imageDirURL imageCount title stakesOccupied totalStakes"
      )
      .exec();

    console.log(sharesByUsername);
    res.status(200).json({
      message: "Fetched",
      success: true,
      body: sharesByUsername,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getSharesByUsername",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const handleShareByCategory = async (req, res) => {
  try {
    const { shareID, username, category } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
      utilisedStatus: "Purchased",
    });
    if (!propertyShareFound) {
      throw new Error(`property share not available for ${category}.`);
    }

    const propertyFound = await Properties.findOne({
      _id: propertyShareFound.propertyDocID,
    });

    if (category === "Rent") {
      if (propertyShareFound.onRent) {
        propertyFound.stakesOnRent -= 1;

        propertyShareFound.onRent = false;

        const shareOfferList = await ShareOffers.find({
          shareDocID: propertyShareFound._id,
          category: "Rent",
        });

        const updatedShareOfferListPromises = shareOfferList.map(
          (shareOffer) => {
            if (shareOffer.status === "pending") {
              shareOffer.status = "rejected";
            }

            return shareOffer.save();
          }
        );

        await Promise.all(updatedShareOfferListPromises);
      } else {
        propertyFound.stakesOnRent += 1;

        propertyShareFound.onRent = true;
      }
    } else if (category === "Sell") {
      if (propertyShareFound.onSale) {
        propertyFound.stakesOnSale -= 1;

        propertyShareFound.onSale = false;

        const shareOfferList = await ShareOffers.find({
          shareDocID: propertyShareFound._id,
          category: "Sell",
        });

        const updatedShareOfferListPromises = shareOfferList.map(
          (shareOffer) => {
            if (shareOffer.status === "pending") {
              shareOffer.status = "rejected";
            }

            return shareOffer.save();
          }
        );

        await Promise.all(updatedShareOfferListPromises);
      } else {
        propertyFound.stakesOnSale += 1;

        propertyShareFound.onSale = true;
      }
    } else if (category === "Swap") {
      if (propertyShareFound.onSwap) {
        const shareOfferList = await ShareOffers.find({
          shareDocID: propertyShareFound._id,
          category: "Swap",
        });

        const updatedShareOfferListPromises = shareOfferList.map(
          (shareOffer) => {
            if (shareOffer.status === "pending") {
              shareOffer.status = "rejected";
            }

            return shareOffer.save();
          }
        );

        await Promise.all(updatedShareOfferListPromises);

        propertyShareFound.onSwap = false;
      } else {
        propertyShareFound.onSwap = true;
      }
    }

    await propertyFound.save();

    propertyShareFound.save().then(() => {
      const subject = "Property Share status updated.";
      const body = `Dear ${
        userFound.name
      }, Your share status updated for ${category.toLowerCase()}. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );

      res.status(200).json({
        message: `Successfull for ${category.toLowerCase()}.`,
        success: true,
      });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "rentShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getSharesByCategory = async (req, res) => {
  try {
    const { key, category } = req.params;

    console.log(req.params);
    const propertyFound = await Properties.findOne({ propertyID: key });

    let sharesList = [];
    if (category === "Rent") {
      sharesList = await PropertyShares.find({
        propertyDocID: propertyFound._id,
        onRent: true,
      }).populate("currentOwnerDocID", "username");
    } else if (category === "Sell") {
      sharesList = await PropertyShares.find({
        propertyDocID: propertyFound._id,
        onSale: true,
      }).populate("currentOwnerDocID", "username");
    } else if (category === "Swap") {
      sharesList = await PropertyShares.find({
        propertyDocID: propertyFound._id,
        onSwap: true,
      }).populate("currentOwnerDocID", "username");
    }

    res.status(200).json({
      message: "Fetched",
      success: true,
      body: sharesList,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "rentShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const reserveShare = async (req, res) => {
  try {
    const { username, shareID } = req.body;
    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
    })
      .populate("propertyDocID")
      .exec();

    const propertyFound = await Properties.findOne({
      _id: propertyShareFound.propertyDocID._id,
    });

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 2);

    console.log("startDate: ", startDate, "\nendDate", endDate);
    propertyShareFound.reservedByUserDocID = userFound._id;
    propertyShareFound.reservationDuration = {
      startDateTime: startDate.toISOString().split("T")[0],
      endDateTime: endDate.toISOString().split("T")[0],
    };

    propertyShareFound.utilisedStatus = "Reserved";

    propertyFound.stakesOccupied += 1;

    await propertyFound.save();

    console.log(propertyFound.stakesOccupied);

    propertyShareFound.save().then(() => {
      const recipient = userFound.email;
      const subject = "Successfull Reservation of Share.";
      const body = `Dear ${userFound.name}, \nThis email is to confirm your reservation of a share in property with Title: ${propertyShareFound.propertyDocID?.title}. This reservation will be removed from your reservations after 2 days from now please confirm you purchase as soon as possible. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );
    });
    res.status(201).json({ message: "Reservation successfull", success: true });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "reserveShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const getReservationsByUsername = async (req, res) => {
  try {
    const { key } = req.params;

    const userFound = await Users.findOne({ username: key });

    if (!userFound) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    const reservedSharesList = await PropertyShares.find({
      reservedByUserDocID: userFound._id,
      utilisedStatus: "Reserved",
    })
      .populate(
        "propertyDocID",
        "propertyID imageDirURL imageCount title stakesOccupied totalStakes"
      )
      .exec();

    // Assuming sharesByUsername is an array of share objects
    const reservationsPerProperty = reservedSharesList.reduce((acc, share) => {
      const propertyID = share.propertyDocID.propertyID;
      // Check if the propertyID already has an entry in the accumulator
      if (acc[propertyID]) {
        // If yes, increment the count
        acc[propertyID].count++;
      } else {
        // If no, create a new entry
        acc[propertyID] = {
          propertyID: propertyID,
          propertyDetails: share.propertyDocID,
          count: 1,
        };
      }
      return acc;
    }, {});

    // To convert the object back into an array if needed:
    const reservationsPerPropertyArray = Object.values(reservationsPerProperty);

    res.status(200).json({
      message: " Fetched reservations",
      success: true,
      body: reservationsPerPropertyArray,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "reserveShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const genNewShareOffer = async (req, res) => {
  try {
    const { shareID, username, price, category } = req.body;

    console.log(req.body);

    let shareFound = null;
    if (category === "Rent") {
      shareFound = await PropertyShares.findOne({
        shareID: shareID,
        onRent: true,
      })
        .populate("currentOwnerDocID", "username")
        .exec();

      console.log("shareFound: ", shareFound);
    } else if (category === "Sell") {
      shareFound = await PropertyShares.findOne({
        shareID: shareID,
        onSale: true,
      })
        .populate("currentOwnerDocID", "username")
        .exec();
    }
    if (!shareFound) {
      throw new Error("property share not found");
    }

    const offerExists = await ShareOffers.findOne({
      shareDocID: shareFound._id,
      status: { $in: ["pending", "accepted"] },
    });
    if (offerExists) {
      return res.status(400).json({ message: "Offer already live." });
    }

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found.");
    }

    const ownerFound = await Users.findOne({
      username: shareFound.currentOwnerDocID.username,
    }).populate("userDefaultSettingID", "notifyUpdates");

    const newShareOffer = new ShareOffers({
      shareDocID: shareFound._id,
      price: price,
      shareholderDocID: shareFound.currentOwnerDocID,
      userDocID: userFound._id,
      category: category,
    });

    shareFound.shareOffersList.push(newShareOffer._id);
    await shareFound.save();

    newShareOffer.save().then(() => {
      const userNotificationSubject = `Property share ${category} offer recieved`;
      const userNotificationBody = `Dear ${userFound.name}, \n${ownerFound.name} has given an offer for this share to ${category}, of price: $${price}.\nRegards, \nBeach Bunny house.`;

      sendUpdateNotification(
        userNotificationSubject,
        userNotificationBody,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );

      const ownerNotificationSubject = `Property share ${category} offer sent`;
      const ownerNotificationBody = `Dear ${ownerFound.name}, \nYour offer for share ${category} is sent to user: ${username} of price: $${price}. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        ownerNotificationSubject,
        ownerNotificationBody,
        ownerFound.userDefaultSettingID.notifyUpdates,
        ownerFound.username
      );

      res
        .status(201)
        .json({ message: "Offer sent successfully.", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "genNewShareOffer",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const genShareSwapOffer = async (req, res) => {
  try {
    const { shareID, username, offeredShareID } = req.body;

    console.log(req.body);

    const shareFound = await PropertyShares.findOne({
      shareID: shareID,
      onSwap: true,
    })
      .populate("currentOwnerDocID", "username")
      .exec();

    if (!shareFound) {
      throw new Error("property share not found");
    }

    const offeredShareFound = await PropertyShares.findOne({
      shareID: offeredShareID,
    })
      .populate("currentOwnerDocID", "username")
      .exec();
    if (!offeredShareFound) {
      throw new Error("offered property share not found");
    }
    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found.");
    }

    const ownerFound = await Users.findOne({
      username: shareFound.currentOwnerDocID.username,
    }).populate("userDefaultSettingID", "notifyUpdates");

    const offerFound = await ShareOffers.findOne({
      shareDocID: shareFound._id,
      userDocID: userFound._id,
      offeredShareDocID: offeredShareFound._id,
      category: "Swap",
      status: { $in: ["pending", "accepted"] },
    });
    if (offerFound) {
      return res.status(403).json({
        message: "Offer already sent.",
        success: false,
      });
    }

    const newShareOffer = new ShareOffers({
      shareDocID: shareFound._id,
      shareholderDocID: shareFound.currentOwnerDocID,
      userDocID: userFound._id,
      offeredShareDocID: offeredShareFound._id,
      category: "Swap",
    });

    shareFound.shareOffersList.push(newShareOffer._id);
    await shareFound.save();

    newShareOffer.save().then(() => {
      const userNotificationSubject = `Property share swap offer sent`;
      const userNotificationBody = `Dear ${userFound.name}, \nYour offer for share swap is sent to user: ${ownerFound.username}. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        userNotificationSubject,
        userNotificationBody,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );

      const ownerNotificationSubject = `Property share swap offer recieved`;
      const ownerNotificationBody = `Dear ${ownerFound.name}, \n${userFound.name} has given an offer for this share to swap \nRegards, \nBeach Bunny house.`;

      sendUpdateNotification(
        ownerNotificationSubject,
        ownerNotificationBody,
        ownerFound.userDefaultSettingID.notifyUpdates,
        ownerFound.username
      );

      res
        .status(201)
        .json({ message: "Offer sent successfully.", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "genNewShareOffer",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const fetchShareOffersOfOwnerByCategory = async (req, res) => {
  try {
    const { username, category } = req.params;

    // Find share offers and populate nested documents
    let shareOffersList;
    if (category === "Swap") {
      const userFound = await Users.findOne({
        username: username,
      });
      if (!userFound) {
        throw new Error("user not found.");
      }
      shareOffersList = await ShareOffers.find({
        userDocID: userFound._id,
        category: category, // Assuming there is a field to filter by category
      })
        .populate({
          path: "shareDocID",
          select: "availableInDuration",
          populate: {
            path: "propertyDocID", // Assumed the field name in shareDocID that refers to the property
            model: "properties", // Assuming 'Property' is the model name for propertyDocID
            select:
              "propertyID pinnedImageIndex title addressOfProperty area imageCount",
            populate: {
              path: "amenitiesID",
              model: "property_amenities",
              select: "roomDetails",
            },
          },
        })
        .populate("userDocID", "username")
        .populate("shareholderDocID", "username")
        .populate("offeredShareDocID", "availableInDuration");
    } else {
      const shareholderFound = await Shareholders.findOne({
        username: username,
      });
      if (!shareholderFound) {
        throw new Error("user not found.");
      }
      shareOffersList = await ShareOffers.find({
        shareholderDocID: shareholderFound._id,
        category: category, // Assuming there is a field to filter by category
      })
        .populate({
          path: "shareDocID",
          select: "availableInDuration",
          populate: {
            path: "propertyDocID", // Assumed the field name in shareDocID that refers to the property
            model: "properties", // Assuming 'Property' is the model name for propertyDocID
            select:
              "propertyID pinnedImageIndex title addressOfProperty area imageCount",
            populate: {
              path: "amenitiesID",
              model: "property_amenities",
              select: "roomDetails",
            },
          },
        })
        .populate("userDocID", "username");
    }

    res.json({
      message: "Share offers fetched successfully",
      success: true,
      body: shareOffersList,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "fetchShareOffersOfOwnerByCategory",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const fetchShareOffersOfUserByCategory = async (req, res) => {
  try {
    const { username, category } = req.params;

    // Find share offers and populate nested documents
    let shareOffersList;
    if (category === "Swap") {
      const shareholderFound = await Shareholders.findOne({
        username: username,
      });
      if (!shareholderFound) {
        throw new Error("shareholder not found.");
      }

      shareOffersList = await ShareOffers.find({
        shareholderDocID: shareholderFound._id,
        category: category, // Assuming there is a field to filter by category
      })
        .populate({
          path: "shareDocID",
          select: "availableInDuration",
          populate: {
            path: "propertyDocID", // Assumed the field name in shareDocID that refers to the property
            model: "properties", // Assuming 'Property' is the model name for propertyDocID
            select:
              "propertyID pinnedImageIndex title addressOfProperty area imageCount",
            populate: {
              path: "amenitiesID",
              model: "property_amenities",
              select: "roomDetails",
            },
          },
        })
        .populate("shareholderDocID", "username")
        .populate("userDocID", "username")
        .populate("offeredShareDocID", "availableInDuration");
    } else {
      const userFound = await Users.findOne({ username: username });
      if (!userFound) {
        throw new Error("user not found.");
      }
      shareOffersList = await ShareOffers.find({
        userDocID: userFound._id,
        category: category, // Assuming there is a field to filter by category
      })
        .populate({
          path: "shareDocID",
          select: "availableInDuration",
          populate: {
            path: "propertyDocID", // Assumed the field name in shareDocID that refers to the property
            model: "properties", // Assuming 'Property' is the model name for propertyDocID
            select:
              "propertyID pinnedImageIndex title addressOfProperty area imageCount",
            populate: {
              path: "amenitiesID",
              model: "property_amenities",
              select: "roomDetails",
            },
          },
        })
        .populate("shareholderDocID", "username");
    }
    res.json({
      message: "Share offers fetched successfully",
      success: true,
      body: shareOffersList,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "fetchShareOffersOfUserByCategory",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

function processDate(dateString) {
  if (dateString && dateString.length > 0) {
    const date = new Date(dateString);

    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const dateOfMonth = date.getDate();
    const commutedDateString = `${getDaySuffix(dateOfMonth)} ${
      months[date.getMonth()]
    } ${date.getFullYear()}`;

    return commutedDateString;
  }
}

function getDaySuffix(dateOfMonth) {
  const j = dateOfMonth % 10,
    k = dateOfMonth % 100;
  if (j === 1 && k !== 11) {
    return `${dateOfMonth}st`;
  }
  if (j === 2 && k !== 12) {
    return `${dateOfMonth}nd`;
  }
  if (j === 3 && k !== 13) {
    return `${dateOfMonth}rd`;
  }
  return `${dateOfMonth}th`;
}

const getSwapShareByUsername = async (req, res) => {
  try {
    const { username, propertyID } = req.params;

    const shareholderFound = await Shareholders.findOne({ username: username });

    if (!shareholderFound) {
      return res
        .status(400)
        .json({ message: "No Purchases found.", success: false });
    }

    const propertyFound = await Properties.findOne({ propertyID: propertyID });

    const sharesByUsername = await PropertyShares.find({
      propertyDocID: propertyFound._id,
      currentOwnerDocID: shareholderFound._id,
      onSwap: true,
    })
      .populate(
        "propertyDocID",
        "propertyID imageDirURL imageCount title stakesOccupied totalStakes"
      )
      .exec();

    console.log(sharesByUsername);
    res.status(200).json({
      message: "Fetched",
      success: true,
      body: sharesByUsername,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getSwapShareByUsername",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const handleShareRentOfferAction = async (req, res) => {
  try {
    const { username, offerID, action } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found");
    }

    const shareOfferFound = await ShareOffers.findOne({
      shareOfferID: offerID,
    }).populate("shareholderDocID", "username");
    if (!shareOfferFound) {
      throw new Error("share offer not found");
    }

    const shareOwnerFound = await Users.findOne({
      username: shareOfferFound.shareholderDocID.username,
    }).populate("userDefaultSettingID", "notifyUpdates");

    const propertyShareFound = await PropertyShares.findOne({
      _id: shareOfferFound.shareDocID,
    }).populate("propertyDocID", "title");

    if (action === "accepted") {
      propertyShareFound.tenantUserDocID = userFound._id;
      propertyShareFound.onRent = false;
      propertyShareFound.utilisedStatus = "On Rent";

      await propertyShareFound.save();

      shareOfferFound.status = "accepted";
    } else if (action === "rejected") {
      shareOfferFound.status = "rejected";
    } else if (action === "cancelled") {
      shareOfferFound.status = "cancelled";
    }

    shareOfferFound.save().then(() => {
      if (action === "accepted") {
        const userNotificationsubject = `Rent Offer from ${shareOwnerFound.username} Accepted`;
        const userNotificationbody = `Dear ${
          userFound.name
        }, \nYou have successfully accepted the offer of rent of ${
          propertyShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(propertyShareFound.availableInDuration.startDate) -
          processDate(propertyShareFound.availableInDuration.endDate)
        }\nPrice: $${shareOfferFound.price} \nShare Owner Username: ${
          shareOwnerFound.username
        } \nRegards, \nBeach Bunny House`;

        const ownerNotificationSubject = `Property Share Rent Offer Accepted`;
        const ownerNotificationBody = `Dear ${shareOwnerFound.name}, \nYour share rent offer has been accepted by user: ${userFound.username} at price: $${shareOfferFound.price}. \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          userNotificationsubject,
          userNotificationbody,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );

        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          shareOwnerFound.userDefaultSettingID.notifyUpdates,
          shareOwnerFound.username
        );
      } else if (action === "rejected") {
        const userNotificationsubject = `Rent Offer from ${shareOwnerFound.username} Rejected`;
        const userNotificationbody = `Dear ${
          userFound.name
        }, \nYou have successfully rejected the offer of rent of ${
          propertyShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(propertyShareFound.availableInDuration.startDate) -
          processDate(propertyShareFound.availableInDuration.endDate)
        }\nPrice: $${shareOfferFound.price} \nShare Owner Username: ${
          shareOwnerFound.username
        } \nRegards, \nBeach Bunny House`;

        const ownerNotificationSubject = `Property Share Rent Offer Rejected`;
        const ownerNotificationBody = `Dear ${shareOwnerFound.name}, \nYour share rent offer has been rejected by user: ${userFound.username} at price: $${shareOfferFound.price}. \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          userNotificationsubject,
          userNotificationbody,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );

        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          shareOwnerFound.userDefaultSettingID.notifyUpdates,
          shareOwnerFound.username
        );
      } else if (action === "cancelled") {
        const ownerNotificationSubject = `Property Share Rent Offer Cancelled`;
        const ownerNotificationBody = `Dear ${shareOwnerFound.name}, \nYour share rent offer has been cancelled at price: $${shareOfferFound.price}. \nRegards, \nBeach Bunny House.`;
        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          shareOwnerFound.userDefaultSettingID.notifyUpdates,
          shareOwnerFound.username
        );
      }

      res
        .status(200)
        .json({ message: "Action completed successfull.", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleShareRentOfferAction",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const fetchUserShareRentals = async (req, res) => {
  try {
    const { username } = req.params;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found");
    }

    const shareFoundList = await PropertyShares.find({
      tenantUserDocID: userFound._id,
    }).populate(
      "propertyDocID",
      "propertyID imageDirURL imageCount title stakesOccupied totalStakes"
    );

    // Assuming sharesByUsername is an array of share objects
    const rentalsPerProperty = shareFoundList.reduce((acc, share) => {
      const propertyID = share.propertyDocID.propertyID;
      // Check if the propertyID already has an entry in the accumulator
      if (acc[propertyID]) {
        // If yes, increment the count
        acc[propertyID].count++;
      } else {
        // If no, create a new entry
        acc[propertyID] = {
          propertyID: propertyID,
          propertyDetails: share.propertyDocID,
          count: 1,
        };
      }
      return acc;
    }, {});

    // To convert the object back into an array if needed:
    const rentalsPerPropertyArray = Object.values(rentalsPerProperty);

    res.status(200).json({
      message: " Fetched rentals",
      success: true,
      body: rentalsPerPropertyArray,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "fetchMyShareRentals",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const handleShareSellOfferAction = async (req, res) => {
  try {
    const { username, offerID, action } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found");
    }

    const shareOfferFound = await ShareOffers.findOne({
      shareOfferID: offerID,
    }).populate("shareholderDocID", "username");
    if (!shareOfferFound) {
      throw new Error("share offer not found");
    }

    const sharePrevOwnerFound = await Users.findOne({
      username: shareOfferFound.shareholderDocID.username,
    }).populate("userDefaultSettingID", "notifyUpdates");

    const propertyShareFound = await PropertyShares.findOne({
      _id: shareOfferFound.shareDocID,
    }).populate("propertyDocID", "title");

    const prevShareholder = await Shareholders.findOne({
      username: shareOfferFound.shareholderDocID.username,
    });

    const shareholderFound = await Shareholders.findOne({ username: username });

    if (action === "accepted") {
      const sharePrevOwnerPurchasedIDList =
        prevShareholder.purchasedShareIDList;

      prevShareholder.purchasedShareIDList =
        sharePrevOwnerPurchasedIDList.filter((share) => {
          // Convert Mongoose ObjectIDs to string for comparison
          const shareDocIDString = share.shareDocID.toString();
          const propertyShareDocIDString = propertyShareFound._id.toString();

          // Return true if they are NOT equal, hence the filter will exclude matching IDs
          return shareDocIDString !== propertyShareDocIDString;
        });

      console.log(
        "sharePrevOwnerPurchasedIDList: ",
        sharePrevOwnerPurchasedIDList,
        "prevShareholder: ",
        prevShareholder
      );
      prevShareholder.soldShareIDList.push({
        shareDocID: propertyShareFound._id,
      });

      console.log("prevShareholder: ", prevShareholder);
      if (!shareholderFound) {
        const shareDocIDList = [];
        shareDocIDList.push({ shareDocID: propertyShareFound._id });

        const newShareholder = new Shareholders({
          username: username,
          userID: userFound._id,
          purchasedShareIDList: shareDocIDList,
        });

        userFound.role = "shareholder";

        await newShareholder.save();
        await userFound.save();

        propertyShareFound.currentOwnerDocID = newShareholder._id;
        propertyShareFound.lastOwners.push({
          username: sharePrevOwnerFound.username,
          boughtAt: propertyShareFound.currentBoughtAt,
        });
        propertyShareFound.currentBoughtAt = shareOfferFound.price;
        propertyShareFound.onSale = false;
        propertyShareFound.utilisedStatus = "Purchased";

        await propertyShareFound.save();
      } else {
        shareholderFound.purchasedShareIDList.push({
          shareDocID: propertyShareFound._id,
        });
        propertyShareFound.currentOwnerDocID = shareholderFound._id;
        propertyShareFound.lastOwners.push({
          username: sharePrevOwnerFound.username,
          boughtAt: propertyShareFound.currentBoughtAt,
        });
        await shareholderFound.save();
        propertyShareFound.currentBoughtAt = shareOfferFound.price;
        propertyShareFound.onSale = false;
        propertyShareFound.utilisedStatus = "Purchased";

        await propertyShareFound.save();
      }

      await prevShareholder.save();
      shareOfferFound.status = "accepted";
    } else if (action === "rejected") {
      shareOfferFound.status = "rejected";
    } else if (action === "cancelled") {
      shareOfferFound.status = "cancelled";
    }

    shareOfferFound.save().then(() => {
      if (action === "accepted") {
        const userNotificationsubject = `Sell Offer from ${sharePrevOwnerFound.username} Accepted`;
        const userNotificationbody = `Dear ${
          userFound.name
        }, \nYou have successfully accepted the offer of rent of ${
          propertyShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(propertyShareFound.availableInDuration.startDate) -
          processDate(propertyShareFound.availableInDuration.endDate)
        }\nPrice: $${shareOfferFound.price} \nShare Previous Owner Username: ${
          sharePrevOwnerFound.username
        } \nRegards, \nBeach Bunny House`;

        const ownerNotificationSubject = `Property Share Sell Offer Accepted`;
        const ownerNotificationBody = `Dear ${sharePrevOwnerFound.name}, \nYour share rent offer has been accepted by user: ${userFound.username} at price: $${shareOfferFound.price}. \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          userNotificationsubject,
          userNotificationbody,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );

        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          sharePrevOwnerFound.userDefaultSettingID.notifyUpdates,
          sharePrevOwnerFound.username
        );
      } else if (action === "rejected") {
        const userNotificationsubject = `Rent Offer from ${sharePrevOwnerFound.username} Rejected`;
        const userNotificationbody = `Dear ${
          userFound.name
        }, \nYou have successfully rejected the offer of rent of ${
          propertyShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(propertyShareFound.availableInDuration.startDate) -
          processDate(propertyShareFound.availableInDuration.endDate)
        }\nPrice: $${shareOfferFound.price} \nShare Owner Username: ${
          sharePrevOwnerFound.username
        } \nRegards, \nBeach Bunny House`;

        const ownerNotificationSubject = `Property Share Rent Offer Rejected`;
        const ownerNotificationBody = `Dear ${sharePrevOwnerFound.name}, \nYour share rent offer has been rejected by user: ${userFound.username} at price: $${shareOfferFound.price}. \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          userNotificationsubject,
          userNotificationbody,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );

        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          sharePrevOwnerFound.userDefaultSettingID.notifyUpdates,
          sharePrevOwnerFound.username
        );
      } else if (action === "cancelled") {
        const ownerNotificationSubject = `Property Share Rent Offer Cancelled`;
        const ownerNotificationBody = `Dear ${sharePrevOwnerFound.name}, \nYour share rent offer has been cancelled at price: $${shareOfferFound.price}. \nRegards, \nBeach Bunny House.`;
        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          sharePrevOwnerFound.userDefaultSettingID.notifyUpdates,
          sharePrevOwnerFound.username
        );
      }

      res
        .status(200)
        .json({ message: "Action completed successfull.", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleShareSellOfferAction",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

const handleShareSwapOfferAction = async (req, res) => {
  try {
    const { offerID, action } = req.body;

    const shareOfferFound = await ShareOffers.findOne({
      shareOfferID: offerID,
    })
      .populate("shareholderDocID", "username")
      .populate("userDocID", "username");
    if (!shareOfferFound) {
      throw new Error("share offer not found");
    }

    const firstShareholder = await Shareholders.findOne({
      username: shareOfferFound.shareholderDocID.username,
    }).populate({
      path: "userID",
      select: "name",
      populate: {
        path: "userDefaultSettingID",
        model: "user_default_settings",
        select: "notifyUpdates",
      },
    });

    const secondShareholder = await Shareholders.findOne({
      username: shareOfferFound.userDocID.username,
    }).populate({
      path: "userID",
      select: "name",
      populate: {
        path: "userDefaultSettingID",
        model: "user_default_settings",
        select: "notifyUpdates",
      },
    });

    console.log(shareOfferFound);

    const firstShareFound = await PropertyShares.findOne({
      _id: shareOfferFound.shareDocID,
    }).populate("propertyDocID", "title");

    const secondShareFound = await PropertyShares.findOne({
      _id: shareOfferFound.offeredShareDocID,
    }).populate("propertyDocID", "title");

    if (action === "accepted") {
      const firstShareholderPurchaseList =
        firstShareholder.purchasedShareIDList;

      firstShareholder.purchasedShareIDList =
        firstShareholderPurchaseList.filter((share) => {
          // Convert Mongoose ObjectIDs to string for comparison
          const shareDocIDString = share.shareDocID.toString();
          const offerShareDocIDString = shareOfferFound.shareDocID.toString();

          // Return true if they are NOT equal, hence the filter will exclude matching IDs
          return shareDocIDString !== offerShareDocIDString;
        });

      firstShareholder.soldShareIDList.push({
        shareDocID: shareOfferFound.shareDocID,
      });

      firstShareholder.purchasedShareIDList.push({
        shareDocID: shareOfferFound.offeredShareDocID,
      });

      secondShareFound.currentOwnerDocID = firstShareholder._id;
      const secondShareBoughtAt = secondShareFound.currentBoughtAt;
      secondShareFound.currentBoughtAt = firstShareFound.currentBoughtAt;
      secondShareFound.lastOwners.push({
        username: secondShareholder.username,
        boughtAt: firstShareFound.currentBoughtAt,
      });

      const secondShareholderPurchaseList =
        secondShareholder.purchasedShareIDList;

      secondShareholder.purchasedShareIDList =
        secondShareholderPurchaseList.filter((share) => {
          // Convert Mongoose ObjectIDs to string for comparison
          const shareDocIDString = share.shareDocID.toString();
          const offerShareDocIDString =
            shareOfferFound.offeredShareDocID.toString();

          // Return true if they are NOT equal, hence the filter will exclude matching IDs
          return shareDocIDString !== offerShareDocIDString;
        });

      secondShareholder.soldShareIDList.push({
        shareDocID: shareOfferFound.offeredShareDocID,
      });

      secondShareholder.purchasedShareIDList.push({
        shareDocID: shareOfferFound.shareDocID,
      });

      firstShareFound.currentOwnerDocID = secondShareholder._id;
      firstShareFound.currentBoughtAt = secondShareBoughtAt;
      firstShareFound.lastOwners.push({
        username: firstShareholder.username,
        boughtAt: secondShareBoughtAt,
      });

      firstShareFound.onSwap = false;

      secondShareFound.onSwap = false;

      await firstShareholder.save();
      await firstShareFound.save();

      await secondShareholder.save();
      await secondShareFound.save();

      shareOfferFound.status = "accepted";
    } else if (action === "rejected") {
      shareOfferFound.status = "rejected";
    } else if (action === "cancelled") {
      shareOfferFound.status = "cancelled";
    }

    // console.log(firstShareFound, "\n", secondShareFound);

    shareOfferFound.save().then(() => {
      if (action === "accepted") {
        const ownerNotificationSubject = `Swap Offer from ${secondShareholder.username} Accepted`;
        const ownerNotificationBody = `Dear ${
          firstShareholder.userID.name
        }, \nYou have successfully accepted the offer to swap your share of ${
          firstShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(firstShareFound.availableInDuration.startDate) -
          processDate(firstShareFound.availableInDuration.endDate)
        }\nWith Share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(secondShareFound.availableInDuration.startDate) -
          processDate(secondShareFound.availableInDuration.endDate)
        } \nRegards, \nBeach Bunny House`;

        const userNotificationSubject = `Property Share Swap Offer Accepted`;
        const userNotificationBody = `Dear ${
          secondShareholder.userID.name
        }, \nYou have successfully accepted the offer to swap your share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(secondShareFound.availableInDuration.startDate) -
          processDate(secondShareFound.availableInDuration.endDate)
        }\nWith Share of ${
          firstShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(firstShareFound.availableInDuration.startDate) -
          processDate(firstShareFound.availableInDuration.endDate)
        } \nRegards, \nBeach Bunny House`;

        sendUpdateNotification(
          userNotificationSubject,
          userNotificationBody,
          secondShareholder.userID.userDefaultSettingID.notifyUpdates,
          secondShareholder.username
        );

        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          firstShareholder.userID.userDefaultSettingID.notifyUpdates,
          firstShareholder.username
        );
      } else if (action === "rejected") {
        const ownerNotificationSubject = `Swap Offer from ${secondShareholder.username} Rejected`;
        const ownerNotificationBody = `Dear ${
          firstShareholder.userID.name
        }, \nYou have successfully rejected the offer to swap your share of ${
          firstShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(firstShareFound.availableInDuration.startDate) -
          processDate(firstShareFound.availableInDuration.endDate)
        }\nWith Share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(secondShareFound.availableInDuration.startDate) -
          processDate(secondShareFound.availableInDuration.endDate)
        } \nRegards, \nBeach Bunny House`;

        const userNotificationSubject = `Property Share Swap Offer Rejected`;
        const userNotificationBody = `Dear ${
          secondShareholder.userID.name
        }, \nYou have successfully rejected the offer to swap your share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(secondShareFound.availableInDuration.startDate) -
          processDate(secondShareFound.availableInDuration.endDate)
        }\nWith Share of ${
          firstShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(firstShareFound.availableInDuration.startDate) -
          processDate(firstShareFound.availableInDuration.endDate)
        } \nRegards, \nBeach Bunny House`;

        sendUpdateNotification(
          userNotificationSubject,
          userNotificationBody,
          secondShareholder.userID.userDefaultSettingID.notifyUpdates,
          secondShareholder.username
        );

        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          firstShareholder.userID.userDefaultSettingID.notifyUpdates,
          firstShareholder.username
        );
      } else if (action === "cancelled") {
        const ownerNotificationSubject = `Property Share Swap Offer Cancelled`;
        const ownerNotificationBody = `Dear ${
          firstShareholder.userID.name
        }, \nYou have successfully rejected the offer to swap your share of ${
          firstShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(firstShareFound.availableInDuration.startDate) -
          processDate(firstShareFound.availableInDuration.endDate)
        }\nWith Share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration: ${
          processDate(secondShareFound.availableInDuration.startDate) -
          processDate(secondShareFound.availableInDuration.endDate)
        } \nRegards, \nBeach Bunny House`;

        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          firstShareholder.userID.userDefaultSettingID.notifyUpdates,
          firstShareholder.username
        );
      }

      res
        .status(200)
        .json({ message: "Action completed successfull.", success: true });
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleShareSellOfferAction",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error, success: false });
  }
};

module.exports = {
  buyShare,
  getBuySharesDetailByUsername,
  getSharesByProperty,
  reserveShare,
  getReservationsByUsername,
  handleShareByCategory,
  getSharesByCategory,
  genNewShareOffer,
  fetchShareOffersOfOwnerByCategory,
  fetchShareOffersOfUserByCategory,
  handleShareRentOfferAction,
  fetchUserShareRentals,
  handleShareSellOfferAction,
  getSharesByUsername,
  genShareSwapOffer,
  handleShareSwapOfferAction,
  getSwapShareByUsername,
};
