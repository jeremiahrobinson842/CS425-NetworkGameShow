// server/src/http/routes/questionsRoutes.js

/**
 * Questions routes for the Network Game Show backend.
 *
 * This router exposes endpoints related to question retrieval.
 *
 * Endpoints:
 *   GET /api/questions/random?count=N
 *     Response: Array of question objects
 *
 * @module http/routes/questionsRoutes
 */

const express = require('express');
const router = express.Router();

const logger = require('../../utils/logger');
const { getRandomQuestions } = require('../../db/queries/questions');

/**
 * GET /api/questions/random
 *
 * Returns a random set of questions from the database.
 *
 * Query parameters:
 *   count (optional) - number of questions to fetch (default 10)
 *
 * @name GET/api/questions/random
 * @function
 * @memberof module:http/routes/questionsRoutes
 * @inner
 * @param {express.Request} req - The incoming HTTP request.
 * @param {express.Response} res - The HTTP response object.
 */
router.get('/random', async (req, res) => {
  try {
    const countParam = req.query.count;
    const count = countParam ? Number(countParam) : 10;

    if (!Number.isFinite(count) || count <= 0) {
      return res.status(400).json({
        error: 'count must be a positive number.'
      });
    }

    logger.debug('Received request for random questions', { count });

    const questions = await getRandomQuestions(count);

    return res.json(questions);
  } catch (err) {
    logger.error('Error handling GET /api/questions/random', err);
    return res.status(500).json({
      error: 'Internal server error while fetching questions.'
    });
  }
});

module.exports = router;
