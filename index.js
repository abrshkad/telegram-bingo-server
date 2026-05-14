const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const ADMIN_ID = "8294043060";

const SUPABASE_URL = "https://rrrrmbdlwrzsqqgpayxe.supabase.co";

const SUPABASE_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycnJtYmRsd3J6c3FxZ3BheXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODU3MDAsImV4cCI6MjA5NDI2MTcwMH0.WR_sBEPAJA_-g9htyQ5cvVLJZNPar44w45-tngOELd8";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const app = express();

app.use(cors());

app.get("/", (req, res) => {
  res.send("Bingo server running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const rooms = {};

function generateCard() {

  const nums = [];

  while (nums.length < 25) {

    const n =
      Math.floor(Math.random() * 75) + 1;

    if (!nums.includes(n)) {
      nums.push(n);
    }
  }

  return nums;
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

function formatNumber(n) {

  if (n <= 15) return `B-${n}`;
  if (n <= 30) return `I-${n}`;
  if (n <= 45) return `N-${n}`;
  if (n <= 60) return `G-${n}`;

  return `O-${n}`;
}

io.on("connection", (socket) => {

  socket.on("joinRoom", async ({ roomId, user }) => {

    console.log("JOIN:", user.name);

    try {

      if (!rooms[roomId]) {

        rooms[roomId] = {
          players: [],
          called: [],
          timer: null,
          gameStarted: false,
          joinCost: 10,
          winReward: 50
        };
      }

      const room = rooms[roomId];

      // FIXED PLAYER FETCH
      const { data: existingPlayers } =
        await supabase
          .from("players")
          .select("*")
          .eq("telegram_id", String(user.id));

      let player = existingPlayers[0];

      // CREATE PLAYER
      if (!player) {

        const { data: newPlayer } =
          await supabase
            .from("players")
            .insert({
              telegram_id: String(user.id),
              name: user.name,
              score: 100
            })
            .select()
            .single();

        player = newPlayer;
      }

      // LOW SCORE
      if (player.score < room.joinCost) {

        socket.emit("notEnoughScore");

        return;
      }

      // REMOVE JOIN COST
      await supabase
        .from("players")
        .update({
          score: player.score - room.joinCost
        })
        .eq("telegram_id", String(user.id));

      socket.join(roomId);

      const card = generateCard();

      room.players.push({
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        card,
        marked: []
      });

      socket.emit("yourCard", card);

      socket.emit(
        "yourScore",
        player.score - room.joinCost
      );

      socket.emit("role", {
        role:
          String(user.id) === ADMIN_ID
            ? "admin"
            : "player"
      });

      io.to(roomId).emit(
        "players",
        room.players
      );

      console.log("SUCCESS JOIN");

    } catch (err) {

      console.log(err);

      socket.emit("joinError");
    }

  });

  // START GAME
  socket.on(
    "startGame",
    ({ roomId, userId }) => {

      if (
        String(userId) !== ADMIN_ID
      ) return;

      const room = rooms[roomId];

      if (
        !room ||
        room.gameStarted
      ) return;

      room.gameStarted = true;

      io.to(roomId).emit(
        "gameStarted"
      );

      room.timer = setInterval(() => {

        if (
          room.called.length >= 75
        ) {

          clearInterval(room.timer);

          return;
        }

        let n;

        do {

          n =
            Math.floor(
              Math.random() * 75
            ) + 1;

        } while (
          room.called.includes(n)
        );

        room.called.push(n);

        io.to(roomId).emit(
          "newNumber",
          {
            current: formatNumber(n),

            history:
              room.called
                .map(formatNumber)
                .reverse()
          }
        );

      }, 5000);

    }
  );

  // CLAIM BINGO
  socket.on(
    "claimBingo",
    async ({ roomId, marked }) => {

      const room = rooms[roomId];

      if (!room) return;

      const valid =
        checkWin(marked);

      if (!valid) {

        socket.emit(
          "invalidBingo"
        );

        return;
      }

      const winner =
        room.players.find(
          p =>
            p.socketId ===
            socket.id
        );

      if (!winner) return;

      const {
        data: winnerPlayers
      } = await supabase
        .from("players")
        .select("*")
        .eq(
          "telegram_id",
          String(winner.userId)
        );

      const player =
        winnerPlayers[0];

      await supabase
        .from("players")
        .update({
          score:
            player.score +
            room.winReward
        })
        .eq(
          "telegram_id",
          String(winner.userId)
        );

      clearInterval(room.timer);

      io.to(roomId).emit(
        "winner",
        {
          userId: winner.userId,
          name: winner.name
        }
      );

    }
  );

});

server.listen(3000, () => {

  console.log(
    "Server running on port 3000"
  );

});