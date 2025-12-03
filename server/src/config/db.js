// server/src/config/db.js

/**
 * PostgreSQL connection configuration using explicit fields.
 * This avoids issues with DATABASE_URL when passwords contain special characters.
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
const { NODE_ENV, DATABASE_URL } = require('./env');

// Build the configuration object
let poolConfig;

if (DATABASE_URL && DATABASE_URL.trim() !== '') {
  // If you ever want to use a URL in production, you can.
  poolConfig = { connectionString: DATABASE_URL };
} else {
  // Explicit config avoids URL-escaping problems
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'network_game_show',
  };
}

logger.info('DB pool configuration loaded', {
  ...poolConfig,
  password: '[HIDDEN]',
  env: NODE_ENV,
});

// Create pool
const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.debug('PostgreSQL client connected', { env: NODE_ENV });
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', err);
});

/**
 * Query helper
 */
function query(text, params) {
  logger.debug('Executing SQL query', {
    text,
    hasParams: Array.isArray(params) && params.length > 0,
  });
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};
