const gameRooms = new Map();

function getRoom(code) {
  return gameRooms.get(code);
}

function createRoom(code, initialState) {
  const room = { ...initialState };
  gameRooms.set(code, room);
  return room;
}

function upsertRoom(code, updater) {
  const current = gameRooms.get(code);
  const next = updater(current);
  gameRooms.set(code, next);
  return next;
}

module.exports = { gameRooms, getRoom, createRoom, upsertRoom };
