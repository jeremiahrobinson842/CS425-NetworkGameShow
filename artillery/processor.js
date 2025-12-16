const http = require('node:http');
const https = require('node:https');

let cachedGameCode = null;

function ensureGameCode(context, events, done) {
  if (cachedGameCode) {
    context.vars.gameCode = cachedGameCode;
    return done();
  }

  const envGameCode = process.env.GAME_CODE;
  if (envGameCode) {
    cachedGameCode = envGameCode.trim().toUpperCase();
    context.vars.gameCode = cachedGameCode;
    events.emit('log', `Using provided GAME_CODE ${cachedGameCode}`);
    return done();
  }

  const target = process.env.ARTILLERY_TARGET || context.config.target || 'http://localhost:5174';
  const url = new URL('/api/games/create', target);

  const payload = JSON.stringify({
    mode: process.env.GAME_MODE || 'classic',
    questionCount: Number(process.env.QUESTION_COUNT) || 5,
    timePerQuestion: Number(process.env.TIME_PER_QUESTION) || 15
  });

  const client = url.protocol === 'https:' ? https : http;

  const req = client.request(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    },
    (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 300) {
          const err = new Error(`Failed to create game (status ${res.statusCode}): ${body}`);
          events.emit('error', err);
          return done(err);
        }

        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (err) {
          events.emit('error', err);
          return done(err);
        }

        const code = parsed.gameCode || parsed.code;
        if (!code) {
          const err = new Error('Game creation response missing gameCode');
          events.emit('error', err);
          return done(err);
        }

        cachedGameCode = String(code).trim().toUpperCase();
        context.vars.gameCode = cachedGameCode;
        events.emit('log', `Created game ${cachedGameCode} for load test`);
        return done();
      });
    }
  );

  req.on('error', (err) => {
    events.emit('error', err);
    done(err);
  });

  req.write(payload);
  req.end();
}

module.exports = { ensureGameCode };
