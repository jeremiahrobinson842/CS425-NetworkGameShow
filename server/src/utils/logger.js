// server/src/utils/logger.js

/**
 * Simple logging utility for the Network Game Show backend.
 *
 * This module provides three logging functions:
 * - debug: for development-only details about control flow and data
 * - info: for high-level events (server start, new connections, etc.)
 * - error: for errors and exceptions
 *
 * Other modules import these functions to log important events.
 * Centralizing logs here makes it easier to:
 * - Add timestamps consistently
 * - Change log format in one place
 * - Later swap in a more advanced logger (e.g., Winston) if needed
 *
 * @module logger
 */

/**
 * Formats the current date and time in ISO format for log messages.
 *
 * @returns {string} ISO-formatted date-time string, e.g. "2025-12-03T01:23:45.678Z".
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Logs a debug-level message to the console.
 * Debug messages are typically used for development and can be noisy.
 *
 * This will only log if the environment variable `LOG_LEVEL` is set to "debug".
 *
 * @param {string} message - The debug message to log.
 * @param {object} [meta] - Optional additional metadata to log (e.g., request IDs, payloads).
 * @returns {void}
 */
function debug(message, meta) {
  if (process.env.LOG_LEVEL !== 'debug') {
    return;
  }
  if (meta) {
    console.debug(`[${getTimestamp()}] [DEBUG] ${message}`, meta);
  } else {
    console.debug(`[${getTimestamp()}] [DEBUG] ${message}`);
  }
}

/**
 * Logs an informational message to the console.
 * Info messages are used for important but expected events:
 * - Server start
 * - New client connection
 * - Successful API calls
 *
 * @param {string} message - The informational message to log.
 * @param {object} [meta] - Optional additional metadata to log.
 * @returns {void}
 */
function info(message, meta) {
  if (meta) {
    console.log(`[${getTimestamp()}] [INFO ] ${message}`, meta);
  } else {
    console.log(`[${getTimestamp()}] [INFO ] ${message}`);
  }
}

/**
 * Logs an error-level message to the console.
 * Error messages are used for:
 * - Unexpected exceptions
 * - Failed database queries
 * - Invalid inputs causing a 4xx/5xx response
 *
 * @param {string} message - The error message to log.
 * @param {Error|object} [err] - Optional error object or additional metadata.
 * @returns {void}
 */
function error(message, err) {
  if (err instanceof Error) {
    console.error(
      `[${getTimestamp()}] [ERROR] ${message} - ${err.message}\n${err.stack}`
    );
  } else if (err) {
    console.error(`[${getTimestamp()}] [ERROR] ${message}`, err);
  } else {
    console.error(`[${getTimestamp()}] [ERROR] ${message}`);
  }
}

module.exports = {
  debug,
  info,
  error
};

