// server/src/config/env.js

/**
 * Environment configuration module for Network Game Show.
 *
 * This module:
 * - Loads environment variables from a `.env` file (using dotenv)
 * - Exposes strongly-named configuration values with defaults
 *
 * Other modules should import from this file instead of reading `process.env`
 * directly. This improves consistency and makes it easier to:
 * - Validate required environment variables
 * - Change default values in one place
 *
 * @module config/env
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the `.env` file if present.
dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});

/**
 * The port number on which the HTTP server should listen.
 * Defaults to 4000 if not specified.
 *
 * @type {number}
 */
const PORT = Number(process.env.PORT) || 4000;

/**
 * The database connection string for PostgreSQL.
 * This will be used later by the database client.
 *
 * Default is an empty string for now; you should update this once
 * your database is set up.
 *
 * @type {string}
 */
const DATABASE_URL = process.env.DATABASE_URL || '';

/**
 * The current Node environment, e.g. "development" or "production".
 *
 * @type {string}
 */
const NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  PORT,
  DATABASE_URL,
  NODE_ENV
};

