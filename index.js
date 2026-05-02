const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { isAdmin } = require("./auth");
const { createRoom, getRoom } = require("./rooms");
const { startGame, endGame } = require("./game");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.get("/", (req, res) => {
  res.send("Bingo server running");
});

// SOCKET
io.on("connection", (socket) => {

  socket.on("joinRoom", ({ roomId, user }) => {
    socket.join(roomId);

    const room = createRoom(roomId);

    const role = isAdmin(user.id) ? "admin" : "player";

    room.players.push({
      socketId: socket.id,
      user,
      role
    });

    socket.user = { ...user, role, roomId };

    socket.emit("role", { role });

    io.to(roomId).emit("roomUpdate", room);
  });

  socket.on("startGame", ({ roomId, userId }) => {
    if (!isAdmin(userId)) return;

    startGame(io, roomId);
  });

  socket.on("endGame", ({ roomId, userId }) => {
    if (!isAdmin(userId)) return;

    endGame(io, roomId);
  });

});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});