const express = require("express");
const cors = require("cors");
const app = express();
const http = require("http");
const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");

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
  console.log(userSocketMap);
  return userSocketMap[username];
};

const removeRecieverID = (username) => {
  delete userSocketMap[username];
};

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const username = socket.handshake.query.username;
  if (username) userSocketMap[username] = socket.id;

  console.log(userSocketMap);

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

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

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    delete userSocketMap[username];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  // Example: listen for messages and broadcast
  socket.on("message", (msg) => {
    io.emit("message", "Hello Client"); // Emitting to all clients
  });
});

module.exports = { app, io, server, getRecieverID, removeRecieverID };
