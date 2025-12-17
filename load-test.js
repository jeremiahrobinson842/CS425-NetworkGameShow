// load-test.js
// Quick Socket.io load test without Artillery.
// Usage:
//   HTTP_BASE=http://localhost:5174 WS_BASE=http://localhost:5174 CLIENTS=10 node load-test.js
// Optional envs: MODE, QUESTION_COUNT, TIME_PER_Q, HOST_START_DELAY_MS, SPREAD_JOIN_MS, ANSWER, GAME_CODE, TEST_DURATION_MS.

const { io } = require('./client/node_modules/socket.io-client');

const HTTP_BASE = process.env.HTTP_BASE || 'http://localhost:5174';
const WS_BASE = process.env.WS_BASE || HTTP_BASE;
const CLIENTS = Number(process.env.CLIENTS || 20);
const MODE = process.env.MODE || 'classic';
const QUESTION_COUNT = Number(process.env.QUESTION_COUNT || 5);
const TIME_PER_Q = Number(process.env.TIME_PER_Q || 20);
const HOST_START_DELAY_MS = Number(process.env.HOST_START_DELAY_MS || 2000);
const SPREAD_JOIN_MS = Number(process.env.SPREAD_JOIN_MS || 0);
const MEASURE_LATENCY = process.env.MEASURE_LATENCY !== 'false'; // default on
const ANSWER = (process.env.ANSWER || 'A').trim() || 'A';
const GAME_CODE = process.env.GAME_CODE ? String(process.env.GAME_CODE).trim().toUpperCase() : null;
const TEST_DURATION_MS = Number(process.env.TEST_DURATION_MS || 45000);
const fs = require('fs');
const path = require('path');

const OUT_FILE = process.env.OUT_FILE || path.join(__dirname, 'load-test.log');
function log(...args) {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(line);
  fs.appendFileSync(OUT_FILE, line + '\n');
}
async function createGameViaHttp() {
  const res = await fetch(`${HTTP_BASE}/api/games/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: MODE,
      questionCount: QUESTION_COUNT,
      timePerQuestion: TIME_PER_Q
    })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.gameCode) {
    throw new Error(`create game failed: ${res.status} ${res.statusText} ${JSON.stringify(data)}`);
  }
  return data;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectClient(idx, gameCode, asHost) {
  return new Promise((resolve) => {
    const socket = io(WS_BASE, { transports: ['websocket'], reconnection: false });
    const username = asHost ? `host${idx}` : `user${idx}`;
    let lastQuestionSentAt = null;

    socket.on('connect_error', (err) => {
      console.error(`[c${idx}] connect_error`, err.message);
      resolve();
    });

    socket.on('disconnect', (reason) => {
      console.log(`[c${idx}] disconnected ${reason}`);
      resolve();
    });

    socket.on('connect', () => {
      console.log(`[c${idx}] connected`);
      const payload = { gameCode, username, isHost: asHost };
      socket.emit('join_game', payload, (ack) => {
        if (!ack?.ok) {
          console.error(`[c${idx}] join failed`, ack?.error);
          return resolve();
        }
        console.log(`[c${idx}] joined; players=${ack.playerCount}`);
        if (asHost) {
          setTimeout(() => {
            socket.emit('start_game', { gameCode }, (ack2) => {
              if (!ack2?.ok) console.error(`[c${idx}] start_game failed`, ack2?.error);
              else console.log(`[c${idx}] start_game ok`);
            });
          }, HOST_START_DELAY_MS);
        }
      });
    });

    socket.on('question', (q) => {
      if (MEASURE_LATENCY) lastQuestionSentAt = Date.now();
      socket.emit(
        'submit_answer',
        { gameCode, questionId: q.id, answer: ANSWER },
        (ack) => {
          if (!ack?.ok) {
            console.error(`[c${idx}] answer failed`, ack?.error);
          } else if (MEASURE_LATENCY && lastQuestionSentAt) {
            const rtt = Date.now() - lastQuestionSentAt;
            console.log(`[c${idx}] answer ack in ${rtt} ms`);
          }
        }
      );
    });

    socket.on('game_ended', (payload) => {
      console.log(`[c${idx}] game_ended totalQuestions=${payload?.totalQuestions}`);
      setTimeout(() => socket.disconnect(), 500);
    });
  });
}

async function main() {
  console.log('Starting Socket.io load test');
  let gameCode = GAME_CODE;

  if (!gameCode) {
    const created = await createGameViaHttp();
    gameCode = created.gameCode;
    console.log('Created game', gameCode, 'id', created.gameId);
  } else {
    console.log('Using provided GAME_CODE', gameCode);
  }

  const clients = [];
  for (let i = 0; i < CLIENTS; i += 1) {
    const asHost = i === 0;
    if (SPREAD_JOIN_MS > 0 && i > 0) await delay(SPREAD_JOIN_MS);
    clients.push(connectClient(i, gameCode, asHost));
  }

  setTimeout(() => {
    console.log('Test duration elapsed; closing');
    process.exit(0);
  }, TEST_DURATION_MS);

  await Promise.all(clients);
}

main().catch((err) => {
  console.error('Test failed', err);
  process.exit(1);
});
