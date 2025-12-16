const logger = require('../../utils/logger');
const { getRoom } = require('../../game/roomStore');
const { broadcastPlayerList } = require('../../game/leaderboard');

/**
 * Allows the host to move a player to a different team during the lobby.
 * Payload: { gameCode, username, targetTeamId }
 */
async function handleMovePlayerTeam(io, socket, payload, ack) {
  try {
    const { gameCode, username, targetTeamId } = payload || {};
    const normalizedCode = String(gameCode || socket.data.gameCode || '')
      .trim()
      .toUpperCase();

    if (!normalizedCode || !username || !targetTeamId) {
      const msg = 'Missing gameCode, username, or targetTeamId in move_player_team payload';
      logger.warn(msg, { socketId: socket.id, payload });
      return ack && ack({ ok: false, error: msg });
    }

    const room = getRoom(normalizedCode);
    if (!room) {
      const msg = 'No in-memory room state for gameCode';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    if (room.hostSocketId !== socket.id) {
      const msg = 'Only the host can move players between teams';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    if (room.status !== 'waiting') {
      const msg = 'Cannot move players after the game has started';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode, status: room.status });
      return ack && ack({ ok: false, error: msg });
    }

    if (room.mode !== 'team') {
      const msg = 'Team reassignment is only available in team mode';
      logger.warn(msg, { socketId: socket.id, gameCode: normalizedCode, mode: room.mode });
      return ack && ack({ ok: false, error: msg });
    }

    const teamIdNum = Number(targetTeamId);
    if (
      !Number.isInteger(teamIdNum) ||
      teamIdNum < 1 ||
      !room.teamCount ||
      teamIdNum > room.teamCount
    ) {
      const msg = `targetTeamId must be between 1 and ${room.teamCount || 5}`;
      logger.warn(msg, { socketId: socket.id, targetTeamId, teamCount: room.teamCount });
      return ack && ack({ ok: false, error: msg });
    }

    const playerEntry = Array.from(room.players.values()).find(
      (p) => p.username === username
    );
    if (!playerEntry) {
      const msg = 'Player not found in this lobby';
      logger.warn(msg, { socketId: socket.id, username, gameCode: normalizedCode });
      return ack && ack({ ok: false, error: msg });
    }

    playerEntry.teamId = teamIdNum;

    logger.info('Player moved to a new team', {
      gameCode: normalizedCode,
      username,
      targetTeamId: teamIdNum
    });

    broadcastPlayerList(io, normalizedCode, room);

    return ack && ack({ ok: true });
  } catch (err) {
    logger.error('Error handling move_player_team', err);
    return ack && ack({
      ok: false,
      error: 'Internal server error while moving player between teams'
    });
  }
}

module.exports = { handleMovePlayerTeam };
