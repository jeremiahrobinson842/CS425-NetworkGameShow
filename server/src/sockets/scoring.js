// server/src/sockets/scoring.js

/**
 * Scoring engine for Network Game Show.
 *
 * Rules:
 * - Correct answer: 100 base points
 * - Speed bonus: up to 50 points, linear from 0s → timeLimit
 * - Wrong answer: 0 points (no bonus)
 * - "Suspicious" if answered in < 1000 ms
 */

/**
 * @typedef {Object} ComputeScoreInput
 * @property {string} answer - The chosen option letter (e.g. 'A', 'b', ' c ')
 * @property {string} correctOption - The correct option letter from DB
 * @property {number} timeLimitSeconds - Time limit for the question in seconds
 * @property {number} questionStartTimeMs - Server timestamp when question started (Date.now())
 * @property {number} submittedAtMs - Server timestamp when answer was received (Date.now())
 */

/**
 * @typedef {Object} ComputeScoreResult
 * @property {number} pointsAwarded
 * @property {number} basePoints
 * @property {number} speedBonus
 * @property {boolean} isCorrect
 * @property {number} elapsedMs
 * @property {boolean} suspicious
 */

/**
 * Normalize a raw option value to a clean single-letter code: 'A' | 'B' | 'C' | 'D'
 *
 * @param {string} raw
 * @returns {string}
 */
function normalizeOption(raw) {
  if (!raw) return '';
  // Take first non-whitespace character and uppercase it
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  return trimmed[0].toUpperCase();
}

/**
 * Compute scoring for a submitted answer.
 *
 * @param {ComputeScoreInput} input
 * @returns {ComputeScoreResult}
 */
function computeScore(input) {
  const {
    answer,
    correctOption,
    timeLimitSeconds,
    questionStartTimeMs,
    submittedAtMs
  } = input;

  const basePointsValue = 100;
  const maxBonus = 50;

  // Normalize both values before comparison
  const normalizedAnswer = normalizeOption(answer);
  const normalizedCorrect = normalizeOption(correctOption);

  const elapsedMs = Math.max(0, submittedAtMs - questionStartTimeMs);
  const totalMs = Math.max(1, timeLimitSeconds * 1000); // avoid divide by zero

  let isCorrect = false;
  let speedBonus = 0;
  let pointsAwarded = 0;

  if (normalizedAnswer && normalizedCorrect && normalizedAnswer === normalizedCorrect) {
    isCorrect = true;

    // Clamp elapsed to [0, totalMs]
    const clampedElapsed = Math.min(Math.max(elapsedMs, 0), totalMs);
    const remainingRatio = (totalMs - clampedElapsed) / totalMs; // 1.0 → 0.0

    speedBonus = Math.round(maxBonus * remainingRatio);
    pointsAwarded = basePointsValue + speedBonus;
  }

  const suspicious = elapsedMs < 1000;

  return {
    pointsAwarded,
    basePoints: isCorrect ? basePointsValue : 0,
    speedBonus: isCorrect ? speedBonus : 0,
    isCorrect,
    elapsedMs,
    suspicious
  };
}

module.exports = {
  computeScore
};
