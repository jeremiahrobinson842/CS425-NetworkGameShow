const logger = require('../../utils/logger');
const { getRoom } = require('../../game/roomStore');
const { broadcastPlayerList } = require('../../game/leaderboard');
const { endQuestion } = require('../../game/questionFlow');

function handleDisconnect(io, socket, reason) {
  const { gameCode, username, isHost } = socket.data || {};
  logger.info('WebSocket client disconnected', {
    socketId: socket.id,
    reason,
    gameCode,
    username,
    isHost
  });

  if (!gameCode) {
    return;
  }

  const room = getRoom(gameCode);
  if (!room) {
    return;
  }

  const player = room.players.get(socket.id);
  if (player) {
    player.disconnected = true;
  }

  if (room.hostSocketId === socket.id) {
    room.hostSocketId = null;
  }

  const activePlayersCount = Array.from(room.players.values()).filter(
    (p) => !p.disconnected
  ).length;

  logger.info('Player marked disconnected', {
    gameCode,
    username,
    activePlayersCount
  });

  broadcastPlayerList(io, gameCode, room);

  if (
    room.status === 'in_progress' &&
    activePlayersCount < 2 &&
    room.currentQuestionActive
  ) {
    logger.info(
      'Active players dropped below 2; ending game early from disconnect handler',
      {
        gameCode,
        activePlayersCount
      }
    );
    endQuestion(io, gameCode, { forceGameEnd: true });
  }
}

module.exports = { handleDisconnect };
