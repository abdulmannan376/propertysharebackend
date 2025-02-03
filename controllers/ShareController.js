const PropertyShares = require("../models/PropertyShareSchema");
const Properties = require("../models/PropertySchema");
const Users = require("../models/UserSchema");
const Shareholders = require("../models/ShareholderSchema");
const ShareOffers = require("../models/PropertyShareOfferSchema");
const { sendUpdateNotification } = require("./notificationController");
const UserProfile = require("../models/userProfileSchema");
const Payments = require("../models/PaymentSchema");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

const buyShare = async (data, session) => {
  try {
    const { username, shareID, price } = data;
    console.log("in buyShare", data);
    const shareholderFound = await Shareholders.findOne({ username: username })
      .populate("userID")
      .session(session)
      .exec();

    const userDocFound = await Users.findOne({
      username: username,
    });

    if (!userDocFound.isProfileCompleted) {
      throw new Error("user profile not completed.");
    }
    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
    })
      // .populate("propertyDocID")
      .populate("propertyDocID", "title propertyID") // Populate propertyDocID
      .populate({
        path: "currentOwnerDocID",
        model: "shareholders",
        select: "username userID", // Select specific fields from Shareholders
        populate: {
          path: "userID",
          model: "users",
          select: "name userDefaultSettingID", // Include userDefaultSettingID
          populate: {
            path: "userDefaultSettingID",
            model: "user_default_settings",
            select: "notifyUpdates", // Select specific fields from UserDefaultSettings
          },
        },
      })
      .session(session)
      .exec();
    console.log("propertyShareFound: ", propertyShareFound);
    const propertyFound = await Properties.findOne({
      _id: propertyShareFound.propertyDocID._id,
    }).session(session);

    if (!shareholderFound) {
      const userFound = await Users.findOne({ username: username })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);
      if (!userFound) {
        throw new Error("user not found");
      }
      const shareDocIDList = [];
      shareDocIDList.push({ shareDocID: propertyShareFound._id });

      const newShareholder = new Shareholders({
        userID: userFound._id,
        username: username,
        purchasedShareIDList: shareDocIDList,
      });
      await newShareholder.save({ session: session });

      await Users.updateOne(
        { _id: userFound._id },
        {
          $set: {
            role: userFound.role === "user" ? "shareholder" : userFound.role,
          },
        },
        { session: session }
      );

      await PropertyShares.updateOne(
        { _id: propertyShareFound._id },
        {
          $set: {
            currentBoughtAt: price,
            utilisedStatus: "Purchased",
            currentOwnerDocID: newShareholder._id,
          },
        },
        { session: session }
      );

      const stakesOccupied = propertyFound.stakesOccupied;
      await Properties.updateOne(
        { _id: propertyFound._id },
        {
          $set: {
            stakesOccupied: stakesOccupied + 1,
          },
        },
        { session: session }
      );

      const recipient = userFound.email;
      const subject = "Successful Purchase of Share.";
      const body = `Dear ${userFound.name}, \nThis message is to confirm your purchase of a share in property with Title: ${propertyShareFound.propertyDocID?.title}. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );
      return true;
    }

    await PropertyShares.updateOne(
      { _id: propertyShareFound._id },
      {
        $set: {
          currentBoughtAt: price,
          utilisedStatus: "Purchased",
          currentOwnerDocID: shareholderFound._id,
        },
      },
      { session: session }
    );

    await Shareholders.updateOne(
      { _id: shareholderFound._id },
      {
        $addToSet: {
          purchasedShareIDList: {
            shareDocID: propertyShareFound._id,
          },
        },
      },
      { session: session }
    );

    const stakesOccupied = propertyFound.stakesOccupied;
    await Properties.updateOne(
      { _id: propertyFound._id },
      {
        $set: {
          stakesOccupied: stakesOccupied + 1,
        },
      },
      { session: session }
    );

    const userFound = await Users.findOne({ username: username })
      .populate("userDefaultSettingID", "notifyUpdates")
      .session(session);

    const recipient = shareholderFound.userID.email;
    const subject = "Successfull Purchase of Share.";
    // const body = `Dear ${shareholderFound.userID.name}, \nThis email is to confirm your purchase of a share in property with Title: ${propertyShareFound.propertyDocID?.title}. \nRegards, \nBeach Bunny House.`;
    const body = `Dear ${shareholderFound.userID.name},
We are pleased to confirm your purchase of a share in the property titled "${
      propertyShareFound.propertyDocID?.title
    }."
