const io = require("socket.io-client");
const socket = io("wss://server.beachbunnyhouse.com", {
  query: { username: "balaj.ali" },
  transports: ["websocket"],
  secure: true,
});
const readline = require("readline/promises");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let username;

socket.on("connect", () => {
  console.log("Connected to the server.");
  socket.on("getOnlineUsers", (data) => {
    console.log(data);
  });
  socket.on("response", (msg) => {
    const { message, Username } = msg;
    if (!message) {
      console.log(`\n${Username} joined chat`);
    } else {
      console.log(`\n${Username === username ? "You" : Username}: ${message}`);
    }
    askForMessage(); // Prompt user again after displaying the message
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server.");
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err.message);
  });

  askForUsername();
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
});

socket.on('error', (error) => {
  console.error('Error:', error);
});

async function askForUsername() {
  username = await rl.question("Enter your username: ");
  socket.emit("request", { username: username, message: null }); // Assuming there's a 'register' event on the server
}

async function askForMessage() {
  const message = await rl.question("Write a message: ");
  socket.emit("request", { username: username, message: message });
}

// Starting interaction
// askForUsername();

// socket.on("connect", () => {
//   console.log("Connected to the server");
//   socket.emit("message", { username: "User1", message: "Hello server" });

//   // Disconnect after a timeout
//   // setTimeout(() => {
//   //     socket.disconnect();
//   // }, 10000);
// });

// socket.on("message", (msg) => {
//   console.log("Received message:", msg);
// });

// socket.on("disconnect", () => {
//   console.log("Disconnected from server");
// });

// const { connectToServer } = require("../protocol88/protocol88");
// const readline = require("readline/promises");

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// const client = connectToServer("127.0.0.1", 3800);
