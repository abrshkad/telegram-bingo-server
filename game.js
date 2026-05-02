const CALL_INTERVAL = 5000;

function format(n) {
  if (n <= 15) return `B-${n}`;
  if (n <= 30) return `I-${n}`;
  if (n <= 45) return `N-${n}`;
  if (n <= 60) return `G-${n}`;
  return `O-${n}`;
}

function startGame(io, roomId) {
  const room = require("./rooms").getRoom(roomId);
  if (!room || room.timer) return;

  room.state = "running";
  room.called = [];

  io.to(roomId).emit("gameState", "running");

  room.timer = setInterval(() => {
    if (room.called.length >= 75) return;

    let n;
    do {
      n = Math.floor(Math.random() * 75) + 1;
    } while (room.called.includes(n));

    room.called.push(n);

    io.to(roomId).emit("numberCalled", {
      current: format(n),
      history: room.called.map(format).reverse()
    });

  }, CALL_INTERVAL);
}

function endGame(io, roomId) {
  const room = require("./rooms").getRoom(roomId);
  if (!room) return;

  clearInterval(room.timer);
  room.timer = null;

  room.state = "ended";

  io.to(roomId).emit("gameState", "ended");
}

module.exports = { startGame, endGame };