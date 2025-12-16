const logger = require('../../utils/logger');
const { query } = require('../../config/db');
const { createRoom, getRoom } = require('../../game/roomStore');
const { buildPlayerList, buildLobbyTeams } = require('../../game/leaderboard');

async function handleJoinGame(io, socket, payload, ack) {
  try {
    const { gameCode, username, isHost, teamId, teamCount: requestedTeamCount } = payload || {};

    if (!gameCode || !username) {
      const msg = 'Missing gameCode or username in join_game payload';
      logger.warn(msg, { socketId: socket.id, payload });
      return ack && ack({ ok: false, error: msg });
    }

    const normalizedCode = String(gameCode).trim().toUpperCase();

    const gameRes = await query(
      'SELECT id, code, question_count, time_per_question, mode FROM games WHERE code = $1',
      [normalizedCode]
    );

    if (gameRes.rows.length === 0) {
      const msg = 'Invalid game code';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    const gameRow = gameRes.rows[0];

    let room = getRoom(normalizedCode);
    if (!room) {
      room = createRoom(normalizedCode, {
        gameId: gameRow.id,
        mode: gameRow.mode || 'classic',
        status: 'waiting',
        timePerQuestion: gameRow.time_per_question,
        questions: [],
        currentQuestionIndex: 0,
        players: new Map(),
        hostSocketId: null,
        currentQuestionStartTime: null,
        currentQuestionActive: false,
        currentQuestionTimeout: null,
        answersReceived: {},
        teamCount: null,
        teams: null
      });
    }
    room.mode = gameRow.mode || room.mode || 'classic';

    // Enforce team configuration if this game is team-based
    let teamIdToUse = null;
    if (room.mode === 'team') {
      const currentTeamCount = room.teamCount;
      const parsedTeamCount = Number(requestedTeamCount);

      if (currentTeamCount == null) {
        const resolvedCount = Number.isInteger(parsedTeamCount) ? parsedTeamCount : 2;
        if (resolvedCount < 2 || resolvedCount > 5) {
          const msg = 'teamCount must be between 2 and 5 for team games';
          logger.warn(msg, { socketId: socket.id, requestedTeamCount });
          return ack && ack({ ok: false, error: msg });
        }

        room.teamCount = resolvedCount;
        room.teams = Array.from({ length: resolvedCount }, (_, idx) => ({
          id: idx + 1,
          name: `Team ${idx + 1}`
        }));
      } else if (
        Number.isInteger(parsedTeamCount) &&
        parsedTeamCount !== currentTeamCount
      ) {
        const msg = 'Team count already set for this lobby';
        logger.warn(msg, {
          socketId: socket.id,
          currentTeamCount,
          requestedTeamCount
        });
        return ack && ack({ ok: false, error: msg });
      }

      const parsedTeamId = Number(teamId);
      if (!Number.isInteger(parsedTeamId) || parsedTeamId < 1 || parsedTeamId > room.teamCount) {
        const msg = `teamId must be between 1 and ${room.teamCount} for team games`;
        logger.warn(msg, { socketId: socket.id, teamId });
        return ack && ack({ ok: false, error: msg });
      }
      teamIdToUse = parsedTeamId;
    }

    const hostFlag = !!isHost;
    socket.data.gameCode = normalizedCode;
    socket.data.username = username;
    socket.data.isHost = hostFlag;

    await socket.join(normalizedCode);

    room.players.set(socket.id, {
      username,
      isHost: hostFlag,
      totalScore: 0,
      answers: {},
      joinTimeMs: Date.now(),
      disconnected: false,
      teamId: teamIdToUse
    });

    if (hostFlag) {
      room.hostSocketId = socket.id;
    }

    const players = buildPlayerList(room.players, room);
    const teams = buildLobbyTeams(room);

    const activePlayerCount = players.length;

    if (activePlayerCount > 10) {
      const msg = 'This lobby is full. Maximum 10 players allowed.';
      logger.warn(msg, {
        socketId: socket.id,
        gameCode: normalizedCode,
        activePlayerCount
      });
      room.players.delete(socket.id);
      return ack && ack({ ok: false, error: msg });
    }

    logger.info('Player joined game room', {
      socketId: socket.id,
      gameCode: normalizedCode,
      username,
      isHost: hostFlag,
      playerCount: activePlayerCount,
      teamId: teamIdToUse,
      mode: room.mode
    });

    io.to(normalizedCode).emit('player_joined', {
      gameCode: normalizedCode,
      players,
      playerCount: activePlayerCount,
      joined: { username, isHost: hostFlag, teamId: teamIdToUse },
      teams,
      teamCount: room.teamCount,
      mode: room.mode
    });

    return ack && ack({
      ok: true,
      gameId: room.gameId,
      gameCode: normalizedCode,
      username,
      isHost: hostFlag,
      players,
      playerCount: activePlayerCount,
      teams,
      teamCount: room.teamCount,
      mode: room.mode
    });
  } catch (err) {
    logger.error('Error handling join_game', err);
    return ack && ack({ ok: false, error: 'Internal server error while joining game' });
  }
}

module.exports = { handleJoinGame };
