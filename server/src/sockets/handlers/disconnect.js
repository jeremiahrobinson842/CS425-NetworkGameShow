const logger = require('../../utils/logger');
const { getRoom, gameRooms } = require('../../game/roomStore');
const { broadcastPlayerList } = require('../../game/leaderboard');
const { endQuestion, endGame } = require('../../game/questionFlow');

async function handleDisconnect(io, socket, reason) {
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

  if (isHost && room.status === 'waiting') {
    logger.info('Host left lobby before start; disconnecting remaining players', {
      gameCode
    });
    io.to(gameCode).emit('host_left');
    const sockets = await io.in(gameCode).fetchSockets();
    for (const s of sockets) {
      if (s.id !== socket.id) {
        await s.leave(gameCode);
        s.disconnect(true);
      }
    }
    gameRooms.delete(gameCode);
    return;
  }

  if (
    room.status === 'in_progress' &&
    activePlayersCount < 2
  ) {
    logger.info('Active players dropped below 2; ending game early from disconnect handler', {
      gameCode,
      activePlayersCount
    });

    if (room.currentQuestionActive) {
      endQuestion(io, gameCode, { forceGameEnd: true });
    } else {
      const questionsPlayed = Math.min(
        room.currentQuestionIndex || 0,
        Array.isArray(room.questions) ? room.questions.length : 0
      );
      const allowedQuestionIds = Array.isArray(room.questions)
        ? room.questions.slice(0, questionsPlayed).map((q) => q.id)
        : [];
      endGame(io, gameCode, questionsPlayed, allowedQuestionIds);
    }
  }
}

module.exports = { handleDisconnect };
