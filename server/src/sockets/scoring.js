// server/src/socket/scoring.js

/**
 * Scoring utilities for Network Game Show.
 *
 * Scoring rules:
 * - Correct answer: 100 base points.
 * - Speed bonus: up to 50 additional points, scaled linearly.
 *   - If answered immediately (elapsedMs ~ 0): +50
 *   - If answered at the last moment (elapsedMs ~ totalMs): +0
 * - Wrong answers: 0 points.
 * - Answers with elapsedMs < 1000 ms are flagged as suspicious.
 */

/**
 * Compute the score for a single answer.
 *
 * @param {Object} params
 * @param {boolean} params.isCorrect - Whether the answer was correct.
 * @param {number} params.elapsedMs - Time (ms) between question start and answer.
 * @param {number} params.timeLimitSeconds - Total time allowed for the question, in seconds.
 * @returns {{
 *   points: number,
 *   basePoints: number,
 *   speedBonus: number,
 *   suspicious: boolean,
 *   clampedElapsedMs: number
 * }}
 */
function computeScore({ isCorrect, elapsedMs, timeLimitSeconds }) {
  const totalMs = timeLimitSeconds * 1000;

  // Clamp elapsedMs to [0, totalMs]
  const clampedElapsedMs = Math.max(0, Math.min(elapsedMs, totalMs));

  if (!isCorrect) {
    return {
      points: 0,
      basePoints: 0,
      speedBonus: 0,
      suspicious: clampedElapsedMs < 1000
    };
  }

  const basePoints = 100;

  // speedBonus = floor(50 * (timeRemaining / totalTime))
  const timeRemainingMs = totalMs - clampedElapsedMs;
  const fractionRemaining = totalMs > 0 ? timeRemainingMs / totalMs : 0;
  const speedBonus = Math.max(0, Math.floor(50 * fractionRemaining));

  const suspicious = clampedElapsedMs < 1000;

  return {
    points: basePoints + speedBonus,
    basePoints,
    speedBonus,
    suspicious,
    clampedElapsedMs
  };
}

module.exports = {
  computeScore
};
