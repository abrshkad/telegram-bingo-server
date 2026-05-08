const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const ADMIN_ID = "8294043060";

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Bingo server running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = {};
const CALL_INTERVAL = 5000;

function isAdmin(id) {
  return String(id) === String(ADMIN_ID);
}

function formatNumber(n) {
  if (n <= 15) return `B-${n}`;
  if (n <= 30) return `I-${n}`;
  if (n <= 45) return `N-${n}`;
  if (n <= 60) return `G-${n}`;
  return `O-${n}`;
}

function startGame(roomId) {
  const room = rooms[roomId];
  if (!room || room.timer) return;

  room.called = [];

  io.to(roomId).emit("gameStarted");

  room.timer = setInterval(() => {
    if (room.called.length >= 75) {
      clearInterval(room.timer);
      room.timer = null;
      return;
    }

    let n;
    do {
      n = Math.floor(Math.random() * 75) + 1;
    } while (room.called.includes(n));

    room.called.push(n);

    io.to(roomId).emit("numberCalled", formatNumber(n));
  }, CALL_INTERVAL);
}

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ roomId, user }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        called: [],
        timer: null
      };
    }

    const exists = rooms[roomId].players.find(
      p => String(p.id) === String(user.id)
    );

    if (!exists) {
      rooms[roomId].players.push(user);
    }

    const role = isAdmin(user.id) ? "admin" : "player";

    socket.emit("role", { role });

    io.to(roomId).emit("roomUpdate", rooms[roomId]);
  });

  socket.on("startGame", ({ roomId, userId }) => {
    if (!isAdmin(userId)) return;
    startGame(roomId);
  });
});

server.listen(3000);