Purchase Details:
- Amount Purchased: $${price}
- Purchase Duration: ${propertyShareFound.availableInDuration.startDate.toDateString()} - ${propertyShareFound.availableInDuration.endDate.toDateString()}
Thank you for your purchase. If you have any questions or require further assistance, feel free to contact us.\n\nRegards,\nBeach Bunny House`;

    sendUpdateNotification(
      subject,
      body,
      userFound.userDefaultSettingID.notifyUpdates,
      username
    );
    return true;
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "buyShare",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    return new Error(error.message || "Internal Server Error");
  }
};
////come here1//
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
            "propertyID imageDirURL imageCount title stakesOccupied totalStakes addressOfProperty"
          )
          .exec();
        // console.log("shareDetail: ", shareDetail);
        return shareDetail;
      }
    );

    const sharesByUsername = await Promise.all(sharesByUsernamePromises);

    // console.log("sharesByUsername: ", sharesByUsername);

    const sharesListWithoutOwner = sharesByUsername.filter((share) => {
      return !share?.shareID.endsWith("00") && share?.propertyDocID;
    });

    // console.log("sharesList: ", sharesListWithoutOwner);
    // Assuming sharesByUsername is an array of share objects
    const sharesPerProperty = await sharesListWithoutOwner.reduce(
      async (accPromise, share) => {
        const acc = await accPromise;
        const propertyID = share?.propertyDocID.propertyID;
        if (!propertyID) return acc;

        // Check if the propertyID already has an entry in the accumulator
        if (!acc[propertyID]) {
          acc[propertyID] = {
            propertyID: propertyID,
            propertyDetails: share.propertyDocID,
            count: 0,
            sharesDetails: {
              availableInDuration: [],
            },
          };
        }

        // Increment the count
        acc[propertyID].count++;

        // Add cleaned `availableInDuration` with `utilisedStatus` and additional fields
        if (share.availableInDuration) {
          const currentDate = new Date(); // Current date for comparison

          let cleanDuration = {
            startDate: share.availableInDuration.startDate,
            startDateString: share.availableInDuration.startDateString,
            endDate: share.availableInDuration.endDate,
            endDateString: share.availableInDuration.endDateString,
            utilisedStatus: share.utilisedStatus || null,
          };

          let shiftedDuration = null;

          // Check if endDate is in the past
          const endDate = new Date(share.availableInDuration.endDate);
          if (endDate < currentDate) {
            // Shift both startDate and endDate to the future
            const startDate = new Date(share.availableInDuration.startDate);

            const nextYearEndDate = new Date(endDate);
            nextYearEndDate.setFullYear(nextYearEndDate.getFullYear() + 1);

            const nextYearStartDate = new Date(startDate);
            nextYearStartDate.setFullYear(nextYearStartDate.getFullYear() + 1);

            // Create a new duration object with updated dates
            shiftedDuration = {
              startDate: nextYearStartDate,
              startDateString: nextYearStartDate.toISOString().split("T")[0],
              endDate: nextYearEndDate,
              endDateString: nextYearEndDate.toISOString().split("T")[0],
              utilisedStatus: cleanDuration.utilisedStatus,
            };

            // Add tenantUser details if `utilisedStatus` is "On Rent"
            if (share.utilisedStatus === "On Rent" && share.tenantUserDocID) {
              const userFound = await Users.findOne({
                _id: share.tenantUserDocID,
              })
                .select("name")
                .exec();
              if (userFound) {
                shiftedDuration.tenantName = userFound.name;
              }
            }
          } else {
            // Add tenantUser details if `utilisedStatus` is "On Rent"
            if (share.utilisedStatus === "On Rent" && share.tenantUserDocID) {
              const userFound = await Users.findOne({
                _id: share.tenantUserDocID,
              })
                .select("name")
                .exec();
              if (userFound) {
                cleanDuration.tenantName = userFound.name;
              }
            }

            // Push the original duration in sequence
            acc[propertyID].sharesDetails.availableInDuration.push(
              cleanDuration
            );
          }

          // If a shifted duration was created, push it at the end
          if (shiftedDuration) {
            acc[propertyID].sharesDetails.availableInDuration.push(
              shiftedDuration
            );
          }

          // Sort availableInDuration by startDate, then endDate
          acc[propertyID].sharesDetails.availableInDuration.sort((a, b) => {
            const startDateA = new Date(a.startDate);
            const startDateB = new Date(b.startDate);
            const endDateA = new Date(a.endDate);
            const endDateB = new Date(b.endDate);

            // Compare start dates first
            if (startDateA.getMonth() !== startDateB.getMonth()) {
              return startDateA.getMonth() - startDateB.getMonth();
            }

            // If months are the same, compare end dates
            return endDateA - endDateB;
          });
        }

        return acc;
      },
      Promise.resolve({})
    );

    // Convert the object back into an array if needed
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const getSharesByProperty = async (req, res) => {
  try {
    const { key, status } = req.params;
    const { category } = req.query;

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
      return res
        .status(200)
        .json({ message: "No shares available.", success: true });
    }

    let propertyShareExpectOwner = [];

    if (category && category === "Rent") {
      propertyShareExpectOwner = propertySharesFound;
    } else {
      propertyShareExpectOwner = propertySharesFound.filter((share) => {
        return !share.shareID.endsWith("00");
      });
    }

    res.status(200).json({
      message: "Fetch successfull",
      success: true,
      body: propertyShareExpectOwner,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getSharesByProperty",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
      utilisedStatus: "Purchased",
    })
      .populate(
        "propertyDocID",
        "propertyID imageDirURL imageCount title stakesOccupied totalStakes"
      )
      .exec();
    // const propertySharesFound = await PropertyShares.find({
    //   propertyDocID: key,
    //   utilisedStatus: status,
    //   onRent: false,
    //   onSale: false,
    //   onSwap: false,
    // })
    //   .populate("currentOwnerDocID", "username")
    //   .exec();
    const sharesListWithoutOwner = sharesByUsername.filter((share) => {
      return !share.shareID.endsWith("00");
    });
    console.log("sharesListWithoutOwner==>", sharesListWithoutOwner);
    res.status(200).json({
      message: "Fetched",
      success: true,
      body: sharesListWithoutOwner,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getSharesByUsername",
      fileLocation: "controllers/ShareController.js",
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
  // const { propertyID, propertyType, area, price } = req.body;
  // findNearbyMarkers(propertyID, propertyType, area, price);
  const result = await notifyWishlistUsers(
    "PLID202407300002",
    "test property 6",
    "Rent"
  );
  res.status(200).json({ message: true, body: result });
};

async function sendSellOfferToPropertyOwner(shareID, category, price) {
  try {
    console.log(shareID, category, price);
    const shareFound = await PropertyShares.findOne({
      shareID: shareID,
      onSale: true,
    })
      .populate({
        path: "currentOwnerDocID",
        model: "shareholders",
        select: "username userID",
        populate: {
          path: "userID",
          model: "users",
          select: "userDefaulySettingID name",
          populate: {
            path: "userDefaultSettingID",
            model: "user_default_settings",
            select: "notifyUpdates",
          },
        },
      })
      .populate("propertyDocID", "propertyID title")
      .exec();

    console.log(shareFound);
    const propertyOwnerShareFound = await PropertyShares.findOne({
      shareID: `${shareFound.propertyDocID.propertyID}00`,
    }).populate({
      path: "currentOwnerDocID",
      model: "shareholders",
      select: "username userID",
      populate: {
        path: "userID",
        model: "users",
        select: "userDefaulySettingID name",
        populate: {
          path: "userDefaultSettingID",
          model: "user_default_settings",
          select: "notifyUpdates",
        },
      },
    });

    const newShareOffer = new ShareOffers({
      shareDocID: shareFound._id,
      price: price,
      shareholderDocID: shareFound.currentOwnerDocID,
      userDocID: propertyOwnerShareFound.currentOwnerDocID.userID._id,
      category: category,
      offerToPropertyOwner: true,
    });

    shareFound.shareOffersList.push(newShareOffer._id);
    await shareFound.save();

    newShareOffer.save().then(() => {
      const userNotificationSubject = `Property share ${category} offer recieved`;
      const userNotificationBody = `Dear ${
        propertyOwnerShareFound.currentOwnerDocID.userID.name
      }, \n${
        shareFound.currentOwnerDocID.userID.name
      } has given an offer for share to ${category}, of price: $${price} Property Title:${
        shareFound.propertyDocID?.title
      } share Duration: ${shareFound.availableInDuration.startDate.toDateString()} - ${shareFound.availableInDuration.endDate.toDateString()} \n Please go to the "Offers" tab, then "Recived" then "Buy" to Accept Buy Offer.\n Click the link below to Accept Buy:\n https://www.beachbunnyhouse.com/user/${
        propertyOwnerShareFound.currentOwnerDocID.username
      }\nRegards, \nBeach Bunny house.`;

      sendUpdateNotification(
        userNotificationSubject,
        userNotificationBody,
        propertyOwnerShareFound.currentOwnerDocID.userID.userDefaultSettingID
          .notifyUpdates,
        propertyOwnerShareFound.currentOwnerDocID.username
      );

      const ownerNotificationSubject = `Property share ${category} offer sent`;
      const ownerNotificationBody = `Dear ${
        shareFound.currentOwnerDocID.userID.name
      }, \nYour offer for share ${category} is sent to property owner: ${
        propertyOwnerShareFound.currentOwnerDocID.username
      } of price: $${price} Property Title:${
        shareFound.propertyDocID?.title
      } share Duration: ${shareFound.availableInDuration.startDate.toDateString()} - ${shareFound.availableInDuration.endDate.toDateString()}. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        ownerNotificationSubject,
        ownerNotificationBody,
        shareFound.currentOwnerDocID.userID.userDefaultSettingID.notifyUpdates,
        shareFound.currentOwnerDocID.username
      );
      createNewShareOfferForAdmin(
        shareID,
        category,
        price
      );
      return true;
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "sendSellOfferToPropertyOwner",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    return new Error(error);
  }
}

async function createNewShareOfferForAdmin(shareID, category, price) {
  try {
    console.log("shareID, category, price", shareID, category, price);

    const shareFound = await PropertyShares.findOne({
      shareID: shareID,
      onSale: true,
    })
      .populate({
        path: "currentOwnerDocID",
        model: "shareholders",
        select: "username userID",
        populate: {
          path: "userID",
          model: "users",
          select: "role userDefaultSettingID name",
          populate: {
            path: "userDefaultSettingID",
            model: "user_default_settings",
            select: "notifyUpdates",
          },
        },
      })
      .populate("propertyDocID", "propertyID title")
      .exec();

    if (!shareFound) {
      throw new Error("Share not found or not on sale.");
    }

    const eligibleUsers = await Users.find({
      role: { $in: ["super admin", "admin"] },
    }).populate("userDefaultSettingID", "notifyUpdates");
    if (!eligibleUsers.length) {
      throw new Error("No eligible users found.");
    }
    console.log("eligibleUsers==>", eligibleUsers);

    for (const user of eligibleUsers) {
      const newShareOffer = new ShareOffers({
        shareDocID: shareFound._id,
        price: price,
        shareholderDocID: shareFound.currentOwnerDocID,
        userDocID: user._id,
        category: category,
        offerToAdmin: true,
      });

      shareFound.shareOffersList.push(newShareOffer._id);
      await newShareOffer.save();

      const userNotificationSubject = `Property share ${category} offer recieved`;
      const userNotificationBody = `Dear ${
        user.name
      }, \nYou have received a new share offer in category ${category} with a price of $${price}.Property Title:${
        shareFound.propertyDocID?.title
      } share Duration: ${shareFound.availableInDuration.startDate.toDateString()} - ${shareFound.availableInDuration.endDate.toDateString()} \n Please go to the "Offers" tab, then "Recived" then "Buy" to Accept Buy Offer.\n Click the link below to Accept Buy:\n https://www.beachbunnyhouse.com/user/${
        user.username
      }\nRegards, \nBeach Bunny house.`;

      sendUpdateNotification(
        userNotificationSubject,
        userNotificationBody,
        user.userDefaultSettingID.notifyUpdates,
        user.username
      );
    }

    await shareFound.save();
    return true;
  } catch (error) {
    console.error(`Error: ${error}`, "\nlocation: ", {
      function: "createNewShareOffer",
      fileLocation: "controllers/ShareController.js",
      timestamp: new Date().toISOString(),
    });
    return new Error(error);
  }
}

