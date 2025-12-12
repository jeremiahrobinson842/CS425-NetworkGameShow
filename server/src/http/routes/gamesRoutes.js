// server/src/http/routes/gamesRoutes.js

/**
 * Games routes for the Network Game Show backend.
 *
 * This router exposes endpoints related to game creation and management.
 *
 * Endpoints:
 *   POST /api/games/create
 *     Body: { mode: string, questionCount: number, timePerQuestion: number }
 *     Response: { gameCode: string, gameId: number }
 *   GET /api/questions/random?count=N
 *     Response: Array of question objects
 *
 * @module http/routes/gamesRoutes
 */

const express = require('express');
const router = express.Router();

const logger = require('../../utils/logger');
const { createGame } = require('../../db/queries/games');

router.post('/create', async (req, res) => {
  try {
    const { mode, questionCount, timePerQuestion } = req.body;

    // Basic validation
    const parsedQuestionCount = Number(questionCount);
    const parsedTimePerQuestion = Number(timePerQuestion);
    const gameMode = mode || 'classic';

    if (
      !Number.isInteger(parsedQuestionCount) ||
      parsedQuestionCount < 5 ||
      parsedQuestionCount > 20
    ) {
      return res.status(400).json({
        error: 'questionCount must be an integer between 5 and 20.'
      });
    }

    if (
      !Number.isInteger(parsedTimePerQuestion) ||
      parsedTimePerQuestion < 10 ||
      parsedTimePerQuestion > 30
    ) {
      return res.status(400).json({
        error: 'timePerQuestion must be an integer between 10 and 30.'
      });
    }

    logger.debug('Received request to create game', {
      mode: gameMode,
      questionCount: parsedQuestionCount,
      timePerQuestion: parsedTimePerQuestion
    });

    const { id, code } = await createGame({
      mode: gameMode,
      questionCount: parsedQuestionCount,
      timePerQuestion: parsedTimePerQuestion
    });

    return res.status(201).json({
      gameId: id,
      gameCode: code
    });
  } catch (err) {
    logger.error('Error handling POST /api/games/create', err);
    return res.status(500).json({
      error: 'Internal server error while creating game.'
    });
  }
});

module.exports = router;
