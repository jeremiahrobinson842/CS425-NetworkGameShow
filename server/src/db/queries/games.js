// server/src/db/queries/games.js

/**
 * Query helpers for the `games` table.
 *
 * This module provides functions to:
 * - Generate a new 6-character game code
 * - Insert a new game row and return its id + code
 *
 * It depends on:
 * - The shared database query helper in `config/db.js`
 * - The logger utility in `utils/logger.js`
 *
 * @module db/queries/games
 */

const { query } = require('../../config/db');
const logger = require('../../utils/logger');

/**
 * Generates a random 6-character alphanumeric game code.
 *
 * @returns {string} 6-character game code (e.g., "A3F9K2").
 */
function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid confusing chars
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    code += chars[idx];
  }
  return code;
}

/**
 * Inserts a new game into the database.
 *
 * @param {object} options - Settings for the game.
 * @param {string} options.mode - Game mode
 * @param {number} options.questionCount - Number of questions
 * @param {number} options.timePerQuestion - Time limit per question
 * @returns {Promise<{ id: number, code: string }>} The created game's id and code.
 */
async function createGame({ mode, questionCount, timePerQuestion }) {
  const code = generateGameCode();

  logger.debug('Creating new game', {
    mode,
    questionCount,
    timePerQuestion,
    code
  });

  const text = `
    INSERT INTO games (code, mode, question_count, time_per_question, status)
    VALUES ($1, $2, $3, $4, 'waiting')
    RETURNING id, code
  `;

  const params = [code, mode, questionCount, timePerQuestion];

  const result = await query(text, params);
  const row = result.rows[0];

  logger.info('Game created', { id: row.id, code: row.code });

  return { id: row.id, code: row.code };
}

module.exports = {
  createGame
};