async function notifyWishlistUsers(propertyID, propertyTitle, category) {
  try {
    console.log(propertyID, propertyTitle, category);
    // Find user profiles where wishList contains the given propertyID
    const userProfiles = await UserProfile.find({
      wishList: propertyID, // Direct match since both are strings
    }).populate({
      path: "userDocID",
      model: "users",
      select: "userDefaultSettingID name username",
      populate: {
        path: "userDefaultSettingID",
        model: "user_default_settings",
        select: "notifyUpdates",
      },
    });

    for (const user of userProfiles) {
      const userProfile = await UserProfile.findOne({ _id: user._id });

      const wishList = [...userProfile.wishList];
      userProfile.wishList = wishList.filter((item) => {
        return item !== propertyID;
      });

      await userProfile.save();
    }

    userProfiles.map((user) => {
      const subject = `${propertyTitle}'s share available for ${category}`;
      const body = `Dear ${user.userDocID.name}, This is to inform you about the property: ${propertyTitle}, you added eariler in your wishlist. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        user.userDocID.userDefaultSettingID.notifyUpdates,
        user.userDocID.username
      );
    });

    return true; // Return the profiles for further processing or response
  } catch (error) {
    console.error("Error in notifyWishlistUsers:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

const handleShareByCategory = async (req, res) => {
  try {
    const { shareID, username, category, price, action } = req.body;

    console.log(req.body);
    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      return res.status(400).json({ message: "Try again.", success: false });
    }

    const shareholderFound = await Shareholders.findOne({ username: username });
    if (!shareholderFound) {
      return res.status(403).json({
        message: "No purchase found with this share.",
        success: false,
      });
    }

    const propertyShareFound = await PropertyShares.findOne({
      shareID: shareID,
      currentOwnerDocID: shareholderFound._id,
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
        notifyWishlistUsers(
          propertyFound.propertyID,
          propertyFound.title,
          category
        );

        propertyFound.stakesOnRent += 1;

        propertyShareFound.onRent = true;
        propertyShareFound.priceByCategory = price;
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
        notifyWishlistUsers(
          propertyFound.propertyID,
          propertyFound.title,
          category
        );

        propertyFound.stakesOnSale += 1;

        propertyShareFound.onSale = true;
        propertyShareFound.priceByCategory = price;
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
      if (category === "Sell") {
        if (action === "Buy Back") {
          sendSellOfferToPropertyOwner(
            propertyShareFound.shareID,
            category,
            price
          );
        } else {
          createNewShareOfferForAdmin(
            propertyShareFound.shareID,
            category,
            price
          );
        }
      }
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
      })
        .populate("currentOwnerDocID", "username")
        .populate({
          path: "shareOffersList",
          populate: {
            path: "userDocID",
            select: "username", // Include only the username field
          },
          select: "status", // Include the status field from property_share_offers
        });
        
    } else if (category === "Sell") {
      sharesList = await PropertyShares.find({
        propertyDocID: propertyFound._id,
        onSale: true,
      }).populate("currentOwnerDocID", "username").populate({
        path: "shareOffersList",
        populate: {
          path: "userDocID",
          select: "username", // Include only the username field
        },
        select: "status", // Include the status field from property_share_offers
      });
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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

    if (!userFound.isProfileCompleted) {
      throw new Error("user profile not completed.");
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
      startDateTime: startDate,
      startDateString: startDate.toISOString().split("T")[0],
      endDateTime: endDate,
      endDateString: endDate.toISOString().split("T")[0],
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const genNewShareOffer = async (req, res) => {
  try {
    const { shareID, username, price, category } = req.body;

    // console.log(req.body);

    let shareFound = null;
    if (category === "Rent") {
      shareFound = await PropertyShares.findOne({
        shareID: shareID,
        onRent: true,
      })
        .populate("currentOwnerDocID", "username")
        .populate("propertyDocID", "title")
        .exec();

      console.log("shareFound: ", shareFound);
    } else if (category === "Sell") {
      shareFound = await PropertyShares.findOne({
        shareID: shareID,
        onSale: true,
      })
        .populate("currentOwnerDocID", "username")
        .populate("propertyDocID", "title")
        .exec();
    }
    if (!shareFound) {
      throw new Error("property share not found");
    }

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found.");
    }

    if (!userFound.isProfileCompleted) {
      throw new Error("user profile not completed.");
    }

    const ownerFound = await Shareholders.findOne({
      username: shareFound.currentOwnerDocID.username,
    }).populate({
      path: "userID",
      model: "users",
      select: "userDefaultSettingID",
      populate: {
        path: "userDefaultSettingID",
        model: "user_default_settings",
        select: "notifyUpdates",
      },
    });
    console.log("ownerFound", ownerFound);

    const offerFound = await ShareOffers.findOne({
      shareDocID: shareFound._id,
      userDocID: userFound._id,
      category: category,
      status: { $in: ["pending"] },
    });
    if (offerFound) {
      return res
        .status(400)
        .json({ message: "Offer already sent.", success: false });
    }

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
      const userNotificationSubject = `Property share ${category} offer sent`;
      const userNotificationBody = `Dear ${userFound.name}, \nYour offer for share ${category} is sent to user: ${ownerFound.username} with price: $${shareFound.priceByCategory}. \nRegards, \nBeach Bunny house.`;

      sendUpdateNotification(
        userNotificationSubject,
        userNotificationBody,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );

      const ownerNotificationSubject = `Property share ${category} offer recieved`;
      const ownerNotificationBody = `Dear ${ownerFound.username}, \n${
        userFound.name
      } has given an offer for your share in property: ${
        shareFound.propertyDocID.title
      } to ${category === "Sell" ? "Buy" : category}, with your price: $${
        shareFound.priceByCategory
      }. click Link to Approve: https://www.beachbunnyhouse.com/user/${
        ownerFound.username
      } \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        ownerNotificationSubject,
        ownerNotificationBody,
        ownerFound.userID.userDefaultSettingID.notifyUpdates,
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
      .populate("propertyDocID", "title propertyID")
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
    console.log("newShareOffer==>", newShareOffer);

    newShareOffer.save().then(() => {
      const userNotificationSubject = `Property share swap offer sent`;
      const userNotificationBody = `Dear ${
        userFound.name
      }, \nYour offer for share swap is sent to user: ${
        ownerFound.username
      }.Property Title: ${
        shareFound.propertyDocID?.title
      }.\n your share Duration: ${offeredShareFound.availableInDuration.startDate.toDateString()} - ${offeredShareFound.availableInDuration.endDate.toDateString()} swap with Duration:${shareFound.availableInDuration.startDate.toDateString()} - ${shareFound.availableInDuration.endDate.toDateString()}  \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        userNotificationSubject,
        userNotificationBody,
        userFound.userDefaultSettingID.notifyUpdates,
        username
      );

      const ownerNotificationSubject = `Property share swap offer recieved`;
      const ownerNotificationBody = `Dear ${ownerFound.name}, \n${
        userFound.name
      } has given an offer for swap  Property Title: ${
        shareFound.propertyDocID?.title
      }.\n your share Duration: ${shareFound.availableInDuration.startDate.toDateString()} - ${shareFound.availableInDuration.endDate.toDateString()} swap with Duration:${offeredShareFound.availableInDuration.startDate.toDateString()} - ${offeredShareFound.availableInDuration.endDate.toDateString()} \n Please go to the "Offers" tab, then "Recived" then "Swap" to Accept Swap.\n Click the link below to Accept Swap:\n https://www.beachbunnyhouse.com/user/${
        ownerFound.username
      }\nRegards, \nBeach Bunny house.`;

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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const fetchShareOffersOfUserByCategory = async (req, res) => {
  try {
    const { username, category } = req.params;
    const { showHistory } = req.query;

    // Find share offers and populate nested documents
    // console.log(req.query);
    let shareOffersList = [];
    if (category !== "Sell") {
      const userFound = await Users.findOne({
        username: username,
      });
      if (!userFound) {
        throw new Error("user not found.");
      }
      shareOffersList = await ShareOffers.find({
        userDocID: userFound._id,
        category: category, // Assuming there is a field to filter by category
        status:
          showHistory === "true"
            ? { $in: ["accepted", "rejected", "cancelled", "expired"] }
            : "pending",
      })
        .sort({ createdAt: -1 })
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
      const userFound = await Users.findOne({
        username: username,
      });
      if (!userFound) {
        throw new Error("user not found.");
      }
      shareOffersList = await ShareOffers.find({
        userDocID: userFound._id,
        category: category, // Assuming there is a field to filter by category
        offerToPropertyOwner: false,
        status:
          showHistory === "true"
            ? { $in: ["accepted", "rejected", "cancelled", "expired"] }
            : "pending",
      })
        .sort({ createdAt: -1 })
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

      const shareholderFound = await Shareholders.findOne({
        username: username,
      });
      if (!shareholderFound) {
        throw new Error("No record found.");
      }
      const buybackRequests = await ShareOffers.find({
        shareholderDocID: shareholderFound._id,
        category: category, // Assuming there is a field to filter by category
        offerToPropertyOwner: true,
        status:
          showHistory === "true"
            ? { $in: ["accepted", "rejected", "cancelled", "expired"] }
            : "pending",
      })
        .sort({ createdAt: -1 })
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

      shareOffersList = shareOffersList.concat(buybackRequests);
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const fetchShareOffersOfOwnerByCategory = async (req, res) => {
  try {
    const { username, category } = req.params;
    const { showHistory } = req.query;

    let shareOffersList = [];

    if (category !== "Sell") {
      // Find share offers and populate nested documents
      const shareholderFound = await Shareholders.findOne({
        username: username,
      });
      if (!shareholderFound) {
        throw new Error("No record found.");
      }

      shareOffersList = await ShareOffers.find({
        shareholderDocID: shareholderFound._id,
        category: category, // Assuming there is a field to filter by category
        status:
          showHistory === "true"
            ? { $in: ["accepted", "rejected", "cancelled", "expired"] }
            : "pending",
      })
        .sort({ createdAt: -1 })
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
      // Find share offers and populate nested documents
      const shareholderFound = await Shareholders.findOne({
        username: username,
      });
      if (!shareholderFound) {
        throw new Error("No record found.");
      }

      shareOffersList = await ShareOffers.find({
        shareholderDocID: shareholderFound._id,
        category: category, // Assuming there is a field to filter by category
        offerToPropertyOwner: false,
        status:
          showHistory === "true"
            ? { $in: ["accepted", "rejected", "cancelled", "expired"] }
            : "pending",
      })
        .sort({ createdAt: -1 })
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

      const userFound = await Users.findOne({ username: username });
      if (!userFound) {
        throw new Error("user not found.");
      }

      const buybackOffers = await ShareOffers.find({
        userDocID: userFound._id,
        category: category, // Assuming there is a field to filter by category
        offerToPropertyOwner: true,
        status:
          showHistory === "true"
            ? { $in: ["accepted", "rejected", "cancelled", "expired"] }
            : "pending",
      })
        .sort({ createdAt: -1 })
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
      // console.log(userFound.username, "buyback offers: ", buybackOffers.length);
      shareOffersList = shareOffersList.concat(buybackOffers);

      const offerToAdminFind = await ShareOffers.find({
        userDocID: userFound._id,
        category: category, // Assuming there is a field to filter by category
        offerToAdmin: true,
        status:
          showHistory === "true"
            ? { $in: ["accepted", "rejected", "cancelled", "expired"] }
            : "pending",
      })
        .sort({ createdAt: -1 })
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
      // console.log(userFound.username, "buyback offers: ", buybackOffers.length);
      shareOffersList = shareOffersList.concat(offerToAdminFind);
      console.log("offerToAdminFind++>", offerToAdminFind);
    }
    console.log("shareOffersList==>", shareOffersList);

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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const shareRentAction = async (data, session, action) => {
  try {
    if (action === "payment proceed") {
      const { shareID, recipient, username, shareOfferID } = data;

      const propertyShareFound = await PropertyShares.findOne({
        shareID: shareID,
      })
        .populate("propertyDocID", "title propertyID")
        .session(session);

      const shareOfferFound = await ShareOffers.findOne({
        shareOfferID: shareOfferID,
      })
        .populate("shareholderDocID", "username")
        .populate("userDocID", "username")
        .session(session);

      const recipientFound = await Users.findOne({
        username: recipient,
      })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);
      if (!recipientFound) {
        throw new Error("recipient not found");
      }

      const userFound = await Users.findOne({
        username: username,
      })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);
      if (!recipientFound) {
        throw new Error("user not found");
      }

      await PropertyShares.updateOne(
        {
          _id: propertyShareFound._id,
        },
        {
          $set: {
            tenantUserDocID: recipientFound._id,
            utilisedStatus: "On Rent",
          },
        },
        { session }
      );

      await ShareOffers.updateOne(
        { _id: shareOfferFound?._id },
        {
          $set: {
            status: "accepted",
          },
        },
        { session }
      );
      const sellerFound = await Users.findOne({ username: username })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);
      // console.log("sellerFound++>", sellerFound);

      const buyerFound = await Users.findOne({
        username: shareOfferFound.userDocID.username,
      })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);

      // console.log("buyerFound++>", buyerFound);
      const subject = "Successful Purchase of Rent Share.";
      const body = `Dear ${
        buyerFound.name
      }, \nThis message is to confirm your successful agreement for a rental share in property with Title: ${
        propertyShareFound.propertyDocID?.title
      }.property's rent share. \nDuration: ${propertyShareFound.availableInDuration.startDate.toDateString()} - ${propertyShareFound.availableInDuration.endDate.toDateString()}\nPrice: $${
        shareOfferFound.price
      }\nRegards, \nBeach Bunny House.`;

      const sellerSubject = "Successful Rent Share.";
      const sellerBody = `Dear ${
        sellerFound.name
      }, \nThis message is to confirm successful rental share in property with Title: ${
        propertyShareFound.propertyDocID?.title
      }.property's rent share. \nDuration: ${propertyShareFound.availableInDuration.startDate.toDateString()} - ${propertyShareFound.availableInDuration.endDate.toDateString()}\nPrice: $${
        shareOfferFound.price
      } \nThe buyer,${
        buyerFound.name
      }, has completed the payment. The amount will be deposited into your account shortly. for confirmition after one hour check Pending Withdrawals in setting \n Click the link below to pay:\nhttps://www.beachbunnyhouse.com/user/${
        buyerFound?.username
      } \n \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        buyerFound.userDefaultSettingID.notifyUpdates,
        shareOfferFound.userDocID.username
      );

      sendUpdateNotification(
        sellerSubject,
        sellerBody,
        sellerFound.userDefaultSettingID.notifyUpdates,
        username
      );
    } else if (action === "expired") {
      const { shareID, shareOfferID } = data;
      const shareFound = await PropertyShares.findOne({
        shareID: shareID, // Replace with the actual share ID
      })
        .populate("propertyDocID", "title propertyID")
        .populate({
          path: "currentOwnerDocID",
          model: "shareholders",
          select: "username userID", // Select specific fields from Shareholders
          populate: {
            path: "userID",
            model: "users",
            select: "name userDefaultSettingID", // Include userDefaultSettingID
            populate: {
              path: "userDefaultSettingID",
              model: "user_default_settings",
              select: "notifyUpdates", // Select specific fields from UserDefaultSettings
            },
          },
        })
        .session(session); // If you're using transactions

      await PropertyShares.updateOne(
        {
          _id: shareFound._id,
        },
        {
          onRent: true,
          utilisedStatus: "Purchased",
        }
      );

      const paymentsList = await Payments.find({
        shareDocID: shareFound._id,
        status: "Pending",
        category: "Rent Offer",
      });

      const paymentIDList = paymentsList.filter((payment) => {
        return payment._id;
      });

      await Payments.updateMany(
        {
          _id: { $in: paymentIDList },
        },
        { status: "Expired" }
      );
      const sellerSubject = "Property Rent Share is Available Again";

      const sellerBody = `Dear ${
        shareFound.currentOwnerDocID.userID.name
      },\n\nWe gave the buyer a period of 6 hours to complete the payment for the rental share of your property with Title: ${
        shareFound.propertyDocID?.title
      }. Unfortunately, the buyer did not make the payment within the given time.\n\nAs a result, your property is now available for rent again.\n\nDuration: ${shareFound.availableInDuration.startDate.toDateString()} - ${shareFound.availableInDuration.endDate.toDateString()}\nPrice: $${
        shareFound.priceByCategory
      }\n\nThank you for your understanding.\n\nRegards,\nBeach Bunny House`;

      sendUpdateNotification(
        sellerSubject,
        sellerBody,
        shareFound.currentOwnerDocID.userID.userDefaultSettingID.notifyUpdates,
        shareFound.currentOwnerDocID.username
      );
      const shareOfferFound = await ShareOffers.findOne({
        _id: shareOfferID,
      })
        .populate("shareholderDocID", "username")
        .populate("userDocID", "username")
        .session(session);

      const buyerFound = await Users.findOne({
        username: shareOfferFound.userDocID.username,
      })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);

      const subject = "Payment Expired for Rental Share";
      const body = `Dear ${buyerFound.name}, 
      
      We regret to inform you that your payment for rental share in the property titled "${
        shareFound.propertyDocID?.title
      }" has expired. the allowed payment window of 6 hours has now passed. 
      The payment was initiated on ${shareOfferFound.createdAt.toDateString()} at ${shareOfferFound.createdAt.toLocaleTimeString()}, and the allowed payment window of 6 hours has now passed.
      As a result, your rental request has been canceled.
      
      If you wish to re-initiate the process, please visit the property page again and submit a new rent share request.
      
      Thank you for understanding. 
      
      Regards, 
      Beach Bunny House`;

      sendUpdateNotification(
        subject,
        body,
        buyerFound.userDefaultSettingID.notifyUpdates,
        shareOfferFound.userDocID.username
      );
    }

    return true;
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "shareRentAction",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    throw new Error(error.message);
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
    })
      .populate("shareholderDocID", "username")
      .populate("userDocID", "username");
    if (!shareOfferFound) {
      throw new Error("share offer not found");
    }

    const shareOwnerFound = await Users.findOne({
      username: shareOfferFound.shareholderDocID.username,
    }).populate("userDefaultSettingID", "notifyUpdates");

    const propertyShareFound = await PropertyShares.findOne({
      _id: shareOfferFound.shareDocID,
    }).populate("propertyDocID", "title propertyID");

    const companyFeePercentage =
      parseInt(process.env.COMPANY_FEE_PERCENTAGE) / 100;
    const companyFee = Math.ceil(
      parseInt(propertyShareFound.priceByCategory) * companyFeePercentage
    );

    if (action === "accepted") {
      const newPayment = new Payments({
        gatewayTransactionID: "",
        purpose: `Property: ${propertyShareFound.propertyDocID.propertyID} share rent payment required.`,
        category: "Rent Offer",
        userDocID: shareOfferFound.userDocID._id,
        initiatedBy: shareOwnerFound._id,
        totalAmount: propertyShareFound.priceByCategory,
        payingAmount: propertyShareFound.priceByCategory,
        companyFee: companyFee,
        status: "Pending",
        shareDocID: propertyShareFound._id,
        shareOfferDocID: shareOfferFound._id,
      });

      propertyShareFound.onRent = false;
      propertyShareFound.utilisedStatus = "Payment Pending";

      await propertyShareFound.save();
      await newPayment.save();

      shareOfferFound.status = "payment pending";
    } else if (action === "rejected") {
      shareOfferFound.status = "rejected";
    } else if (action === "cancelled") {
      shareOfferFound.status = "cancelled";
    }
    console.log(
      "shareOfferFound.userDocID.username",
      shareOfferFound.userDocID.username
    );

    const secondShareholder = await Users.findOne({
      username: shareOfferFound.userDocID.username,
    }).populate("userDefaultSettingID", "notifyUpdates");

    shareOfferFound.save().then(() => {
      if (action === "accepted") {
        const userNotificationsubject = `Rent Offer from ${shareOwnerFound.username} Accepted`;
        const userNotificationbody = `Dear ${
          userFound.name
        }, \nYou have successfully accepted the offer of rent of ${
          propertyShareFound.propertyDocID.title
        } property's share. \nDuration: ${propertyShareFound.availableInDuration.startDate.toDateString()} - ${propertyShareFound.availableInDuration.endDate.toDateString()}\nPrice: $${
          shareOfferFound.price
        } \nShare Owner Username: ${
          shareOwnerFound.username
        }\nSoon you will get the payment confirmation as the tenant pays it. \nRegards, \nBeach Bunny House`;

        ////it is going wrong///////////
        const ownerNotificationSubject = `Property Share Rent Offer Accepted`;
        const ownerNotificationBody = `Dear ${secondShareholder.name}, \nYour share rent offer has been accepted by user: ${userFound.username} at price: $${shareOfferFound.price}. Payment Pending. \n Please go to the "Bills and Payments" tab, then to "Pending Payments" to clear the payment. It will expire in 6 hours\n Click the link below to pay:\nhttps://www.beachbunnyhouse.com/user/${secondShareholder.username} \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          userNotificationsubject,
          userNotificationbody,
          shareOwnerFound.userDefaultSettingID.notifyUpdates,
          shareOwnerFound.username
        );

        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          secondShareholder.userDefaultSettingID.notifyUpdates,
          secondShareholder?.username
        );
      } else if (action === "rejected") {
        const userNotificationsubject = `Rent Offer from ${shareOwnerFound.username} Rejected`;
        const userNotificationbody = `Dear ${
          userFound.name
        }, \nYou have successfully rejected the offer of rent of ${
          propertyShareFound.propertyDocID.title
        } property's share. \nDuration: ${propertyShareFound.availableInDuration.startDate.toDateString()} - ${propertyShareFound.availableInDuration.endDate.toDateString()}\nPrice: $${
          shareOfferFound.price
        } \nShare Owner Username: ${
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};
////come here2//
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
      "propertyID imageDirURL imageCount title stakesOccupied totalStakes addressOfProperty"
    );
    console.log("shareFoundList++.", shareFoundList);

    // Assuming sharesByUsername is an array of share objects
    // Group shares by propertyID and include multiple availableInDuration entries
    const rentalsByProperty = await shareFoundList.reduce(
      async (accPromise, share) => {
        const acc = await accPromise; // Resolve previous accumulator

        if (!share?.propertyDocID) return acc; // Skip invalid entries

        const propertyID = share.propertyDocID.propertyID;
        if (!propertyID) return acc; // Skip invalid propertyIDs

        if (!acc[propertyID]) {
          // Initialize the property entry if it doesn't exist
          acc[propertyID] = {
            propertyID,
            propertyDetails: share.propertyDocID,
            count: 0,
            rentalDetails: {
              availableInDuration: [],
            },
          };
        }

        // Increment the count
        acc[propertyID].count++;

        if (share.availableInDuration) {
          console.log("share==>", share);

          // Create a cleaned duration object
          let cleanDuration = {
            startDate: share.availableInDuration.startDate,
            endDate: share.availableInDuration.endDate,
            startDateString: share.availableInDuration.startDateString,
            endDateString: share.availableInDuration.endDateString,
            utilisedStatus: share.utilisedStatus || null,
          };

          // Fetch the current owner name if available
          if (share.currentOwnerDocID) {
            const currentShareHolder = await Shareholders.findOne({
              _id: share.currentOwnerDocID,
            })
              .select("username")
              .exec();

            if (currentShareHolder) {
              cleanDuration.ownerName = currentShareHolder.username;
            }
          }

          // Push the cleaned duration into the available durations
          acc[propertyID].rentalDetails.availableInDuration.push(cleanDuration);
        }

        return acc;
      },
      Promise.resolve({})
    );

    // To convert the object back into an array if needed:
    const rentalsPerPropertyArray = Object.values(rentalsByProperty);

    res.status(200).json({
      message: "Fetched rentals",
      success: true,
      body: rentalsPerPropertyArray,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "fetchMyShareRentals",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const shareSellAction = async (data, session, action) => {
  try {
    if (action === "payment proceed") {
      const { username, shareOfferID, isBuybackOffer } = data;

      // console.log("data==>",data)
      // throw new Error("testing")
      // const userFound = await Users.findOne({ username: username })
      //   .populate("userDefaultSettingID", "notifyUpdates")
      //   .session(session);
      // if (!userFound) {
      //   throw new Error("user not found");
      // }

      // if (!userFound.isProfileCompleted) {
      //   throw new Error("user profile not completed.");
      // }

      const shareOfferFound = await ShareOffers.findOne({
        shareOfferID: shareOfferID,
      })
        .populate("shareholderDocID", "username")
        .populate("userDocID", "username")
        .session(session);

      if (!shareOfferFound && action) {
        throw new Error("share offer not found");
      }

      const sharePrevOwnerFound = await Users.findOne({
        username: shareOfferFound.shareholderDocID.username,
      })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);

      const propertyShareFound = await PropertyShares.findOne({
        _id: shareOfferFound.shareDocID,
      })
        .populate("propertyDocID", "title propertyID")
        .session(session);

      const prevShareholder = await Shareholders.findOne({
        username: shareOfferFound.shareholderDocID.username,
      }).session(session);

      console.log("prevShareHolder:", prevShareholder.username);

      const shareholderFound = await Shareholders.findOne({
        username: shareOfferFound.userDocID.username,
      }).session(session);
      await Shareholders.updateOne(
        { _id: prevShareholder._id },
        {
          $pull: {
            purchasedShareIDList: {
              shareDocID: propertyShareFound._id,
            },
          },
          $addToSet: {
            soldShareIDList: {
              shareDocID: propertyShareFound._id,
            },
          },
        }
      );
      if (isBuybackOffer) {
        await PropertyShares.updateOne(
          { _id: propertyShareFound._id },
          {
            $set: {
              currentOwnerDocID: null,
              currentBoughtAt: 0,
              onSale: false,
              utilisedStatus: "Listed",
            },
            $push: {
              lastOwners: {
                username: prevShareholder.username,
                boughtAt: propertyShareFound.currentBoughtAt,
              },
            },
          }
        );
      } else {
        if (!shareholderFound) {
          // const shareDocIDList = [];
          // shareDocIDList.push({ shareDocID: propertyShareFound._id });

          const newShareholder = new Shareholders({
            username: shareOfferFound.userDocID.username,
            userID: shareOfferFound.userDocID._id,
            // purchasedShareIDList: shareDocIDList,
          });

          await Users.updateOne(
            {
              username: shareOfferFound.userDocID.username,
            },
            { $set: { role: "shareholder" } }
          );

          await newShareholder.save();

          await Shareholders.updateOne(
            { _id: newShareholder._id },
            {
              $push: {
                purchasedShareIDList: {
                  shareDocID: propertyShareFound._id,
                },
              },
            }
          );

          await PropertyShares.updateOne(
            { _id: propertyShareFound._id },
            {
              $set: {
                currentOwnerDocID: newShareholder._id,
                currentBoughtAt: shareOfferFound.price,
                onSale: false,
                utilisedStatus: "Purchased",
              },
              $push: {
                lastOwners: {
                  username: sharePrevOwnerFound.username,
                  boughtAt: propertyShareFound.currentBoughtAt,
                },
              },
            }
          );
        } else {
          await Shareholders.updateOne(
            { _id: shareholderFound._id },
            {
              $addToSet: {
                purchasedShareIDList: {
                  shareDocID: propertyShareFound._id,
                },
              },
            }
          );

          await PropertyShares.updateOne(
            { _id: propertyShareFound._id },
            {
              $set: {
                currentOwnerDocID: shareholderFound._id,
                currentBoughtAt: shareOfferFound.price,
                onSale: false,
                utilisedStatus: "Purchased",
              },
              $push: {
                lastOwners: {
                  username: prevShareholder.username,
                  boughtAt: propertyShareFound.currentBoughtAt,
                },
              },
            }
          );
        }
      }

      const sharePendingOffers = await ShareOffers.find({
        shareDocID: propertyShareFound._id,
        category: "Sell",
        status: "pending",
      });

      const sharePendingOffersDocIDs = sharePendingOffers.filter((offer) => {
        return offer._id;
      });

      await ShareOffers.updateMany(
        {
          _id: { $in: sharePendingOffersDocIDs },
        },
        {
          $set: { status: "expired" },
        }
      );

      await ShareOffers.updateOne(
        {
          _id: shareOfferFound._id,
        },
        { $set: { status: "accepted" } }
      );

      const sellerFound = await Users.findOne({ username: username })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);

      const buyerFound = await Users.findOne({
        username: shareOfferFound.userDocID.username,
      })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);

      const subject = "Successful Purchase of Share.";
      const body = `Dear ${
        buyerFound.name
      }, \nThis message is to confirm your purchase of a share in property with Title: ${
        propertyShareFound.propertyDocID?.title
      }.property's share. \nDuration: ${propertyShareFound.availableInDuration.startDate.toDateString()} - ${propertyShareFound.availableInDuration.endDate.toDateString()}\nPrice: $${
        shareOfferFound.price
      }\nRegards, \nBeach Bunny House.`;

      const sellerSubject = "Successful Sell of Share.";
      const sellerBody = `Dear ${
        sellerFound.name
      }, \nThis message is to confirm your Sell of a share in property with Title: ${
        propertyShareFound.propertyDocID?.title
      }.property's share. \nDuration: ${propertyShareFound.availableInDuration.startDate.toDateString()} - ${propertyShareFound.availableInDuration.endDate.toDateString()}\nPrice: $${
        shareOfferFound.price
      } \n The buyer,${
        buyerFound.name
      }, has completed the payment. The amount will be deposited into your account shortly. \nRegards, \nBeach Bunny House.`;

      sendUpdateNotification(
        subject,
        body,
        buyerFound.userDefaultSettingID.notifyUpdates,
        shareOfferFound.userDocID.username
      );

      sendUpdateNotification(
        sellerSubject,
        sellerBody,
        sellerFound.userDefaultSettingID.notifyUpdates,
        username
      );
      //come here
    } else if (action === "expired") {
      const { shareID, shareOfferID } = data;
      const shareFound = await PropertyShares.findOne({
        shareID: shareID,
      })
        .populate("propertyDocID", "title propertyID") // Populate propertyDocID
        .populate({
          path: "currentOwnerDocID",
          model: "shareholders",
          select: "username userID", // Select specific fields from Shareholders
          populate: {
            path: "userID",
            model: "users",
            select: "name userDefaultSettingID", // Include userDefaultSettingID
            populate: {
              path: "userDefaultSettingID",
              model: "user_default_settings",
              select: "notifyUpdates", // Select specific fields from UserDefaultSettings
            },
          },
        });

      await PropertyShares.updateOne(
        {
          _id: shareFound._id,
        },
        {
          onSale: true,
          utilisedStatus: "Purchased",
        }
      );

      const paymentsList = await Payments.find({
        shareDocID: shareFound._id,
        status: "Pending",
        category: "Sell Offer",
      });

      const paymentIDList = paymentsList.filter((payment) => {
        return payment._id;
      });

      await Payments.updateMany(
        {
          _id: { $in: paymentIDList },
        },
        { status: "Expired" }
      );

      const sellerSubject = "Property Sell Share is Available Again";

      const sellerBody = `Dear ${
        shareFound.currentOwnerDocID.userID.name
      },\n\nWe gave the buyer a period of 6 hours to complete the payment for the buy share of your property with Title: ${
        shareFound.propertyDocID?.title
      }. Unfortunately, the buyer did not make the payment within the given time.\n\nAs a result, your property is now available for buy again.\n\nDuration: ${shareFound.availableInDuration.startDate.toDateString()} - ${shareFound.availableInDuration.endDate.toDateString()}\nPrice: $${
        shareFound.priceByCategory
      }\n\nThank you for your understanding.\n\nRegards,\nBeach Bunny House`;

      sendUpdateNotification(
        sellerSubject,
        sellerBody,
        shareFound.currentOwnerDocID.userID.userDefaultSettingID.notifyUpdates,
        shareFound.currentOwnerDocID.username
      );
      const shareOfferFound = await ShareOffers.findOne({
        _id: shareOfferID,
      })
        .populate("shareholderDocID", "username")
        .populate("userDocID", "username")
        .session(session);

      const buyerFound = await Users.findOne({
        username: shareOfferFound.userDocID.username,
      })
        .populate("userDefaultSettingID", "notifyUpdates")
        .session(session);

      const subject = "Payment Expired for Share Purchase";
      const body = `Dear ${buyerFound.name}, 
      
      We regret to inform you that your payment for purchasing a share in the property titled "${
        shareFound.propertyDocID?.title
      }" has expired. the allowed payment window of 6 hours has now passed. 
      The payment was initiated on ${shareOfferFound.createdAt.toDateString()} at ${shareOfferFound.createdAt.toLocaleTimeString()}, and the allowed payment window of 6 hours has now passed.
      As a result, your purchase request has been canceled.
      
      If you wish to re-initiate the process, please visit the property page again and submit a new purchase request.
      
      Thank you for understanding. 
      
      Regards, 
      Beach Bunny House`;

      sendUpdateNotification(
        subject,
        body,
        buyerFound.userDefaultSettingID.notifyUpdates,
        shareOfferFound.userDocID.username
      );
    }

    return true;
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "shareSellAction",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    throw new Error(error.message);
  }
};

