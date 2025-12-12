const logger = require('../../utils/logger');
const { query } = require('../../config/db');
const { createRoom, getRoom } = require('../../game/roomStore');
const { buildPlayerList } = require('../../game/leaderboard');

async function handleJoinGame(io, socket, payload, ack) {
  try {
    const { gameCode, username, isHost } = payload || {};

    if (!gameCode || !username) {
      const msg = 'Missing gameCode or username in join_game payload';
      logger.warn(msg, { socketId: socket.id, payload });
      return ack && ack({ ok: false, error: msg });
    }

    const normalizedCode = String(gameCode).trim().toUpperCase();

    const gameRes = await query(
      'SELECT id, code, question_count, time_per_question FROM games WHERE code = $1',
      [normalizedCode]
    );

    if (gameRes.rows.length === 0) {
      const msg = 'Invalid game code';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    const gameRow = gameRes.rows[0];

    let room = getRoom(normalizedCode);
    if (!room) {
      room = createRoom(normalizedCode, {
        gameId: gameRow.id,
        status: 'waiting',
        timePerQuestion: gameRow.time_per_question,
        questions: [],
        currentQuestionIndex: 0,
        players: new Map(),
        hostSocketId: null,
        currentQuestionStartTime: null,
        currentQuestionActive: false,
        currentQuestionTimeout: null,
        answersReceived: {}
      });
    }

    const hostFlag = !!isHost;
    socket.data.gameCode = normalizedCode;
    socket.data.username = username;
    socket.data.isHost = hostFlag;

    await socket.join(normalizedCode);

    room.players.set(socket.id, {
      username,
      isHost: hostFlag,
      totalScore: 0,
      answers: {},
      joinTimeMs: Date.now(),
      disconnected: false
    });

    if (hostFlag) {
      room.hostSocketId = socket.id;
    }

    const players = buildPlayerList(room.players);

    logger.info('Player joined game room', {
      socketId: socket.id,
      gameCode: normalizedCode,
      username,
      isHost: hostFlag,
      playerCount: players.length
    });

    io.to(normalizedCode).emit('player_joined', {
      gameCode: normalizedCode,
      players,
      playerCount: players.length,
      joined: { username, isHost: hostFlag }
    });

    return ack && ack({
      ok: true,
      gameId: room.gameId,
      gameCode: normalizedCode,
      username,
      isHost: hostFlag,
      players,
      playerCount: players.length
    });
  } catch (err) {
    logger.error('Error handling join_game', err);
    return ack && ack({ ok: false, error: 'Internal server error while joining game' });
  }
}

module.exports = { handleJoinGame };
