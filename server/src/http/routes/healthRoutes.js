// server/src/http/routes/healthRoutes.js

/**
 * Health check routes for the Network Game Show backend.
 *
 * This router exposes a simple endpoint for confirming that:
 * - The Express server is running
 * - Routing is configured correctly
 *
 * Endpoint:
 *   GET /health
 *   Response: { status: 'ok', uptimeSeconds: <number> }
 *
 * @module http/routes/healthRoutes
 */

const express = require('express');
const router = express.Router();

const logger = require('../../utils/logger');

/**
 * GET /health
 *
 * Returns a basic JSON payload indicating that the server is running.
 * Also logs the health check request at debug level to verify
 * that routing and logging are wired correctly.
 *
 * @name GET/health
 * @function
 * @memberof module:http/routes/healthRoutes
 * @inner
 * @param {express.Request} req - The incoming HTTP request.
 * @param {express.Response} res - The HTTP response object.
 */
router.get('/health', (req, res) => {
  logger.debug('Health check endpoint called', {
    path: req.path,
    method: req.method
  });

  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime())
  });
});

module.exports = router;
