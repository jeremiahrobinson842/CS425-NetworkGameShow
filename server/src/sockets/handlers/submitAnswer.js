const logger = require('../../utils/logger');
const { query } = require('../../config/db');
const { computeScore } = require('../scoring');
const { getRoom } = require('../../game/roomStore');
const { endQuestion } = require('../../game/questionFlow');

async function handleSubmitAnswer(io, socket, payload, ack) {
  try {
    const { gameCode, questionId, answer } = payload || {};

    const normalizedCode = String(gameCode || socket.data.gameCode || '')
      .trim()
      .toUpperCase();

    if (!normalizedCode || !questionId || !answer) {
      const msg = 'Missing gameCode, questionId, or answer in submit_answer payload';
      logger.warn(msg, { socketId: socket.id, payload });
      return ack && ack({ ok: false, error: msg });
    }

    const room = getRoom(normalizedCode);
    if (!room || room.status !== 'in_progress') {
      const msg = 'Game is not active for submit_answer';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    const currentQuestion = room.questions[room.currentQuestionIndex];
    if (!currentQuestion || currentQuestion.id !== questionId) {
      const msg = 'Question is not currently active for this game';
      logger.warn(msg, {
        socketId: socket.id,
        gameCode: normalizedCode,
        questionId,
        activeQuestionId: currentQuestion && currentQuestion.id
      });
      return ack && ack({ ok: false, error: msg });
    }

    const player = room.players.get(socket.id);
    if (!player) {
      const msg = 'Player is not registered in this game room';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    if (!player.answers) {
      player.answers = {};
    }

    if (player.answers[questionId]) {
      const msg = 'Answer already submitted for this question';
      logger.warn(msg, {
        socketId: socket.id,
        gameCode: normalizedCode,
        questionId
      });
      return ack && ack({ ok: false, error: msg });
    }

    const startTime = room.currentQuestionStartTime;
    if (!startTime) {
      const msg = 'Question timing not initialized on server';
      logger.warn(msg, {
        socketId: socket.id,
        gameCode: normalizedCode,
        questionId
      });
      return ack && ack({ ok: false, error: msg });
    }

    const now = Date.now();

    const scoreResult = computeScore({
      answer,
      correctOption: currentQuestion.correct_option,
      timeLimitSeconds: room.timePerQuestion,
      questionStartTimeMs: startTime,
      submittedAtMs: now
    });

    const {
      pointsAwarded,
      basePoints,
      speedBonus,
      isCorrect,
      elapsedMs,
      suspicious
    } = scoreResult;

    if (typeof player.totalScore !== 'number') {
      player.totalScore = 0;
    }
    player.totalScore += pointsAwarded;

    player.answers[questionId] = {
      chosenOption: answer,
      isCorrect,
      pointsAwarded,
      basePoints,
      speedBonus,
      elapsedMs,
      suspicious
    };

    logger.debug('Answer scored in memory', {
      gameCode: normalizedCode,
      username: player.username,
      questionId,
      pointsAwarded,
      totalScore: player.totalScore,
      isCorrect,
      elapsedMs,
      suspicious
    });

    try {
      const username = player.username;
      let playerId = null;

      if (username) {
        const existingPlayerRes = await query(
          'SELECT id FROM players WHERE username = $1',
          [username]
        );

        if (existingPlayerRes.rows.length > 0) {
          playerId = existingPlayerRes.rows[0].id;
        } else {
          const insertPlayerRes = await query(
            'INSERT INTO players (username) VALUES ($1) RETURNING id',
            [username]
          );
          playerId = insertPlayerRes.rows[0].id;
        }
      }

      await query(
        `
          INSERT INTO answers (
            game_id,
            player_id,
            question_id,
            chosen_option,
            is_correct,
            response_time_ms,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
        [
          room.gameId,
          playerId,
          questionId,
          answer,
          isCorrect,
          elapsedMs
        ]
      );

      logger.debug('Persisted answer to DB', {
        gameId: room.gameId,
        playerId,
        questionId,
        chosenOption: answer,
        isCorrect,
        responseTimeMs: elapsedMs
      });
    } catch (dbErr) {
      logger.error('Failed to persist answer to DB', dbErr);
    }

    ack &&
      ack({
        ok: true,
        pointsAwarded,
        basePoints,
        speedBonus,
        elapsedMs,
        isCorrect,
        suspicious,
        totalScore: player.totalScore
      });

    if (!room.answersReceived) {
      room.answersReceived = {};
    }

    const questionKey = String(questionId);
    room.answersReceived[questionKey] =
      (room.answersReceived[questionKey] || 0) + 1;

    const totalActivePlayers = Array.from(room.players.values()).filter(
      (p) => !p.disconnected
    ).length;

    logger.debug('Answer count updated for question', {
      gameCode: normalizedCode,
      questionId,
      answersForQuestion: room.answersReceived[questionKey],
      totalActivePlayers
    });

    if (
      room.currentQuestionActive &&
      room.answersReceived[questionKey] >= totalActivePlayers &&
      totalActivePlayers > 0
    ) {
      logger.info('All active players answered, ending question early', {
        gameCode: normalizedCode,
        questionId
      });
      await endQuestion(io, normalizedCode);
    }
  } catch (err) {
    logger.error('Error handling submit_answer', err);
    return ack && ack({
      ok: false,
      error: 'Internal server error while submitting answer'
    });
  }
}

module.exports = { handleSubmitAnswer };
