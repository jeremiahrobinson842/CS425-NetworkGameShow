import TeamGrid from './TeamGrid';

function PlayerLobby({
  username,
  setUsername,
  gameCode,
  setGameCode,
  gameMode,
  setGameMode,
  teamCount,
  selectedTeamId,
  setSelectedTeamId,
  handleJoinGame,
  handleLeaveGame,
  isTeamMode,
  lobbyTeams,
  players
}) {
  return (
    <section
      style={{
        border: '1px solid #7ed321',
        padding: '1rem',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        background: gameMode === 'team' ? '#ffe8d6' : '#e8f5e8',
        transition: 'background 300ms ease'
      }}
    >
      <h2>Player Join</h2>
      <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
        <button
          type="button"
          onClick={handleLeaveGame}
          disabled={!gameCode}
          style={{ position: 'absolute', top: 0, right: 0 }}
        >
          Leave Game
        </button>

        <form onSubmit={handleJoinGame}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Username:
            </label>
            <input
              style={{ width: '15%' }}
              maxLength={15}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Game Code:
            </label>
            <input
              style={{ width: '15%' }}
              maxLength={15}
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            />
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <p style={{ marginBottom: '0.35rem' }}>Mode:</p>
            <label style={{ marginRight: '0.75rem' }}>
              <input
                type="radio"
                name="player-mode"
                value="classic"
                checked={gameMode === 'classic'}
                onChange={() => setGameMode('classic')}
              />{' '}
              Classic
            </label>
            <label>
              <input
                type="radio"
                name="player-mode"
                value="team"
                checked={gameMode === 'team'}
                onChange={() => setGameMode('team')}
              />{' '}
              Team
            </label>
          </div>

          {gameMode === 'team' && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                Team number (ask host):
              </label>
              <input
                type="number"
                min="1"
                max={teamCount || 5}
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                style={{ width: '4rem' }}
              />
              <p style={{ margin: '0.25rem 0', color: '#555' }}>
                Team games require 2-5 teams and up to 10 total players.
              </p>
            </div>
          )}

          <button type="submit" style={{ padding: '0.4rem 0.75rem' }}>
            Join Game
          </button>
        </form>
      </div>

      <h3>Lobby</h3>
      <p>
        Game Code: <strong>{gameCode || '(none)'}</strong>
      </p>
      <p>
        Mode:{' '}
        <strong>
          {isTeamMode
            ? `Team (${teamCount || '?'} teams, max 10 players)`
            : 'Classic'}
        </strong>
      </p>

      <TeamGrid
        isTeamMode={isTeamMode}
        teams={lobbyTeams}
        players={players}
        allowDrag={false}
      />
      <p>Waiting for host to start...</p>
    </section>
  );
}

export default PlayerLobby;
