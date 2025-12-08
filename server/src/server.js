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

/**
 * In-memory game room state.
 *
 * Map<gameCode, {
 *   gameId: number,
 *   status: 'waiting' | 'in_progress' | 'completed',
 *   timePerQuestion: number,
 *   questions: Array<DBQuestionRow>,
 *   currentQuestionIndex: number,
 *   players: Map<socketId, {
 *     username: string,
 *     isHost: boolean,
 *     totalScore: number,
 *     answers: Record<questionId, {
 *       chosenOption: 'A'|'B'|'C'|'D',
 *       isCorrect: boolean,
 *       points: number,
 *       elapsedMs: number,
 *       suspicious: boolean
 *     }>
 *   }>,
 *   hostSocketId: string | null,
 *   currentQuestionStartTime: number | null,
 *   currentQuestionActive: boolean,
 *   currentQuestionTimeout: NodeJS.Timeout | null
 * }>
 */
const gameRooms = new Map();

/**
 * Creates and configures the Express application instance.
 *
 * @returns {express.Express} Configured Express app.
 */
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
 * Helper to build a simple player list for the client.
 *
 * @param {Map<string, { username: string, isHost: boolean, totalScore?: number }>} playersMap
 * @returns {Array<{ username: string, isHost: boolean, totalScore?: number }>}
 */
function buildPlayerList(playersMap) {
  return Array.from(playersMap.values()).map((p) => ({
    username: p.username,
    isHost: p.isHost,
    totalScore: p.totalScore
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
 * Ends the current question for a given game room:
 * - Marks the question as inactive
 * - Emits question_ended with correct answer, explanation, and leaderboard
 * - Either schedules next question or emits game_ended
 *
 * @param {Server} io
 * @param {string} gameCode
 */
function endQuestion(io, gameCode) {
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
  const leaderboard = Array.from(room.players.values())
    .map((p) => ({
      username: p.username,
      totalScore: p.totalScore || 0
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((p, i) => ({
      rank: i + 1,
      username: p.username,
      totalScore: p.totalScore
    }));

  logger.info('Emitting question_ended', {
    gameCode,
    questionId: q.id,
    leaderboardSize: leaderboard.length
  });

  io.to(gameCode).emit('question_ended', {
    gameCode,
    questionId: q.id,
    correctAnswer: q.correct_option,
    explanation: q.explanation,
    leaderboard
  });

  const isLastQuestion = idx >= room.questions.length - 1;

  if (isLastQuestion) {
    room.status = 'completed';

    logger.info('Emitting game_ended', {
      gameCode,
      totalQuestions: room.questions.length
    });

    io.to(gameCode).emit('game_ended', {
      gameCode,
      finalRankings: leaderboard
      // Later we can include more per-player stats here.
    });

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
            currentQuestionTimeout: null
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

        // Add to in-memory players list (extended for scoring)
        room.players.set(socket.id, {
          username,
          isHost: hostFlag,
          totalScore: 0,
          answers: {}
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
    socket.on('submit_answer', (payload, ack) => {
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

        const now = Date.now();
        const elapsedMs = now - startTime;
        const timeLimitSeconds = room.timePerQuestion;
        const totalMs = timeLimitSeconds * 1000;

        // If answer is late, treat as incorrect for now
        if (elapsedMs > totalMs) {
          logger.info('Late answer received (after time limit)', {
            socketId: socket.id,
            gameCode: normalizedCode,
            questionId,
            elapsedMs,
            totalMs
          });

          player.answers[questionId] = {
            chosenOption: answer,
            isCorrect: false,
            points: 0,
            elapsedMs,
            suspicious: false
          };

          return ack && ack({
            ok: false,
            error: 'Answer submitted after time expired',
            late: true
          });
        }

        const isCorrect = (answer === currentQuestion.correct_option);

        // Use the scoring engine
        const scoreResult = computeScore({
          isCorrect,
          elapsedMs,
          timeLimitSeconds
        });

        // Update in-memory totals
        player.totalScore += scoreResult.points;
        player.answers[questionId] = {
          chosenOption: answer,
          isCorrect,
          points: scoreResult.points,
          elapsedMs: scoreResult.clampedElapsedMs,
          suspicious: scoreResult.suspicious
        };

        logger.info('submit_answer scored', {
          gameCode: normalizedCode,
          questionId,
          username: player.username,
          isCorrect,
          points: scoreResult.points,
          basePoints: scoreResult.basePoints,
          speedBonus: scoreResult.speedBonus
        });

        // Acknowledge back to this player
        ack && ack({
          ok: true,
          isCorrect,
          pointsAwarded: scoreResult.points,
          basePoints: scoreResult.basePoints,
          speedBonus: scoreResult.speedBonus
        });

        // If all players have answered this question, end it early.
        const totalPlayers = room.players.size;
        let answeredCount = 0;
        for (const p of room.players.values()) {
          if (p.answers[questionId]) {
            answeredCount += 1;
          }
        }

        if (answeredCount >= totalPlayers) {
          logger.info('All players answered; ending question early', {
            gameCode: normalizedCode,
            questionId,
            answeredCount,
            totalPlayers
          });
          endQuestion(io, normalizedCode);
        }
      } catch (err) {
        logger.error('Error handling submit_answer', err);
        ack && ack({ ok: false, error: 'Internal server error in submit_answer' });
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

      if (gameCode) {
        const room = gameRooms.get(gameCode);
        if (room) {
          room.players.delete(socket.id);

          if (room.hostSocketId === socket.id) {
            room.hostSocketId = null;
          }

          const players = buildPlayerList(room.players);
          logger.info('Player removed from game room on disconnect', {
            gameCode,
            username,
            remainingPlayers: players.length
          });

          // Broadcast updated player list
          broadcastPlayerList(io, gameCode);
        }
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
