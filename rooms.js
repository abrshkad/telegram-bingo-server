const rooms = {};

function createRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      players: [],
      state: "waiting",
      called: [],
      timer: null,
      winner: null
    };
  }
  return rooms[roomId];
}

function getRoom(roomId) {
  return rooms[roomId];
}

module.exports = { createRoom, getRoom };