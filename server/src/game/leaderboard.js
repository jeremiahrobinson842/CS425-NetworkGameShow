function buildPlayerList(playersMap, room) {
  const teamNameLookup = room?.teams
    ? room.teams.reduce((acc, team) => {
        acc[team.id] = team.name;
        return acc;
      }, {})
    : {};

  return Array.from(playersMap.values())
    .filter((p) => !p.disconnected)
    .map((p) => ({
      username: p.username,
      isHost: p.isHost,
      totalScore: p.totalScore,
      teamId: p.teamId || null,
      teamName: p.teamId ? teamNameLookup[p.teamId] || null : null
    }));
}

function buildLeaderboard(room, allowedQuestionIds) {
  const mode = room?.mode || 'classic';

  const allowedSet = Array.isArray(allowedQuestionIds)
    ? new Set(allowedQuestionIds.map((id) => String(id)))
    : null;

  const raw = Array.from(room.players.values()).map((p) => {
    const allAnswers = Object.entries(p.answers || {});
    const answers = allowedSet
      ? allAnswers
          .filter(([qid]) => allowedSet.has(String(qid)))
          .map(([, ans]) => ans)
      : allAnswers.map(([, ans]) => ans);

    const answeredCount = answers.length;
    const correctAnswers = answers.filter((a) => a.isCorrect).length;

    const avgResponseMs =
      answeredCount > 0
        ? Math.round(
            answers.reduce((sum, a) => sum + (a.elapsedMs || 0), 0) /
              answeredCount
          )
        : null;

    const totalScore = answers.reduce(
      (sum, a) => sum + (a.pointsAwarded || 0),
      0
    );

    return {
      username: p.username,
      teamId: p.teamId || null,
      totalScore,
      correctAnswers,
      avgResponseMs,
      disconnected: !!p.disconnected
    };
  });

  if (mode !== 'team' || !room.teams || room.teams.length === 0) {
    return raw
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((p, i) => ({
        rank: i + 1,
        username: p.username,
        totalScore: p.totalScore,
        correctAnswers: p.correctAnswers,
        avgResponseMs: p.avgResponseMs,
        disconnected: p.disconnected,
        teamId: p.teamId || null
      }));
  }

  const teamLookup = new Map();

  for (const team of room.teams) {
    teamLookup.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      totalScore: 0,
      correctAnswers: 0,
      totalElapsedMs: 0,
      answerCount: 0,
      members: []
    });
  }

  for (const p of raw) {
    if (!teamLookup.has(p.teamId)) continue;
    const team = teamLookup.get(p.teamId);
    team.totalScore += p.totalScore;
    team.correctAnswers += p.correctAnswers;
    if (p.avgResponseMs != null && p.correctAnswers > 0) {
      // Weight by answered questions to avoid skew from fewer answers
      const answeredCount = p.correctAnswers || 0;
      team.totalElapsedMs += (p.avgResponseMs || 0) * answeredCount;
      team.answerCount += answeredCount;
    }
    team.members.push({
      username: p.username,
      totalScore: p.totalScore,
      disconnected: p.disconnected
    });
  }

  const teamEntries = Array.from(teamLookup.values()).map((team) => {
    const avgResponseMs =
      team.answerCount > 0
        ? Math.round(team.totalElapsedMs / team.answerCount)
        : null;

    return {
      rank: 0, // set after sort
      username: team.teamName, // maintain compatibility with existing UI
      teamName: team.teamName,
      teamId: team.teamId,
      totalScore: team.totalScore,
      correctAnswers: team.correctAnswers,
      avgResponseMs,
      members: team.members
    };
  });

  return teamEntries
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((team, idx) => ({
      ...team,
      rank: idx + 1
    }));
}

function broadcastPlayerList(io, gameCode, room) {
  if (!room) return;

  const players = buildPlayerList(room.players, room);
  const teams = buildLobbyTeams(room);
  io.to(gameCode).emit('player_list', {
    gameCode,
    players,
    playerCount: players.length,
    teams,
    teamCount: room.teamCount || (room.teams ? room.teams.length : null),
    mode: room.mode || 'classic'
  });
}

function buildLobbyTeams(room) {
  if (!room?.teams || room.teams.length === 0) return [];

  const membersByTeam = new Map();
  for (const p of room.players.values()) {
    if (p.disconnected) continue;
    const teamId = p.teamId;
    if (!teamId) continue;
    if (!membersByTeam.has(teamId)) membersByTeam.set(teamId, []);
    membersByTeam.get(teamId).push({
      username: p.username,
      isHost: p.isHost,
      disconnected: !!p.disconnected
    });
  }

  return room.teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    members: membersByTeam.get(team.id) || []
  }));
}

module.exports = {
  buildPlayerList,
  buildLeaderboard,
  buildLobbyTeams,
  broadcastPlayerList
};
