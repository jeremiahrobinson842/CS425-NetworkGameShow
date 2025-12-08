// server/src/sockets/scoring.js

/**
 * Scoring engine for Network Game Show.
 *
 * Responsibilities:
 * - Given correctness, elapsed time, and time limit,
 *   compute base points + speed bonus.
 * - Flag suspiciously fast answers (< 1 second).
 *
 * Scoring rules:
 * - Correct answer:
 *   - Base points: 100
 *   - Speed bonus: up to 50 points, linear from full time to 0
 *     (answer at t=0s => +50, at t=timeLimit => +0)
 * - Incorrect answer:
 *   - 0 points (no negative scoring)
 *
 * @module sockets/scoring
 */

/**
 * @typedef {Object} ScoreInput
 * @property {boolean} isCorrect - Whether the answer is correct.
 * @property {number} elapsedMs - Time elapsed between question start and answer, in milliseconds.
 * @property {number} timeLimitSeconds - Time limit for the question, in seconds.
 */

/**
 * @typedef {Object} ScoreResult
 * @property {number} basePoints - Base points for correctness (0 or 100).
 * @property {number} speedBonus - Bonus points for speed (0–50).
 * @property {number} points - Total points = basePoints + speedBonus.
 * @property {number} clampedElapsedMs - Elapsed time after clamping (0..timeLimitMs).
 * @property {boolean} suspicious - True if elapsedMs < 1000ms (basic anti-cheat flag).
 */

/**
 * Compute the score for a single answer.
 *
 * @param {ScoreInput} input
 * @returns {ScoreResult}
 */
function computeScore(input) {
  const { isCorrect, elapsedMs, timeLimitSeconds } = input;

  const timeLimitMs = Math.max(0, timeLimitSeconds * 1000);

  // Clamp elapsedMs into [0, timeLimitMs]
  const clampedElapsedMs = Math.max(0, Math.min(elapsedMs, timeLimitMs));

  const suspicious = clampedElapsedMs < 1000; // < 1 second

  if (!isCorrect) {
    return {
      basePoints: 0,
      speedBonus: 0,
      points: 0,
      clampedElapsedMs,
      suspicious
    };
  }

  const basePoints = 100;

  // Linear scale:
  // - clampedElapsedMs = 0   => full bonus (50)
  // - clampedElapsedMs = limit => 0 bonus
  let speedBonus = 0;
  if (timeLimitMs > 0) {
    const timeRemainingMs = timeLimitMs - clampedElapsedMs;
    const fraction = timeRemainingMs / timeLimitMs; // 1.0 .. 0.0
    speedBonus = Math.round(50 * fraction);
  }

  const points = basePoints + speedBonus;

  return {
    basePoints,
    speedBonus,
    points,
    clampedElapsedMs,
    suspicious
  };
}

module.exports = {
  computeScore
};
