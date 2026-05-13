const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const ADMIN_ID = "8294043060";

const supabase = createClient(
  "https://rrrrmbdlwrzsqqgpayxe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycnJtYmRsd3J6c3FxZ3BheXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODU3MDAsImV4cCI6MjA5NDI2MTcwMH0.WR_sBEPAJA_-g9htyQ5cvVLJZNPar44w45-tngOELd8"
);

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const rooms = {};

function isAdmin(id) {
  return String(id) === ADMIN_ID;
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

io.on("connection", (socket) => {

  socket.on("joinRoom", async ({ roomId, user }) => {

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        called: [],
        gameRunning: false,
        interval: null,
        winnerPrize: 50,
        joinCost: 10
      };
    }

    const room = rooms[roomId];

    let { data: player } = await supabase
      .from("players")
      .select("*")
      .eq("telegram_id", String(user.id))
      .single();

    if (!player) {
      await supabase.from("players").insert({
        telegram_id: String(user.id),
        name: user.name,
        score: 100
      });

      player = {
        telegram_id: String(user.id),
        name: user.name,
        score: 100
      };
    }

    if (player.score < room.joinCost) {
      socket.emit("notEnoughScore");
      return;
    }

    await supabase
      .from("players")
      .update({
        score: player.score - room.joinCost
      })
      .eq("telegram_id", String(user.id));

    let card;

    while (true) {

      card = generateCard();

      const duplicate = room.players.find(p =>
        JSON.stringify(p.card) === JSON.stringify(card)
      );

      if (!duplicate) break;
    }

    room.players.push({
      socketId: socket.id,
      user,
      card,
      marked: []
    });

    socket.emit("yourCard", card);

    socket.emit("yourScore", player.score - room.joinCost);

    socket.emit("role", {
      role: isAdmin(user.id) ? "admin" : "player"
    });

    io.to(roomId).emit("roomPlayers", room.players);

  });

  socket.on("setSettings", ({ roomId, joinCost, winnerPrize, userId }) => {

    if (!isAdmin(userId)) return;

    const room = rooms[roomId];

    room.joinCost = joinCost;
    room.winnerPrize = winnerPrize;

    io.to(roomId).emit("settingsUpdated", {
      joinCost,
      winnerPrize
    });
  });

  socket.on("startGame", ({ roomId, userId }) => {

    if (!isAdmin(userId)) return;

    const room = rooms[roomId];

    if (room.gameRunning) return;

    room.gameRunning = true;
    room.called = [];

    io.to(roomId).emit("gameStarted");

    room.interval = setInterval(() => {

      if (room.called.length >= 75) {
        clearInterval(room.interval);
        return;
      }

      let n;

      do {
        n = Math.floor(Math.random() * 75) + 1;
      } while (room.called.includes(n));

      room.called.push(n);

      io.to(roomId).emit("newNumber", {
        current: formatNumber(n),
        history: room.called.map(formatNumber).reverse()
      });

    }, 5000);

  });

  socket.on("claimBingo", async ({ roomId, userId }) => {

    const room = rooms[roomId];

    if (!room.gameRunning) return;

    clearInterval(room.interval);

    room.gameRunning = false;

    const { data: player } = await supabase
      .from("players")
      .select("*")
      .eq("telegram_id", String(userId))
      .single();

    await supabase
      .from("players")
      .update({
        score: player.score + room.winnerPrize
      })
      .eq("telegram_id", String(userId));

    io.to(roomId).emit("winner", {
      userId
    });

  });

});

app.get("/", (req, res) => {
  res.send("Bingo server running");
});

server.listen(3000, () => {
  console.log("server running");
});