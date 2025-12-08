// server/src/server.js

/**
 * Main entry point for the Network Game Show backend server.
 *
 * Responsibilities:
 * - Initialize Express application
 * - Configure global middleware (JSON parsing, CORS)
 * - Mount HTTP routes (e.g., /health, /api/games, /api/questions)
 * - Create HTTP server and attach Socket.io instance
 * - Implement real-time game lobby, start_game flow, and scoring
 *
 * @module server
 */

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { PORT, NODE_ENV } = require('./config/env');
const logger = require('./utils/logger');
const healthRoutes = require('./http/routes/healthRoutes');
const gamesRoutes = require('./http/routes/gamesRoutes');
const questionsRoutes = require('./http/routes/questionsRoutes');
const { query } = require('./config/db');
const { computeScore } = require('./sockets/scoring');

const gameRooms = new Map();

function createExpressApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/', healthRoutes);
  app.use('/api/games', gamesRoutes);
  app.use('/api/questions', questionsRoutes);

  return app;
}


/**
 * Helper to build a simple player list for the lobby/client.
 * Only includes currently connected players (disconnected are hidden from lobby).
 *
 * @param {Map<string, { username: string, isHost: boolean, totalScore?: number, disconnected?: boolean }>} playersMap
 * @returns {Array<{ username: string, isHost: boolean, totalScore?: number }>}
 */
function buildPlayerList(playersMap) {
  return Array.from(playersMap.values())
    .filter((p) => !p.disconnected)
    .map((p) => ({
      username: p.username,
      isHost: p.isHost,
      totalScore: p.totalScore
    }));
}

/**
 * Builds the leaderboard used for question_ended and game_ended.
 * Includes correctness and response time stats, as well as disconnected flag.
 *
 * @param {ReturnType<typeof gameRooms.get>} room
 * @returns {Array<{ rank: number, username: string, totalScore: number, correctAnswers: number, avgResponseMs: number|null, disconnected?: boolean }>}
 */
function buildLeaderboard(room) {
  const raw = Array.from(room.players.values()).map((p) => {
    const answers = Object.values(p.answers || {});
    const answeredCount = answers.length;
    const correctAnswers = answers.filter((a) => a.isCorrect).length;

    const avgResponseMs =
      answeredCount > 0
        ? Math.round(
            answers.reduce((sum, a) => sum + (a.elapsedMs || 0), 0) /
              answeredCount
          )
        : null;

    return {
      username: p.username,
      totalScore: p.totalScore || 0,
      correctAnswers,
      avgResponseMs,
      disconnected: !!p.disconnected
    };
  });

  return raw
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((p, i) => ({
      rank: i + 1,
      username: p.username,
      totalScore: p.totalScore,
      correctAnswers: p.correctAnswers,
      avgResponseMs: p.avgResponseMs,
      disconnected: p.disconnected
    }));
}

/**
 * Broadcasts the current player list to everyone in a room.
 *
 * @param {Server} io
 * @param {string} gameCode
 */
function broadcastPlayerList(io, gameCode) {
  const room = gameRooms.get(gameCode);
  if (!room) return;

  const players = buildPlayerList(room.players);
  io.to(gameCode).emit('player_list', {
    gameCode,
    players,
    playerCount: players.length
  });
}

/**
 * Final game end handler. Persists participants, emits game_ended.
 *
 * @param {Server} io
 * @param {string} gameCode
 * @param {number} totalQuestionsActuallyPlayed
 * @param {Array} [precomputedLeaderboard]
 */
