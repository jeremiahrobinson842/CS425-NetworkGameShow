// server/src/server.js

const http = require('http');
const { PORT, NODE_ENV } = require('./config/env');
const logger = require('./utils/logger');
const { createExpressApp } = require('./app');
const { createSocketServer } = require('./sockets');

function startServer() {
  const app = createExpressApp();
  const httpServer = http.createServer(app);

  createSocketServer(httpServer);

  httpServer.listen(PORT, () => {
    logger.info('Network Game Show server is running', {
      port: PORT,
      env: NODE_ENV
    });
  });

  httpServer.on('error', (err) => {
    logger.error('HTTP server encountered an error', err);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
