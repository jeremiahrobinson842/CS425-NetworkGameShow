const { Server } = require('socket.io');
const logger = require('../utils/logger');
const { handleJoinGame } = require('./handlers/joinGame');
const { handleStartGame } = require('./handlers/startGame');
const { handleSubmitAnswer } = require('./handlers/submitAnswer');
const { handleDisconnect } = require('./handlers/disconnect');
const { handleMovePlayerTeam } = require('./handlers/movePlayerTeam');

function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // TODO: tighten this in production
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    logger.info('New WebSocket client connected', { socketId: socket.id });

    socket.on('join_game', (payload, ack) => handleJoinGame(io, socket, payload, ack));
    socket.on('start_game', (payload, ack) => handleStartGame(io, socket, payload, ack));
    socket.on('move_player_team', (payload, ack) => handleMovePlayerTeam(io, socket, payload, ack));
    socket.on('submit_answer', (payload, ack) => handleSubmitAnswer(io, socket, payload, ack));
    socket.on('disconnect', (reason) => handleDisconnect(io, socket, reason));
  });

  return io;
}

module.exports = {
  createSocketServer
};
