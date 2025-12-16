// server/src/config/env.js

/**
 * Environment configuration module for Network Game Show.
 *
 * Responsibilities:
 * - Load `.env` file using dotenv
 * - Provide typed, validated environment variables
 * - Centralize defaults so other modules never read process.env directly
 * - Expose helper flags for environment detection
 *
 * @module config/env
 */

const path = require('path');
const dotenv = require('dotenv');

// Load `.env` file explicitly
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`[env] Warning: No .env file found at ${envPath}`);
} else {
  console.log(`[env] Loaded environment from ${envPath}`);
}

/* ----------------------------- ENV VARIABLES ----------------------------- */

/**
 * Port the HTTP server listens on.
 * @type {number}
 */
const PORT = Number(process.env.PORT) || 5174;

/**
 * PostgreSQL connection string.
 * Must be provided for any DB operations.
 * @type {string}
 */
const DATABASE_URL = process.env.DATABASE_URL || '';

/**
 * Logging level for the custom logger.
 * Supported values: "debug", "info", "warn", "error"
 * @type {string}
 */
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Node environment: "development" | "production" | "test"
 * @type {string}
 */
const NODE_ENV = process.env.NODE_ENV || 'development';

/* ----------------------------- VALIDATION ----------------------------- */

function validateRequiredEnv() {
  if (!DATABASE_URL) {
    console.warn(
      '[env] Warning: DATABASE_URL is empty. Database queries will fail until it is configured.'
    );
  }
}

validateRequiredEnv();

/* ----------------------------- HELPERS ----------------------------- */

const isDev = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

/* ----------------------------- EXPORTS ----------------------------- */

module.exports = {
  PORT,
  DATABASE_URL,
  LOG_LEVEL,
  NODE_ENV,
  isDev,
  isProduction,
  isTest,
};
