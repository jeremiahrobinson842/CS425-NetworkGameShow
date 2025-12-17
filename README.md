# Network Game Show

Real-time multiplayer trivia game with host/player flows, synchronized questions, WebSocket-driven scoring, and in-memory room orchestration backed by PostgreSQL for persistence. Hosts create lobbies, players join via game codes, and the server drives question cadence, answer scoring, and leaderboards in real time.

## Tech stack with versions
- Node.js 24.11.1
- Express 4.22.x
- Socket.io (server) 4.8.1
- React 18.3.1 + Vite 7.2.6
- Socket.io (client) 4.8.1
- PostgreSQL (tested with `pg` 8.16.3)
- Artillery 2.0.27 (optional load testing)

## Ports and defaults
- Backend HTTP: 5174 (override with `PORT`)
- Frontend dev (Vite): 5173 (override via Vite config or `VITE_PORT`)
- API base: `http://localhost:5174` unless `VITE_API_BASE` is set
- WebSocket base: `http://localhost:5174` unless `VITE_WS_BASE` is set

## Setup instructions (step-by-step)
1) Install Node 20+ and PostgreSQL locally.
2) Create the DB: `createdb network_game_show` (or use your GUI).
3) Apply schema: `psql "postgres://<user>:<pass>@localhost:5432/network_game_show" -f sql/schema.sql` (optional seed: `sql/seed_questions.sql`).
4) Copy `server/.env.example` to `server/.env`; set `DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/network_game_show` (or fill `DB_*` vars).
5) Install backend deps: `cd server && npm install`.
6) Install frontend deps: `cd client && npm install`.
7) (Optional) In `client/.env`, set `VITE_API_BASE` and `VITE_WS_BASE` if the backend is not on `http://localhost:5174`.

## How to run application
- Backend (dev): `cd server && DATABASE_URL=... npm run dev` (listens on 5174).
- Frontend (dev): `cd client && npm run dev` (Vite on 5173; honors `VITE_API_BASE`/`VITE_WS_BASE`).
- Load test (optional): repo root `node load-test.js` (set `CLIENTS`, `ANSWER`, `HTTP_BASE`, `WS_BASE`; backend + DB must be running).

## API surface summary
- POST `/api/games/create`  
  Body: `{ mode: "classic"|"team", questionCount: int 1-50, timePerQuestion: int 10-30 }`  
  Response: `{ gameId, gameCode }`
- GET `/api/questions/random?count=N`  
  Response: `[{ id, category, text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty }]`
- Socket.io (client ↔ server):  
  - Emit: `join_game` `{ gameCode, username, isHost, teamId?, teamCount? }` → ack `{ ok, players, playerCount, teams, teamCount, mode }`  
  - Emit: `start_game` (host) `{ gameCode }` → ack `{ ok }`  
  - Emit: `submit_answer` `{ gameCode, questionId, answer }` → ack includes scoring fields  
  - Emit: `move_player_team` (host/team mode)  
  - Emit: `ping_check` → server replies `pong_check` (latency)  
  - Server emits: `game_starting`, `question`, `question_ended`, `game_ended`, `player_joined`/`player_list`, `host_left`

## Team members & roles
- Jeremiah Robinson - Product Owner
- Archie Rauenhorst - Developer
- Adam Taylor - Developer

## Known bugs/limitations
- No authentication/session; game access is only gated by game codes.
- Socket.io CORS is permissive (`origin: '*'`) in dev.
- Load-test script creates games via HTTP and needs DB & schema applied; without DB it will fail.
- Load-test script initially ran, but later ran into errors.
- Player disconnect and reconnect is not implemented.
- Cannot reliably run multiple games at once; server has trouble differentiating clocks of each game.
