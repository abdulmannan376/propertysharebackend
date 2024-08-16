const Conversations = require("../models/ConversationSchema");
const Messages = require("../models/MessageSchema");
const Users = require("../models/UserSchema");
const { io, getRecieverID } = require("../socket/socket");

const genConversation = async (body) => {
  try {
    const { text, sender, reciever } = body;

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
      timestamp: currentDate,
    });
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error,
      success: false,
    });
  }
};

module.exports = { genConversation };