const handleShareSellOfferAction = async (req, res) => {
  try {
    const { username, offerID, action, isBuybackOffer } = req.body;

    const userFound = await Users.findOne({ username: username }).populate(
      "userDefaultSettingID",
      "notifyUpdates"
    );
    if (!userFound) {
      throw new Error("user not found");
    }

    // if (!userFound.isProfileCompleted) {
    //   throw new Error("user profile not completed.");
    // }

    console.log(req.body);

    const shareOfferFound = await ShareOffers.findOne({
      shareOfferID: offerID,
    })
      .populate("shareholderDocID", "username")
      .populate("userDocID", "username");
    if (!shareOfferFound) {
      throw new Error("share offer not found");
    }

    const sharePrevOwnerFound = await Users.findOne({
      username: shareOfferFound.shareholderDocID.username,
    }).populate("userDefaultSettingID", "notifyUpdates");

    const propertyShareFound = await PropertyShares.findOne({
      _id: shareOfferFound.shareDocID,
    }).populate("propertyDocID", "title propertyID");

    const prevShareholder = await Shareholders.findOne({
      username: shareOfferFound.shareholderDocID.username,
    });

    console.log("prevShareHolder:", prevShareholder.username);

    const shareholderFound = await Shareholders.findOne({
      username: shareOfferFound.userDocID.username,
    });

    const buyerFound = await Users.findOne({
      username: shareOfferFound.userDocID.username,
    }).populate("userDefaultSettingID", "notifyUpdates");

    // console.log("shareholderFound: ", shareholderFound.username);

    const companyFeePercentage =
      parseInt(process.env.COMPANY_FEE_PERCENTAGE) / 100;
    const companyFee = Math.ceil(
      parseInt(propertyShareFound.priceByCategory) * companyFeePercentage
    );

    if (action === "accepted") {
      const newPayment = new Payments({
        gatewayTransactionID: "",
        purpose: `Property: ${propertyShareFound.propertyDocID.propertyID} Share Buy payment required.`,
        category: "Sell Offer",
        userDocID: buyerFound._id,
        initiatedBy: sharePrevOwnerFound._id,
        totalAmount: propertyShareFound.priceByCategory,
        payingAmount: propertyShareFound.priceByCategory,
        companyFee: companyFee,
        status: "Pending",
        shareDocID: propertyShareFound._id,
        shareOfferDocID: shareOfferFound._id,
      });

      await newPayment.save();

      const sharePendingOffers = await ShareOffers.find({
        shareDocID: propertyShareFound._id,
        category: "Sell",
        status: "pending",
      });

      const sharePendingOffersDocIDs = sharePendingOffers.filter((offer) => {
        return offer._id;
      });

      await ShareOffers.updateMany(
        {
          _id: { $in: sharePendingOffersDocIDs },
        },
        {
          $set: { status: "expired" },
        }
      );

      await PropertyShares.updateOne(
        {
          _id: propertyShareFound._id,
        },
        {
          $set: {
            onSale: false,
            utilisedStatus: "Payment Pending",
          },
        }
      );
      // await prevShareholder.save();
      shareOfferFound.status = "payment pending";
    } else if (action === "rejected") {
      shareOfferFound.status = "rejected";
    } else if (action === "cancelled") {
      shareOfferFound.status = "cancelled";
    }

    shareOfferFound.save().then(() => {
      if (action === "accepted") {
        const userNotificationsubject = `Sell Offer Accepted by ${sharePrevOwnerFound.name}`;
        const userNotificationbody = `Dear ${
          buyerFound.name
        }, \nYour share buy offer have successfully accepted of ${
          propertyShareFound.propertyDocID.title
        } property's share. \nDuration: ${propertyShareFound.availableInDuration.startDate.toDateString()} - ${propertyShareFound.availableInDuration.endDate.toDateString()}\nPrice: $${
          shareOfferFound.price
        } \nPrevious Owner Username: ${
          sharePrevOwnerFound.username
        } Payment Pending. \n Please go to the "Bills and Payments" tab, then to "Pending Payments" to clear the payment. It will expire in\n Click the link below to pay:\nhttps://www.beachbunnyhouse.com/user/${
          buyerFound.username
        } \nRegards, \nBeach Bunny House`;

        const ownerNotificationSubject = `Property Share Sell Offer Accepted`;
        const ownerNotificationBody = `Dear ${sharePrevOwnerFound.name}, \nYou have accepted share sell offer by user: ${buyerFound.username} at price: $${shareOfferFound.price}. \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          userNotificationsubject,
          userNotificationbody,
          buyerFound.userDefaultSettingID.notifyUpdates,
          buyerFound.username
        );

        sendUpdateNotification(
          ownerNotificationSubject,
          ownerNotificationBody,
          userFound.userDefaultSettingID.notifyUpdates,
          username
        );
      } else if (action === "rejected") {
        const userNotificationsubject = `Rent Offer from ${sharePrevOwnerFound.username} Rejected`;
        const userNotificationbody = `Dear ${
          buyerFound.name
        }, \nYou have successfully rejected the offer of rent of ${
          propertyShareFound.propertyDocID.title
        } property's share. \nDuration: ${propertyShareFound.availableInDuration.startDate.toDateString()} - ${propertyShareFound.availableInDuration.endDate.toDateString()}
        \nPrice: $${shareOfferFound.price} \nShare Owner Username: ${
          sharePrevOwnerFound.username
        } \nRegards, \nBeach Bunny House`;

        const ownerNotificationSubject = `Property Share Rent Offer Rejected`;
        const ownerNotificationBody = `Dear ${sharePrevOwnerFound.name}, \nYour share rent offer has been rejected by user: ${userFound.username} at price: $${shareOfferFound.price}. \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          userNotificationsubject,
          userNotificationbody,
          buyerFound.userDefaultSettingID.notifyUpdates,
          buyerFound.username
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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
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

    // console.log(shareOfferFound);

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
        } property's share. \nDuration: ${firstShareFound.availableInDuration.startDate.toDateString()} - ${firstShareFound.availableInDuration.endDate.toDateString()}
        \nWith Share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration:${secondShareFound.availableInDuration.startDate.toDateString()} - ${secondShareFound.availableInDuration.endDate.toDateString()}
        
        \nRegards, \nBeach Bunny House`;

        const userNotificationSubject = `Property Share Swap Offer Accepted`;
        const userNotificationBody = `Dear ${
          secondShareholder.userID.name
        }, \nYou have successfully accepted the offer to swap your share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration: ${secondShareFound.availableInDuration.startDate.toDateString()} - ${secondShareFound.availableInDuration.endDate.toDateString()}
        \nWith Share of ${
          firstShareFound.propertyDocID.title
        } property's share. \nDuration:${firstShareFound.availableInDuration.startDate.toDateString()} - ${firstShareFound.availableInDuration.endDate.toDateString()}
          \nRegards, \nBeach Bunny House`;

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
        } property's share. \nDuration: ${firstShareFound.availableInDuration.startDate.toDateString()} - ${firstShareFound.availableInDuration.endDate.toDateString()}
        \nWith Share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration: ${secondShareFound.availableInDuration.startDate.toDateString()} - ${secondShareFound.availableInDuration.endDate.toDateString()}
         \nRegards, \nBeach Bunny House`;

        const userNotificationSubject = `Property Share Swap Offer Rejected`;
        const userNotificationBody = `Dear ${
          secondShareholder.userID.name
        }, \nYou have successfully rejected the offer to swap your share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration: ${secondShareFound.availableInDuration.startDate.toDateString()} - ${secondShareFound.availableInDuration.endDate.toDateString()}\nWith Share of ${
          firstShareFound.propertyDocID.title
        } property's share. \nDuration: ${firstShareFound.availableInDuration.startDate.toDateString()} - ${firstShareFound.availableInDuration.endDate.toDateString()} \nRegards, \nBeach Bunny House`;

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
        } property's share. \nDuration: ${firstShareFound.availableInDuration.startDate.toDateString()} - ${firstShareFound.availableInDuration.endDate.toDateString()}\nWith Share of ${
          secondShareFound.propertyDocID.title
        } property's share. \nDuration: ${secondShareFound.availableInDuration.startDate.toDateString()} - ${secondShareFound.availableInDuration.endDate.toDateString()} \nRegards, \nBeach Bunny House`;

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
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

async function handleShareReservation() {
  try {
    const today = new Date(); // Get the current date and time
    const twoDaysLater = new Date(today); // Copy today's date to a new variable
    twoDaysLater.setDate(twoDaysLater.getDate() + 2); // Add two days

    // Format dates to ignore the time component, if necessary
    today.setHours(23, 59, 59, 999); // Set time to 00:00:00.000
    twoDaysLater.setHours(23, 59, 59, 999); // Set time to the end of the day

    const pipelineAboutToExpire = [
      {
        $match: {
          "reservationDuration.endDateTime": {
            $gt: today, // Greater than the start of today
            $lte: twoDaysLater, // Less than or equal to the end of the day two days later
          },
          // utilisedStatus: "Purchased",
        },
      },
      {
        $lookup: {
          from: "users", // The collection to join
          localField: "reservedByUserDocID", // The field from the input documents
          foreignField: "_id", // The field from the documents of the "from" collection
          pipeline: [
            {
              $project: {
                // Selecting only the required fields
                username: 1,
                email: 1,
                userDefaultSettingID: 1,
              },
            },
          ],
          as: "reservedByUser", // The array field added to input documents; contains the matching documents from the "from" collection
        },
      },
      {
        $unwind: {
          // Optional, if you want to convert the 'reservedByUser' array to an object
          path: "$reservedByUser",
          preserveNullAndEmptyArrays: true, // Optional, keeps documents even if 'reservedByUser' is empty
        },
      },
      {
        $lookup: {
          from: "properties", // The collection to join
          localField: "propertyDocID", // The field from the input documents
          foreignField: "_id", // The field from the documents of the "from" collection
          pipeline: [
            {
              $project: {
                // Selecting only the required fields
                title: 1,
              },
            },
          ],
          as: "property", // The array field added to input documents; contains the matching documents from the "from" collection
        },
      },
      {
        $unwind: {
          // Optional, if you want to convert the 'reservedByUser' array to an object
          path: "$property",
          preserveNullAndEmptyArrays: true, // Optional, keeps documents even if 'reservedByUser' is empty
        },
      },
      {
        $lookup: {
          from: "user_default_settings", // The collection containing user settings
          localField: "reservedByUser.userDefaultSettingID",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                // Selecting only the required settings
                notifyUpdates: 1,
              },
            },
          ],
          as: "reservedByUser.userSettings",
        },
      },
      {
        $unwind: {
          path: "$reservedByUser.userSettings",
          preserveNullAndEmptyArrays: true, // Keep shares even if no user settings are found
        },
      },
      {
        $project: {
          // Final projection to shape the output
          shareID: 1,
          reservationDuration: 1,
          "reservedByUser.username": 1,
          "reservedByUser.email": 1,
          "reservedByUser.userSettings.notifyUpdates": 1,
          "property.title": 1,
        },
      },
    ];

    const sharesListAboutToExpire = await PropertyShares.aggregate(
      pipelineAboutToExpire
    );

    const pipelineOfExpired = [
      {
        $match: {
          "reservationDuration.endDateTime": {
            $lte: today,
          },
        },
      },
      {
        $lookup: {
          from: "users", // The collection to join
          localField: "reservedByUserDocID", // The field from the input documents
          foreignField: "_id", // The field from the documents of the "from" collection
          pipeline: [
            {
              $project: {
                // Selecting only the required fields
                username: 1,
                email: 1,
                name: 1,
                userDefaultSettingID: 1,
              },
            },
          ],
          as: "reservedByUser", // The array field added to input documents; contains the matching documents from the "from" collection
        },
      },
      {
        $unwind: {
          // Optional, if you want to convert the 'reservedByUser' array to an object
          path: "$reservedByUser",
          preserveNullAndEmptyArrays: true, // Optional, keeps documents even if 'reservedByUser' is empty
        },
      },
      {
        $lookup: {
          from: "properties", // The collection to join
          localField: "propertyDocID", // The field from the input documents
          foreignField: "_id", // The field from the documents of the "from" collection
          pipeline: [
            {
              $project: {
                // Selecting only the required fields
                title: 1,
              },
            },
          ],
          as: "property", // The array field added to input documents; contains the matching documents from the "from" collection
        },
      },
      {
        $unwind: {
          // Optional, if you want to convert the 'reservedByUser' array to an object
          path: "$property",
          preserveNullAndEmptyArrays: true, // Optional, keeps documents even if 'reservedByUser' is empty
        },
      },
      {
        $lookup: {
          from: "user_default_settings", // The collection containing user settings
          localField: "reservedByUser.userDefaultSettingID",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                // Selecting only the required settings
                notifyUpdates: 1,
              },
            },
          ],
          as: "reservedByUser.userSettings",
        },
      },
      {
        $unwind: {
          path: "$reservedByUser.userSettings",
          preserveNullAndEmptyArrays: true, // Keep shares even if no user settings are found
        },
      },
      {
        $project: {
          // Final projection to shape the output
          shareID: 1,
          reservationDuration: 1,
          "reservedByUser.username": 1,
          "reservedByUser.email": 1,
          "reservedByUser.name": 1,
          "reservedByUser.userSettings.notifyUpdates": 1,
          "property.title": 1,
        },
      },
    ];

    const sharesListOfExpired = await PropertyShares.aggregate(
      pipelineOfExpired
    );

    const response = { message: "" };
    if (sharesListAboutToExpire.length > 0) {
      sharesListAboutToExpire.map((share) => {
        const subject = `Property Reservation Reminder`;
        const body = `Dear ${share.reservedByUser.name}, \nYou have reserved a share in ${share.property.title}. Please proceed to pay as it will be removed from reservation soon. \nRegards, \nBeach Bunny House.`;

        // console.log(share);
        sendUpdateNotification(
          subject,
          body,
          share.reservedByUser.userSettings.notifyUpdates,
          share.reservedByUser.username
        );
      });

      response.message += `${sharesListAboutToExpire.length} reservations about to expire notified.`;
    } else {
      response.message += "0 reservations about to expire notified.";
    }
    if (sharesListOfExpired.length > 0) {
      for (const share of sharesListOfExpired) {
        const subject = `Property Reservation Expired.`;
        const body = `Dear ${share.reservedByUser.name}, \nYour share reservation in ${share.property.title} is expired. \nRegards, \nBeach Bunny House.`;

        sendUpdateNotification(
          subject,
          body,
          share.reservedByUser.userSettings.notifyUpdates,
          share.reservedByUser.username
        );

        await PropertyShares.updateOne(
          { shareID: share.shareID },
          {
            $set: {
              reservationDuration: null,
              reservedByUserDocID: null,
            },
          }
        );
      }

      response.message += `\n${sharesListOfExpired.length} reservations expired notified.`;
    } else {
      response.message += "\n0 reservations expired notified.";
    }

    console.log(`Response: ${response.message}`, "\nlocation: ", {
      function: "handleShareReservation",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "handleShareReservation",
      fileLocation: "controllers/ShareController.js",
      timestamp: currentDateString,
    });
    return {
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    };
  }
}

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
  handleShareReservation,
  shareRentAction,
  shareSellAction,

  testRun,
};
