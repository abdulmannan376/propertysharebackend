const { json } = require("express");
const Conversations = require("../models/ConversationSchema");
const Messages = require("../models/MessageSchema");
const Users = require("../models/UserSchema");
const { io, getRecieverID } = require("../socket/socket");

const currentDateMilliseconds = Date.now();
const currentDateString = new Date(currentDateMilliseconds).toLocaleString();

const genConversation = async (req, res) => {
  try {
    const { text, sender, reciever } = req.body;

    const senderFound = await Users.findOne({
      username: sender,
    });
    if (!senderFound) {
      throw new Error("sender not found");
    }

    const recieverFound = await Users.findOne({
      username: reciever,
    });
    if (!recieverFound) {
      throw new Error("reciever not found");
    }

    const newConversation = new Conversations({
      participants: [senderFound._id, recieverFound._id],
    });

    const newMessage = new Messages({
      sender: senderFound._id,
      text: text,
    });

    newConversation.messages.push(newMessage._id);
    newConversation.lastMessage = newMessage._id;

    await Promise.all([newConversation.save(), newMessage.save()]);

    const recieverSocketID = getRecieverID(reciever);

    if (recieverSocketID) {
      io.to(recieverSocketID).emit("newMessage", newMessage);
    }

    res.status(201).json({
      message: "Conversation Started.",
      success: true,
      body: newMessage,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "newConversation",
      fileLocation: "controllers/conversationsController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const addNewMessage = async (req, res) => {
  try {
    const { conversationID, sender, reciever, text } = req.body;

    const senderFound = await Users.findOne({
      username: sender,
    });
    if (!senderFound) {
      throw new Error("sender not found");
    }

    const recieverFound = await Users.findOne({
      username: reciever,
    });
    if (!recieverFound) {
      throw new Error("reciever not found");
    }

    console.log(req.body);
    let conversationFound = await Conversations.findOne({
      participants: { $all: [senderFound._id, recieverFound._id] },
    });

    if (!conversationFound) {
      conversationFound = new Conversations({
        participants: [senderFound._id, recieverFound._id],
      });
    }

    const newMessage = new Messages({
      sender: senderFound._id,
      text: text,
    });

    conversationFound.messages.push(newMessage._id);
    conversationFound.lastMessage = newMessage._id;

    await Promise.all([conversationFound.save(), newMessage.save()]);

    const recieverSocketID = getRecieverID(reciever);

    const message = await Messages.findOne({ _id: newMessage._id }).populate({
      path: "sender",
      model: "users",
      select: "name username userProfile",
      populate: {
        path: "userProfile",
        model: "user_profiles",
        select: "profilePicURL",
      },
    });
    if (recieverSocketID) {
      io.to(recieverSocketID).emit("newMessage", {
        message: message,
        conversationID: conversationFound.conversationID,
      });
    }

    res.status(201).json({
      message: "Message sent.",
      success: true,
      body: message,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "addNewMessage",
      fileLocation: "controllers/conversationsController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const getConversationsByUser = async (req, res) => {
  try {
    const { username } = req.params;

    const userFound = await Users.findOne({ username: username });
    if (!userFound) {
      throw new Error("user not found.");
    }

    const converstaionsFound = await Conversations.find({
      participants: { $in: [userFound._id] },
    })
      .populate({
        path: "lastMessage",
        model: "messages",
        populate: {
          path: "sender",
          model: "users",
          select: "username name",
        },
      })
      .populate({
        path: "participants",
        model: "users",
        select: "name username userProfile",
        populate: {
          path: "userProfile",
          model: "user_profiles",
          select: "profilePicURL",
        },
      });

    res
      .status(200)
      .json({ message: "Fetched", success: true, body: converstaionsFound });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getConversationsByUser",
      fileLocation: "controllers/conversationsController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const getConversationByID = async (req, res) => {
  try {
    const { id, username } = req.params; // Assuming 'key' is the conversation ID
    const page = parseInt(req.query.page) || 1; // Default to first page if not specified
    const limit = 100; // Number of messages per page
    const skip = (page - 1) * limit; // Calculate offset

    // Fetch the conversation with paginated messages
    // Assuming you have a method to find a conversation and populate its messages
    const conversation = await Conversations.findOne({
      conversationID: id,
    }).populate({
      path: "messages",
      options: { limit: limit, skip: skip }, // Sort by newest messages first
      populate: {
        path: "sender",
        model: "users",
        select: "name username userProfile",
        populate: {
          path: "userProfile",
          model: "user_profiles",
          select: "profilePicURL",
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
        success: false,
      });
    }

    let reciever = "";
    const messageIDs = [];
    // Mark all the messages as opened before sending them in the response
    const messageDocIds = conversation.messages.filter((message) => {
      if (message.sender.username !== username && !message.isOpened) {
        reciever = message.sender.username;
        messageIDs.push(message.messageID);
        return message._id;
      }
    });

    await Messages.updateMany(
      { _id: { $in: messageDocIds } },
      { $set: { isOpened: true } }
    );

    const updatedConversation = await Conversations.findOne({
      conversationID: id,
    }).populate({
      path: "messages",
      options: { limit: limit, skip: skip },
      populate: {
        path: "sender",
        model: "users",
        select: "name username userProfile",
        populate: {
          path: "userProfile",
          model: "user_profiles",
          select: "profilePicURL",
        },
      },
    });

    if (reciever.length > 0) {
      const recieverSocketID = getRecieverID(reciever);
      io.to(recieverSocketID).emit("seenMessages", {
        messageIDs: messageIDs,
        conversationID: id,
      });
    }

    res.status(200).json({
      message: "Conversation fetched successfully",
      success: true,
      body: updatedConversation.messages, // Send only messages part if that's all you need
      currentPage: page,
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getConversationByID",
      fileLocation: "controllers/conversationsController.js",
      timestamp: currentDateString, // Make sure to define currentDateString or use new Date().toISOString()
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

const handleMessageActions = async (req, res) => {
  try {
    const { action, recipient, username, id } = req.body;

    console.log(req.body);

    const messageFound = await Messages.findOne({ messageID: id });
    if (!messageFound) {
      throw new Error("message not found");
    }

    let value;
    if (action === "Like") {
      await Messages.updateOne(
        {
          _id: messageFound._id,
        },
        {
          $set: {
            isLiked: !messageFound.isLiked,
          },
        }
      );

      value = !messageFound.isLiked;
    } else if (action === "Delete") {
      await Messages.updateOne(
        {
          _id: messageFound._id,
        },
        {
          $set: {
            isDeleted: true,
          },
        }
      );

      value = true;
    } else {
      return res
        .status(403)
        .json({ message: "Forbidden or No action provided", success: false });
    }

    const recieverSocketID = getRecieverID(recipient);

    if (recieverSocketID) {
      io.to(recieverSocketID).emit("messageUpdate", {
        messageID: id,
        action: action,
        value: value,
      });
    }

    res.status(200).json({
      message: "Updated",
      success: true,
      body: {
        messageID: id,
        action: action,
        value: value,
      },
    });
  } catch (error) {
    console.log(`Error: ${error}`, "\nlocation: ", {
      function: "getConversationsByUser",
      fileLocation: "controllers/conversationsController.js",
      timestamp: currentDateString,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

module.exports = {
  genConversation,
  getConversationsByUser,
  addNewMessage,
  getConversationByID,
  handleMessageActions,
};
