const logger = require('../../utils/logger');
const { query } = require('../../config/db');
const { getRoom } = require('../../game/roomStore');
const { buildPlayerList } = require('../../game/leaderboard');
const { broadcastNextQuestion } = require('../../game/questionFlow');

async function handleStartGame(io, socket, payload, ack) {
  try {
    const { gameCode } = payload || {};
    const normalizedCode = String(gameCode || socket.data.gameCode || '')
      .trim()
      .toUpperCase();

    if (!normalizedCode) {
      const msg = 'Missing gameCode in start_game payload';
      logger.warn(msg, { socketId: socket.id, payload });
      return ack && ack({ ok: false, error: msg });
    }

    const room = getRoom(normalizedCode);
    if (!room) {
      const msg = 'No in-memory room state for gameCode';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    if (room.hostSocketId !== socket.id) {
      const msg = 'Only the host can start the game';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    const players = buildPlayerList(room.players);
    if (players.length < 2) {
      const msg = 'At least 2 players are required to start the game';
      logger.warn(msg, {
        gameCode: normalizedCode,
        playerCount: players.length
      });
      return ack && ack({ ok: false, error: msg });
    }

    if (!room.questions || room.questions.length === 0) {
      const gameRes = await query(
        'SELECT question_count, time_per_question FROM games WHERE id = $1',
        [room.gameId]
      );
      const gameRow = gameRes.rows[0];
      const questionCount = gameRow.question_count;

      const qRes = await query(
        `
        SELECT id, category, text, option_a, option_b, option_c, option_d,
               correct_option, explanation, difficulty
        FROM questions
        ORDER BY random()
        LIMIT $1
      `,
        [questionCount]
      );

      room.questions = qRes.rows;
      room.timePerQuestion = gameRow.time_per_question;
      room.currentQuestionIndex = 0;

      logger.info('Loaded questions for game room', {
        gameCode: normalizedCode,
        questionCount: room.questions.length
      });
    }

    room.status = 'in_progress';

    const countdownSeconds = 5;
    io.to(normalizedCode).emit('game_starting', { countdown: countdownSeconds });

    logger.info('Game starting countdown emitted', {
      gameCode: normalizedCode,
      countdownSeconds
    });

    setTimeout(() => {
      broadcastNextQuestion(io, normalizedCode);
    }, countdownSeconds * 1000);

    return ack && ack({ ok: true });
  } catch (err) {
    logger.error('Error handling start_game', err);
    return ack && ack({ ok: false, error: 'Internal server error while starting game' });
  }
}

module.exports = { handleStartGame };
