const express = require("express");
const cors = require("cors");
const app = express();
const http = require("http");
const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");
const Conversations = require("../models/ConversationSchema");
const Messages = require("../models/MessageSchema");

app.use(cors());
app.use(express.json());

//new update

//Read SSL certificate files
const privateKey = fs.readFileSync(
  "/etc/letsencrypt/live/beachbunnyhouse.com/privkey.pem",
  "utf8"
);
const certificate = fs.readFileSync(
  "/etc/letsencrypt/live/beachbunnyhouse.com/fullchain.pem",
  "utf8"
);

const credentials = {
  key: privateKey,
  cert: certificate,
};

// Create HTTPS server
const server = https.createServer(credentials, app);

// const server = http.createServer(app);
const io = new Server(server, {
  path: "/socket.io",
  transports: ["websocket"],
});

const messagesNamespace = io.of("/messages");
// Handling connections to the messages namespace
messagesNamespace.on("connection", (socket) => {
  console.log("Connected to messages namespace", socket.handshake.auth);

  socket.on("addMessage", (msg) => {
    // Logic to handle message adding
    console.log("Message added:", msg);
    socket.broadcast.emit("newMessage", msg); // Broadcasting to other users
  });
});
const userSocketMap = {};

const getRecieverID = (username) => {
  console.log("in getRecieverID", userSocketMap);
  return userSocketMap[username];
};

const removeRecieverID = (username) => {
  delete userSocketMap[username];
  console.log("in removeRecieverID", userSocketMap);
};

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const username = socket.handshake.query.username;
  if (username) userSocketMap[username] = socket.id;

  console.log("in onConnection: ", userSocketMap);
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("seenMessage", async (msg) => {
    console.log(msg);

    const { id, reciever, conversationID } = msg;

    const messageIDs = [id];

    await Messages.updateOne({ messageID: id }, { $set: { isOpened: true } });

    const recieverSocketID = userSocketMap[reciever];

    if (recieverSocketID) {
      io.to(recieverSocketID).emit("seenMessages", {
        messageIDs: messageIDs,
        conversationID: conversationID,
      });
    }
  });

  // Handle incoming requests
  socket.on("request", (msg) => {
    console.log(msg);
    const { message, username } = msg;

    if (!message) {
      // Notify all clients that a new user has joined
      io.emit("response", { Username: username });
    } else {
      // Send the message from the user to all clients
      io.emit("response", {
        Username: username,
        message: message,
      });
    }
  });
  socket.on("sendMessage", (message) => {
    io.emit("receiveMessage", message); // Emitting to all clients including sender
    // socket.broadcast.emit('receiveMessage', message); // Emitting to all clients except sender
  });

  socket.on("login", (data) => {
    console.log("user login", userSocketMap);
    console.log("user login", socket.id);
    userSocketMap[data.username] = socket.id;
  });

  socket.on("logout", (data) => {
    console.log("user logout", userSocketMap[data.username]);
    delete userSocketMap[data.username];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    console.log(userSocketMap);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    delete userSocketMap[username];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    console.log(userSocketMap);
  });

  // Example: listen for messages and broadcast
  socket.on("message", (msg) => {
    io.emit("message", "Hello Client"); // Emitting to all clients
  });
});

module.exports = { app, io, server, getRecieverID, removeRecieverID };
