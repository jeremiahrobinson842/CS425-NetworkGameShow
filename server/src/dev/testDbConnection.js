// server/src/dev/testDbConnection.js

/**
 * Simple development script to test PostgreSQL connectivity for Network Game Show.
 *
 * This script:
 * - Runs a basic "SELECT 1" query to verify that the database is reachable
 * - Checks how many questions are currently stored in the `questions` table
 *
 * Usage (from the server folder):
 *   node src/dev/testDbConnection.js
 */

const { query } = require('../config/db');
const logger = require('../utils/logger');

async function run() {
  try {
    logger.info('Starting database connection test...');

    // Test 1: Simple SELECT 1
    const pingResult = await query('SELECT 1 AS alive', []);
    logger.info('SELECT 1 result', pingResult.rows[0]);

    // Test 2: Count questions
    const countResult = await query('SELECT COUNT(*) AS count FROM questions', []);
    const count = Number(countResult.rows[0].count);

    logger.info('Questions table row count', { count });

    console.log('\n✅ DB test completed successfully.\n');
  } catch (err) {
    logger.error('Database connection test failed', err);
    console.error('\n❌ DB test failed. See logs above for details.\n');
  } finally {
    // Ensure Node exits even if the pool keeps connections open
    process.exit(0);
  }
}

run();
