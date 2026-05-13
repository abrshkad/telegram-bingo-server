const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const supabase = require("./supabase");

const ADMIN_ID = "8294043060";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.get("/", (req, res) => {
  res.send("Bingo server running");
});

const rooms = {};

function isAdmin(id) {
  return String(id) === String(ADMIN_ID);
}

function generateCard() {
  const nums = [];

  while (nums.length < 25) {
    const n = Math.floor(Math.random() * 75) + 1;

    if (!nums.includes(n)) {
      nums.push(n);
    }
  }

  return nums;
}

function formatNumber(n) {
  if (n <= 15) return `B-${n}`;
  if (n <= 30) return `I-${n}`;
  if (n <= 45) return `N-${n}`;
  if (n <= 60) return `G-${n}`;
  return `O-${n}`;
}

function checkWin(marked) {
  const lines = [
    [0,1,2,3,4],
    [5,6,7,8,9],
    [10,11,12,13,14],
    [15,16,17,18,19],
    [20,21,22,23,24],

    [0,5,10,15,20],
    [1,6,11,16,21],
    [2,7,12,17,22],
    [3,8,13,18,23],
    [4,9,14,19,24],

    [0,6,12,18,24],
    [4,8,12,16,20]
  ];

  return lines.some(line =>
    line.every(i => marked[i])
  );
}

async function getPlayer(user) {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("telegram_id", String(user.id))
    .single();

  return data;
}

async function createPlayer(user) {
  await supabase.from("players").insert({
    telegram_id: String(user.id),
    name: user.name,
    score: 0
  });
}

async function updateScore(userId, amount) {
  const player = await getPlayer({ id: userId });

  if (!player) return;

  await supabase
    .from("players")
    .update({
      score: player.score + amount
    })
    .eq("telegram_id", String(userId));
}

io.on("connection", (socket) => {

  socket.on("joinRoom", async ({ roomId, user }) => {

    socket.join(roomId);

    let player = await getPlayer(user);

    if (!player) {
      await createPlayer(user);
      player = await getPlayer(user);
    }

    if (player.score <= 0 && !isAdmin(user.id)) {
      socket.emit("noScore");
      return;
    }

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        state: "waiting",
        called: [],
        timer: null,
        winner: null,
        usedCards: []
      };
    }

    const room = rooms[roomId];

    let card;

    do {
      card = generateCard();
    } while (
      room.usedCards.some(
        c => JSON.stringify(c) === JSON.stringify(card)
      )
    );

    room.usedCards.push(card);

    room.players.push({
      socketId: socket.id,
      user,
      card
    });

    socket.emit("yourCard", card);

    socket.emit("role", {
      role: isAdmin(user.id) ? "admin" : "player"
    });

    socket.emit("score", player.score);

    io.to(roomId).emit("roomUpdate", room.players);
  });

  socket.on("setScore", async ({ targetId, amount, adminId }) => {

    if (!isAdmin(adminId)) return;

    const player = await getPlayer({ id: targetId });

    if (!player) return;

    await supabase
      .from("players")
      .update({
        score: amount
      })
      .eq("telegram_id", String(targetId));

    io.emit("scoreUpdated");
  });

  socket.on("startGame", ({ roomId, userId }) => {

    if (!isAdmin(userId)) return;

    const room = rooms[roomId];

    if (!room) return;

    room.state = "running";
    room.called = [];

    io.to(roomId).emit("gameState", "running");

    room.timer = setInterval(() => {

      if (room.called.length >= 75) {
        clearInterval(room.timer);
        return;
      }

      let n;

      do {
        n = Math.floor(Math.random() * 75) + 1;
      } while (room.called.includes(n));

      room.called.push(n);

      io.to(roomId).emit("numberCalled", {
        current: formatNumber(n),
        history: room.called.map(formatNumber).reverse()
      });

    }, 4000);

  });

  socket.on("claimBingo", async ({ roomId, marked, userId }) => {

    const room = rooms[roomId];

    if (!room) return;

    const valid = checkWin(marked);

    if (!valid) {
      socket.emit("invalidBingo");
      return;
    }

    clearInterval(room.timer);

    room.state = "ended";

    await updateScore(userId, 10);

    socket.emit("youWon");

    io.to(roomId).emit("winner", userId);
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("SERVER STARTED");
});