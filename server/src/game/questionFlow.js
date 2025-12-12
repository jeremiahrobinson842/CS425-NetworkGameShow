const logger = require('../utils/logger');
const { query } = require('../config/db');
const { buildLeaderboard } = require('./leaderboard');
const { getRoom } = require('./roomStore');

async function endGame(io, gameCode, totalQuestionsActuallyPlayed, precomputedLeaderboard) {
  const room = getRoom(gameCode);
  if (!room) {
    logger.warn('Attempted to end game for unknown gameCode', { gameCode });
    return;
  }

  room.status = 'completed';

  const leaderboard = precomputedLeaderboard || buildLeaderboard(room);

  try {
    for (const p of room.players.values()) {
      const username = p.username;
      const finalScore = typeof p.totalScore === 'number' ? p.totalScore : 0;

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

      let joinTimeIso = new Date().toISOString();
      if (p.joinTimeMs) {
        joinTimeIso = new Date(p.joinTimeMs).toISOString();
      }

      await query(
        `
          INSERT INTO game_participants (
            game_id,
            player_id,
            join_time,
            final_score
          )
          VALUES ($1, $2, $3, $4)
        `,
        [
          room.gameId,
          playerId,
          joinTimeIso,
          finalScore
        ]
      );
    }

    logger.info('Persisted game participants to DB', {
      gameId: room.gameId,
      gameCode,
      participantCount: room.players.size
    });
  } catch (err) {
    logger.error('Failed to persist game participants', err);
  }

  logger.info('Emitting game_ended', {
    gameCode,
    totalQuestions: totalQuestionsActuallyPlayed
  });

  io.to(gameCode).emit('game_ended', {
    gameCode,
    totalQuestions: totalQuestionsActuallyPlayed,
    finalRankings: leaderboard
  });
}

async function endQuestion(io, gameCode, options = {}) {
  const { forceGameEnd = false } = options;

  const room = getRoom(gameCode);
  if (!room) {
    logger.warn('Attempted to end question for unknown gameCode', { gameCode });
    return;
  }

  if (!room.currentQuestionActive) {
    return;
  }

  room.currentQuestionActive = false;

  if (room.currentQuestionTimeout) {
    clearTimeout(room.currentQuestionTimeout);
    room.currentQuestionTimeout = null;
  }

  const idx = room.currentQuestionIndex;
  const q = room.questions[idx];
  if (!q) {
    logger.warn('No current question found when ending question', {
      gameCode,
      currentQuestionIndex: idx
    });
    return;
  }

  room.currentQuestionStartTime = null;

  const leaderboard = buildLeaderboard(room);

  logger.info('Emitting question_ended', {
    gameCode,
    questionId: q.id,
    leaderboardSize: leaderboard.length,
    forceGameEnd
  });

  io.to(gameCode).emit('question_ended', {
    gameCode,
    questionId: q.id,
    correctAnswer: q.correct_option,
    explanation: q.explanation,
    leaderboard
  });

  const questionsPlayedSoFar = idx + 1;

  if (forceGameEnd) {
    await endGame(io, gameCode, questionsPlayedSoFar, leaderboard);
    return;
  }

  const isLastQuestion = idx >= room.questions.length - 1;

  if (isLastQuestion) {
    await endGame(io, gameCode, room.questions.length, leaderboard);
    return;
  }

  room.currentQuestionIndex += 1;

  setTimeout(() => {
    broadcastNextQuestion(io, gameCode);
  }, 5000);
}

function broadcastNextQuestion(io, gameCode) {
  const room = getRoom(gameCode);
  if (!room) {
    logger.warn('Attempted to broadcast question for unknown gameCode', { gameCode });
    return;
  }

  if (!room.questions || room.questions.length === 0) {
    logger.warn('No questions loaded for game room', { gameCode });
    return;
  }

  if (room.currentQuestionIndex >= room.questions.length) {
    logger.info('All questions have been used for this game', { gameCode });
    return;
  }

  const q = room.questions[room.currentQuestionIndex];
  room.currentQuestionStartTime = Date.now();
  room.currentQuestionActive = true;

  if (!room.answersReceived) {
    room.answersReceived = {};
  }
  room.answersReceived[String(q.id)] = 0;

  if (room.currentQuestionTimeout) {
    clearTimeout(room.currentQuestionTimeout);
    room.currentQuestionTimeout = null;
  }

  const timeLimitSeconds = room.timePerQuestion;
  const totalMs = timeLimitSeconds * 1000;

  room.currentQuestionTimeout = setTimeout(() => {
    logger.info('Question time expired, auto-ending question', {
      gameCode,
      questionId: q.id
    });
    endQuestion(io, gameCode);
  }, totalMs + 100);

  const payload = {
    id: q.id,
    text: q.text,
    options: {
      A: q.option_a,
      B: q.option_b,
      C: q.option_c,
      D: q.option_d
    },
    questionNumber: room.currentQuestionIndex + 1,
    totalQuestions: room.questions.length,
    timeLimit: timeLimitSeconds,
    serverStartTime: room.currentQuestionStartTime
  };

  logger.info('Broadcasting question to room', {
    gameCode,
    questionId: q.id,
    questionNumber: payload.questionNumber
  });

  io.to(gameCode).emit('question', payload);
}

module.exports = { endQuestion, broadcastNextQuestion, endGame };
