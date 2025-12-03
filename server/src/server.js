// server/src/server.js

/**
 * Main entry point for the Network Game Show backend server.
 *
 * Responsibilities:
 * - Initialize Express application
 * - Configure global middleware (JSON parsing, CORS)
 * - Mount HTTP routes (e.g., /health)
 * - Create HTTP server and attach Socket.io instance
 * - Start listening on the configured port
 *
 * This file coordinates other modules:
 * - Uses environment config from `config/env.js`
 * - Uses logging utilities from `utils/logger.js`
 * - Uses HTTP routing modules from `http/routes/*`
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
 * Initializes the Socket.io server and attaches basic connection logging.
 *
 * At this stage, Socket.io is only used to verify that:
 * - The WebSocket server is running
 * - Clients can connect and disconnect
 *
 * Later, this function will be extended with:
 * - join_game, start_game, submit_answer event handlers
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

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        reason
      });
    });
  });

  return io;
}

/**
 * Starts the HTTP server on the configured port.
 *
 * This function:
 * - Creates the Express app
 * - Wraps it in an HTTP server
 * - Attaches the Socket.io server
 * - Begins listening on the configured port
 *
 * Any startup errors are logged via the logger module.
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
