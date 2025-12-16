const logger = require('../../utils/logger');
const { query } = require('../../config/db');
const { getRandomQuestions } = require('../../db/queries/questions');
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

    if (room.status === 'in_progress') {
      const msg = 'Game already in progress';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    if (room.hostSocketId !== socket.id) {
      const msg = 'Only the host can start the game';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    const players = buildPlayerList(room.players, room);
    if (players.length < 2) {
      const msg = 'At least 2 players are required to start the game';
      logger.warn(msg, {
        gameCode: normalizedCode,
        playerCount: players.length
      });
      return ack && ack({ ok: false, error: msg });
    }

    if (players.length > 10) {
      const msg = 'Cannot start: maximum of 10 players allowed.';
      logger.warn(msg, { gameCode: normalizedCode, playerCount: players.length });
      return ack && ack({ ok: false, error: msg });
    }

    if (room.mode === 'team') {
      if (!room.teamCount || room.teamCount < 2 || room.teamCount > 5) {
        const msg = 'Team games require 2-5 teams. Please set team count before starting.';
        logger.warn(msg, { gameCode: normalizedCode, teamCount: room.teamCount });
        return ack && ack({ ok: false, error: msg });
      }

      const activePlayers = Array.from(room.players.values()).filter((p) => !p.disconnected);
      const teamSizes = Array.from({ length: room.teamCount }, (_, idx) => {
        const teamId = idx + 1;
        return activePlayers.filter((p) => p.teamId === teamId).length;
      });

      if (teamSizes.some((size) => size < 2)) {
        const msg = 'Each team must have at least 2 players to start.';
        logger.warn(msg, { gameCode: normalizedCode, teamSizes });
        return ack && ack({ ok: false, error: msg });
      }
    }

    // Reset room state for a new game run
    if (room.currentQuestionTimeout) {
      clearTimeout(room.currentQuestionTimeout);
      room.currentQuestionTimeout = null;
    }
    room.currentQuestionIndex = 0;
    room.currentQuestionActive = false;
    room.currentQuestionStartTime = null;
    room.answersReceived = {};
    // Reset player scores/answers/disconnected flags
    room.players.forEach((p) => {
      p.totalScore = 0;
      p.answers = {};
      p.disconnected = false;
    });

    // Always load a fresh set of questions for each game start
    const gameRes = await query(
      'SELECT question_count, time_per_question FROM games WHERE id = $1',
      [room.gameId]
    );
    const gameRow = gameRes.rows[0];
    const questionCount = gameRow.question_count;

    const questions = await getRandomQuestions(questionCount);

    room.questions = questions;
    room.timePerQuestion = gameRow.time_per_question;

    logger.info('Loaded questions for game room', {
      gameCode: normalizedCode,
      questionCount: room.questions.length
    });

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
