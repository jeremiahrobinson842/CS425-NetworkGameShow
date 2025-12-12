function buildPlayerList(playersMap) {
  return Array.from(playersMap.values())
    .filter((p) => !p.disconnected)
    .map((p) => ({
      username: p.username,
      isHost: p.isHost,
      totalScore: p.totalScore
    }));
}

function buildLeaderboard(room) {
  const raw = Array.from(room.players.values()).map((p) => {
    const answers = Object.values(p.answers || {});
    const answeredCount = answers.length;
    const correctAnswers = answers.filter((a) => a.isCorrect).length;

    const avgResponseMs =
      answeredCount > 0
        ? Math.round(
            answers.reduce((sum, a) => sum + (a.elapsedMs || 0), 0) /
              answeredCount
          )
        : null;

    return {
      username: p.username,
      totalScore: p.totalScore || 0,
      correctAnswers,
      avgResponseMs,
      disconnected: !!p.disconnected
    };
  });

  return raw
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((p, i) => ({
      rank: i + 1,
      username: p.username,
      totalScore: p.totalScore,
      correctAnswers: p.correctAnswers,
      avgResponseMs: p.avgResponseMs,
      disconnected: p.disconnected
    }));
}

function broadcastPlayerList(io, gameCode, room) {
  if (!room) return;

  const players = buildPlayerList(room.players);
  io.to(gameCode).emit('player_list', {
    gameCode,
    players,
    playerCount: players.length
  });
}

module.exports = { buildPlayerList, buildLeaderboard, broadcastPlayerList };
