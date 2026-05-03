const ADMIN_ID = "8294043060"; // ONLY this user is admin

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

function isAdmin(userId) {
  return String(userId) === String(ADMIN_ID);
}

function formatCallNumber(n) {
  if (n <= 15) return `B-${n}`;
  if (n <= 30) return `I-${n}`;
  if (n <= 45) return `N-${n}`;
  if (n <= 60) return `G-${n}`;
  return `O-${n}`;
}

function checkWin(marked) {
  const size = 5;

  for (let r = 0; r < size; r++) {
    if ([0,1,2,3,4].every(c => marked[r * 5 + c])) return true;
  }

  for (let c = 0; c < size; c++) {
    if ([0,1,2,3,4].every(r => marked[r * 5 + c])) return true;
  }

  if ([0,1,2,3,4].every(i => marked[i * 5 + i])) return true;
  if ([0,1,2,3,4].every(i => marked[i * 5 + (4 - i)])) return true;

  return false;
}

// START GAME
function startGame(roomId, userId) {
  const room = rooms[roomId];
  if (!room) return;

  if (!isAdmin(userId)) return; // 🔒 ONLY ADMIN CAN START

  if (room.timer || room.state === "running") return;

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

    io.to(roomId).emit("numberCalled", {
      current: formatCallNumber(n),
      history: room.called.map(formatCallNumber).reverse()
    });

  }, CALL_INTERVAL);
}

// END GAME (ADMIN ONLY)
function endGame(roomId, userId) {
  const room = rooms[roomId];
  if (!room) return;

  if (!isAdmin(userId)) return;

  if (room.timer) clearInterval(room.timer);

  room.state = "ended";
  room.timer = null;

  io.to(roomId).emit("gameState", "ended");
}

// SOCKET
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

  const exists = rooms[roomId].players.find(
    p => String(p.user.id) === String(user.id)
  );

  if (!exists) {
    rooms[roomId].players.push({
      id: socket.id,
      user
    });
  }

  socket.emit("role", {
    role: String(user.id) === ADMIN_ID ? "admin" : "player"
  });

  io.to(roomId).emit("roomUpdate", rooms[roomId]);

  console.log("joined:", user.name);
});

  socket.on("startGame", ({ roomId, userId }) => {
    startGame(roomId, userId);
  });

  socket.on("endGame", ({ roomId, userId }) => {
    endGame(roomId, userId);
  });

  socket.on("claimBingo", ({ roomId, marked }) => {
    const room = rooms[roomId];
    if (!room || room.state !== "running") return;

    if (checkWin(marked)) {
      room.state = "ended";
      room.winner = socket.id;

      if (room.timer) clearInterval(room.timer);

      io.to(roomId).emit("winner", { id: socket.id });
      io.to(roomId).emit("gameState", "ended");
    } else {
      socket.emit("invalidBingo");
    }
  });

});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});