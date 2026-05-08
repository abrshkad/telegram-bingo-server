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
  cors: {
    origin: "*"
  }
});

const rooms = {};

function isAdmin(id) {
  return String(id) === String(ADMIN_ID);
}

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("joinRoom", ({ roomId, user }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: []
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

    console.log(user.name, "joined as", role);
  });
});

server.listen(3000, () => {
  console.log("running on 3000");
});