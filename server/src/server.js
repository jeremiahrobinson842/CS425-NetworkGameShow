// server/src/server.js

/**
 * Main entry point for the Network Game Show backend server.
 *
 * Responsibilities:
 * - Initialize Express application
 * - Configure global middleware (JSON parsing, CORS)
 * - Mount HTTP routes (e.g., /health, /api/games, /api/questions)
 * - Create HTTP server and attach Socket.io instance
 * - Implement basic real-time game lobby + start_game flow
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

/**
 * In-memory game room state.
 *
 * Map<gameCode, {
 *   gameId: number,
 *   timePerQuestion: number,
 *   questions: Array<DBQuestionRow>,
 *   currentQuestionIndex: number,
 *   players: Map<socketId, { username: string, isHost: boolean }>,
 *   hostSocketId: string | null,
 *   currentQuestionStartTime: number | null
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
 * @param {Map<string, { username: string, isHost: boolean }>} playersMap
 * @returns {Array<{ username: string, isHost: boolean }>}
 */
function buildPlayerList(playersMap) {
  return Array.from(playersMap.values()).map((p) => ({
    username: p.username,
    isHost: p.isHost
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
 * Broadcasts the next question for a game room.
 *
 * This is a minimal version for Week 2:
 * - Picks a question from room.questions[currentQuestionIndex]
 * - Emits a `question` event with text, options, questionNumber, totalQuestions, timeLimit
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
    // In Week 3, we will emit a game_ended event here.
    return;
  }

  const q = room.questions[room.currentQuestionIndex];
  room.currentQuestionStartTime = Date.now();

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
    timeLimit: room.timePerQuestion, // seconds
    serverStartTime: room.currentQuestionStartTime
  };

  logger.info('Broadcasting question to room', {
    gameCode,
    questionId: q.id,
    questionNumber: payload.questionNumber
  });

  io.to(gameCode).emit('question', payload);

  // NOTE: For Week 2, we are not yet handling answer submission or timer end.
  // That will come in Week 3 with scoring and question lifecycle.
}

/**
 * Initializes the Socket.io server and attaches basic real-time handlers.
 *
 * Features implemented for Week 2:
 * - Connection / disconnection logging
 * - join_game event with gameCode-based rooms
 * - player_joined / player_list broadcasts
 * - start_game event with countdown + first question broadcast
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

    // Join game lobby
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
            timePerQuestion: gameRow.time_per_question,
            questions: [], // will be loaded on start_game
            currentQuestionIndex: 0,
            players: new Map(),
            hostSocketId: null,
            currentQuestionStartTime: null
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

        // Add to in-memory players list
        room.players.set(socket.id, {
          username,
          isHost: hostFlag
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

    // Start game (host only)
    socket.on('start_game', async (payload, ack) => {
      try {
        const { gameCode } = payload || {};
        const codeFromSocket = socket.data.gameCode;

        const normalizedCode = String(gameCode || codeFromSocket || '').trim().toUpperCase();
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
          logger.warn(msg, { gameCode: normalizedCode, playerCount: players.length });
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

    // Handle disconnection
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