async function endGame(io, gameCode, totalQuestionsActuallyPlayed, precomputedLeaderboard) {
  const room = gameRooms.get(gameCode);
  if (!room) {
    logger.warn('Attempted to end game for unknown gameCode', { gameCode });
    return;
  }

  room.status = 'completed';

  const leaderboard = precomputedLeaderboard || buildLeaderboard(room);

  // Persist final scores for this game into game_participants
  try {
    for (const p of room.players.values()) {
      const username = p.username;
      const finalScore = typeof p.totalScore === 'number' ? p.totalScore : 0;

      let playerId = null;

      if (username) {
        // Ensure there is a players row for this username
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

      // Convert joinTimeMs (if present) to an ISO string timestamp
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
          room.gameId,     // game_id
          playerId,        // player_id
          joinTimeIso,     // join_time
          finalScore       // final_score
        ]
      );
    }

    logger.info('Persisted game participants to DB', {
      gameId: room.gameId,
      gameCode,
      participantCount: room.players.size
    });
  } catch (err) {
    // Don’t break the game end if DB writes fail; just log.
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

/**
 * Ends the current question for a given game room:
 * - Marks the question as inactive
 * - Emits question_ended with correct answer, explanation, and leaderboard
 * - Either schedules next question or emits game_ended
 *
 * @param {Server} io
 * @param {string} gameCode
 * @param {{ forceGameEnd?: boolean }} [options]
 */
async function endQuestion(io, gameCode, options = {}) {
  const { forceGameEnd = false } = options;

  const room = gameRooms.get(gameCode);
  if (!room) {
    logger.warn('Attempted to end question for unknown gameCode', { gameCode });
    return;
  }

  if (!room.currentQuestionActive) {
    // Already ended (e.g. via timer or all-answered path)
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

  // Build leaderboard from in-memory scores
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

  // How many questions were actually played so far?
  const questionsPlayedSoFar = idx + 1;

  if (forceGameEnd) {
    // Early termination (e.g., players dropped below 2):
    // totalQuestions = questions actually asked, not the full planned set.
    await endGame(io, gameCode, questionsPlayedSoFar, leaderboard);
    return;
  }

  const isLastQuestion = idx >= room.questions.length - 1;

  if (isLastQuestion) {
    // Normal end-of-game: we used all planned questions.
    await endGame(io, gameCode, room.questions.length, leaderboard);
    return;
  }

  // Advance to next question after a short delay (e.g., 5 seconds)
  room.currentQuestionIndex += 1;

  setTimeout(() => {
    broadcastNextQuestion(io, gameCode);
  }, 5000);
}

/**
 * Broadcasts the next question for a game room and starts its timer.
 *
 * @param {Server} io
 * @param {string} gameCode
 */
function broadcastNextQuestion(io, gameCode) {
  const room = gameRooms.get(gameCode);
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

  // Clear any previous timeout
  if (room.currentQuestionTimeout) {
    clearTimeout(room.currentQuestionTimeout);
    room.currentQuestionTimeout = null;
  }

  const timeLimitSeconds = room.timePerQuestion;
  const totalMs = timeLimitSeconds * 1000;

  // Auto-end the question when the timer expires
  room.currentQuestionTimeout = setTimeout(() => {
    logger.info('Question time expired, auto-ending question', {
      gameCode,
      questionId: q.id
    });
    endQuestion(io, gameCode);
  }, totalMs + 100); // small buffer to avoid rounding issues

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
    timeLimit: timeLimitSeconds, // seconds
    serverStartTime: room.currentQuestionStartTime
  };

  logger.info('Broadcasting question to room', {
    gameCode,
    questionId: q.id,
    questionNumber: payload.questionNumber
  });

  io.to(gameCode).emit('question', payload);
}

/**
 * Initializes the Socket.io server and attaches real-time handlers.
 *
 * Features:
 * - Connection / disconnection logging
 * - join_game event with gameCode-based rooms
 * - player_joined / player_list broadcasts
 * - start_game event with countdown + question broadcast
 * - submit_answer event with scoring + early question end
 *
 * @param {http.Server} httpServer - The HTTP server to attach Socket.io to.
 * @returns {Server} The initialized Socket.io server instance.
 */
function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // TODO: tighten this in production
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    logger.info('New WebSocket client connected', { socketId: socket.id });

    // -------------------------------
    // join_game
    // -------------------------------
    socket.on('join_game', async (payload, ack) => {
      try {
        const { gameCode, username, isHost } = payload || {};

        if (!gameCode || !username) {
          const msg = 'Missing gameCode or username in join_game payload';
          logger.warn(msg, { socketId: socket.id, payload });
          if (typeof ack === 'function') {
            ack({ ok: false, error: msg });
          }
          return;
        }

        const normalizedCode = String(gameCode).trim().toUpperCase();

        // Validate game exists in DB
        const gameRes = await query(
          'SELECT id, code, question_count, time_per_question FROM games WHERE code = $1',
          [normalizedCode]
        );

        if (gameRes.rows.length === 0) {
          const msg = 'Invalid game code';
          logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
          if (typeof ack === 'function') {
            ack({ ok: false, error: msg });
          }
          return;
        }

        const gameRow = gameRes.rows[0];

        // Create or get room state
        let room = gameRooms.get(normalizedCode);
        if (!room) {
          room = {
            gameId: gameRow.id,
            status: 'waiting',
            timePerQuestion: gameRow.time_per_question,
            questions: [], // will be loaded on start_game
            currentQuestionIndex: 0,
            players: new Map(),
            hostSocketId: null,
            currentQuestionStartTime: null,
            currentQuestionActive: false,
            currentQuestionTimeout: null,
            // Track how many players have answered each questionId
            answersReceived: {} // key: questionId (string), value: count
          };
          gameRooms.set(normalizedCode, room);
        }

        const hostFlag = !!isHost;

        // Track which game this socket belongs to
        socket.data.gameCode = normalizedCode;
        socket.data.username = username;
        socket.data.isHost = hostFlag;

        // Add to Socket.io room
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

        // Notify everyone in the room
        io.to(normalizedCode).emit('player_joined', {
          gameCode: normalizedCode,
          players,
          playerCount: players.length,
          joined: { username, isHost: hostFlag }
        });

        // Also send current state back to the joining client via ack
        if (typeof ack === 'function') {
          ack({
            ok: true,
            gameId: room.gameId,
            gameCode: normalizedCode,
            username,
            isHost: hostFlag,
            players,
            playerCount: players.length
          });
        }
      } catch (err) {
        logger.error('Error handling join_game', err);
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Internal server error while joining game' });
        }
      }
    });

    // -------------------------------
    // start_game
    // -------------------------------
    socket.on('start_game', async (payload, ack) => {
      try {
        const { gameCode } = payload || {};
        const codeFromSocket = socket.data.gameCode;

        const normalizedCode = String(gameCode || codeFromSocket || '')
          .trim()
          .toUpperCase();
        if (!normalizedCode) {
          const msg = 'Missing gameCode in start_game payload';
          logger.warn(msg, { socketId: socket.id, payload });
          if (typeof ack === 'function') {
            ack({ ok: false, error: msg });
          }
          return;
        }

        const room = gameRooms.get(normalizedCode);
        if (!room) {
          const msg = 'No in-memory room state for gameCode';
          logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
          if (typeof ack === 'function') {
            ack({ ok: false, error: msg });
          }
          return;
        }

        if (room.hostSocketId !== socket.id) {
          const msg = 'Only the host can start the game';
          logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
          if (typeof ack === 'function') {
            ack({ ok: false, error: msg });
          }
          return;
        }

        const players = buildPlayerList(room.players);
        if (players.length < 2) {
          const msg = 'At least 2 players are required to start the game';
          logger.warn(msg, {
            gameCode: normalizedCode,
            playerCount: players.length
          });
          if (typeof ack === 'function') {
            ack({ ok: false, error: msg });
          }
          return;
        }

        // Load questions only once, at game start.
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

        // Mark game in progress for scoring
        room.status = 'in_progress';

        // Notify room that game is starting with a countdown
        const countdownSeconds = 3;
        io.to(normalizedCode).emit('game_starting', { countdown: countdownSeconds });

        logger.info('Game starting countdown emitted', {
          gameCode: normalizedCode,
          countdownSeconds
        });

        // After countdown, send the first question
        setTimeout(() => {
          broadcastNextQuestion(io, normalizedCode);
        }, countdownSeconds * 1000);

        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      } catch (err) {
        logger.error('Error handling start_game', err);
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Internal server error while starting game' });
        }
      }
    });

    // -------------------------------
    // submit_answer
    // -------------------------------
    /**
     * Handle answer submissions from clients (Week 3 - scoring).
     *
     * payload: {
     *   gameCode: string,
     *   questionId: number,
     *   answer: 'A' | 'B' | 'C' | 'D'
     * }
     */
    socket.on('submit_answer', async (payload, ack) => {
      try {
        const { gameCode, questionId, answer } = payload || {};

        // Prefer payload gameCode, fallback to what we stored on socket.data
        const normalizedCode = String(gameCode || socket.data.gameCode || '')
          .trim()
          .toUpperCase();

        if (!normalizedCode || !questionId || !answer) {
          const msg = 'Missing gameCode, questionId, or answer in submit_answer payload';
          logger.warn(msg, { socketId: socket.id, payload });
          return ack && ack({ ok: false, error: msg });
        }

        const room = gameRooms.get(normalizedCode);
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

        // Make sure player.answers exists
        if (!player.answers) {
          player.answers = {};
        }

        // Prevent multiple submissions for same question
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

        // --------- SCORING ---------
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

        // Update in-memory player state
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

        // --------- PERSIST ANSWER TO DATABASE ---------
        try {
          const username = player.username;
          let playerId = null;

          if (username) {
            // See if this username already exists in players
            const existingPlayerRes = await query(
              'SELECT id FROM players WHERE username = $1',
              [username]
            );

            if (existingPlayerRes.rows.length > 0) {
              playerId = existingPlayerRes.rows[0].id;
            } else {
              // Insert new player row
              const insertPlayerRes = await query(
                'INSERT INTO players (username) VALUES ($1) RETURNING id',
                [username]
              );
              playerId = insertPlayerRes.rows[0].id;
            }
          }

          // Insert the answer row
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
              room.gameId,     // which game
              playerId,        // resolved from username (may be null if something is off)
              questionId,      // currentQuestion.id
              answer,          // 'A' | 'B' | 'C' | 'D'
              isCorrect,       // boolean
              elapsedMs        // ms from scoring
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
          // Do not break gameplay if DB persist fails
          logger.error('Failed to persist answer to DB', dbErr);
        }

        // --------- ACK BACK TO CLIENT ---------
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

        // --------- TRACK ANSWERS & END EARLY IF ALL ANSWERED ---------
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

        // If all *active* players have answered and the question is still active,
        // end the question early.
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
    });

    // -------------------------------
    // disconnect
    // -------------------------------
    socket.on('disconnect', (reason) => {
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

      const room = gameRooms.get(gameCode);
      if (!room) {
        return;
      }

      const player = room.players.get(socket.id);
      if (player) {
        // Mark as disconnected but keep stats so they appear in final rankings.
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

      // Broadcast updated player list (only connected players)
      broadcastPlayerList(io, gameCode);

      // If game is in progress and we now have fewer than 2 active players,
      // end the current question (if any) and force game end.
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
        // We don't await here because disconnect is not async,
        // but endQuestion internally awaits endGame.
        endQuestion(io, gameCode, { forceGameEnd: true });
      }
    });
  });

  return io;
}

/**
 * Starts the HTTP server on the configured port.
 *
 * @returns {void}
 */
function startServer() {
  const app = createExpressApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.io server for real-time communication.
  createSocketServer(httpServer);

  httpServer.listen(PORT, () => {
    logger.info('Network Game Show server is running', {
      port: PORT,
      env: NODE_ENV
    });
  });

  // Log any unexpected errors on the HTTP server.
  httpServer.on('error', (err) => {
    logger.error('HTTP server encountered an error', err);
  });
}

// Only start the server if this file is run directly (not imported).
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};

