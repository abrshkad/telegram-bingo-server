const ADMIN_ID = "8294043060"; // your Telegram ID

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = {};
const CALL_INTERVAL = 5000;

// =======================
// 👑 ADMIN HELPER
// =======================
function isAdmin(userId) {
  return String(userId) === ADMIN_ID;
}

// =======================
// FORMAT NUMBER
// =======================
function formatCallNumber(n) {
  if (n <= 15) return `B-${n}`;
  if (n <= 30) return `I-${n}`;
  if (n <= 45) return `N-${n}`;
  if (n <= 60) return `G-${n}`;
  return `O-${n}`;
}

// =======================
// WIN CHECK
// =======================
function checkWin(marked) {
  const size = 5;

  for (let r = 0; r < size; r++) {
    let win = true;
    for (let c = 0; c < size; c++) {
      if (!marked[r * 5 + c]) win = false;
    }
    if (win) return true;
  }

  for (let c = 0; c < size; c++) {
    let win = true;
    for (let r = 0; r < size; r++) {
      if (!marked[r * 5 + c]) win = false;
    }
    if (win) return true;
  }

  let d1 = true;
  for (let i = 0; i < size; i++) {
    if (!marked[i * 5 + i]) d1 = false;
  }
  if (d1) return true;

  let d2 = true;
  for (let i = 0; i < size; i++) {
    if (!marked[i * 5 + (4 - i)]) d2 = false;
  }
  if (d2) return true;

  return false;
}

// =======================
// START GAME (ADMIN ONLY)
// =======================
function startGame(roomId, userId) {
  const room = rooms[roomId];
  if (!room || room.timer || room.state === "running") return;

  if (!isAdmin(userId)) return;

  room.called = [];
  room.state = "running";
  room.winner = null;

  io.to(roomId).emit("gameState", "running");

  room.timer = setInterval(() => {
    if (room.called.length >= 75 || room.state !== "running") {
      clearInterval(room.timer);
      room.timer = null;
      return;
    }

    let n;
    do {
      n = Math.floor(Math.random() * 75) + 1;
    } while (room.called.includes(n));

    room.called.push(n);

    const formatted = formatCallNumber(n);

    io.to(roomId).emit("numberCalled", {
      current: formatted,
      history: room.called.map(formatCallNumber).reverse()
    });

  }, CALL_INTERVAL);
}

// =======================
// END GAME (ADMIN ONLY)
// =======================
function endGame(roomId, userId) {
  const room = rooms[roomId];
  if (!room) return;

  if (!isAdmin(userId)) return;

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  room.state = "ended";
  io.to(roomId).emit("gameState", "ended");
}

// =======================
// SOCKETS
// =======================
io.on("connection", (socket) => {

  socket.on("joinRoom", ({ roomId, user }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        called: [],
        timer: null,
        state: "waiting",
        winner: null
      };
    }

    const role = isAdmin(user.id) ? "admin" : "player";

    rooms[roomId].players.push({
      id: socket.id,
      user,
      role
    });

    socket.emit("role", { role });

    io.to(roomId).emit("roomUpdate", rooms[roomId]);
  });

  // =======================
  // START GAME EVENT
  // =======================
  socket.on("startGame", ({ roomId, userId }) => {
    startGame(roomId, userId);
  });

  // =======================
  // END GAME EVENT
  // =======================
  socket.on("endGame", ({ roomId, userId }) => {
    endGame(roomId, userId);
  });

  // =======================
  // CLAIM BINGO
  // =======================
  socket.on("claimBingo", ({ roomId, marked }) => {
    const room = rooms[roomId];
    if (!room || room.state !== "running") return;

    const valid = checkWin(marked);

    if (valid) {
      room.state = "ended";
      room.winner = socket.id;

      if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
      }

      io.to(roomId).emit("winner", {
        id: socket.id
      });

      io.to(roomId).emit("gameState", "ended");
    } else {
      socket.emit("invalidBingo");
    }
  });

});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});