import TeamGrid from './TeamGrid';

function HostLobby({
  username,
  setUsername,
  handleLeaveGame,
  handleCreateGame,
  questionSelectionLocked,
  disableCreateGame,
  gameCode,
  gameMode,
  setGameMode,
  teamCount,
  setTeamCount,
  selectedTeamId,
  setSelectedTeamId,
  questionPreset,
  handleSelectPreset,
  customQuestionCount,
  handleCustomQuestionCountChange,
  questionCount,
  handleStartGame,
  canStart,
  teamReadiness,
  isTeamMode,
  allowTeamDrag,
  lobbyTeams,
  players,
  onMovePlayerTeam,
  latencyMs
}) {
  return (
    <section
      style={{
        border: '1px solid #4a90e2',
        padding: '1rem',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        background: gameMode === 'team' ? '#f3e8ff' : '#eaf6ff',
        transition: 'background 300ms ease'
      }}
    >
      <h2>Host Dashboard</h2>
      <p style={{ marginTop: '0.25rem', marginBottom: '0.75rem' }}>
        Latency: <strong>{latencyMs != null ? `${latencyMs} ms` : '...'}</strong>
      </p>
      <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
        <button
          type="button"
          onClick={handleLeaveGame}
          disabled={!gameCode}
          style={{ position: 'absolute', top: 0, right: 0 }}
        >
          Leave Game
        </button>
        <label>
          Username:{' '}
          <input
            maxLength={15}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
      </div>
      <form onSubmit={handleCreateGame}>
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ marginBottom: '0.5rem' }}>Mode:</p>
          <label style={{ marginRight: '0.75rem' }}>
            <input
              type="radio"
              name="mode"
              value="classic"
              checked={gameMode === 'classic'}
              onChange={() => setGameMode('classic')}
              disabled={questionSelectionLocked}
            />{' '}
            Classic (individual)
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="team"
              checked={gameMode === 'team'}
              onChange={() => setGameMode('team')}
              disabled={questionSelectionLocked}
            />{' '}
            Team
          </label>
        </div>

        <div
          style={{
            marginBottom: '0.75rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            minHeight: '2rem'
          }}
        >
          {gameMode === 'team' ? (
            <>
              <label>
                Number of teams (2-5):{' '}
                <input
                  type="number"
                  min="2"
                  max="5"
                  value={teamCount}
                  onChange={(e) => setTeamCount(Number(e.target.value))}
                  style={{ width: '4rem' }}
                  disabled={questionSelectionLocked}
                />
              </label>
              <label>
                Host team #:{' '}
                <input
                  type="number"
                  min="1"
                  max={teamCount || 5}
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                  style={{ width: '3.5rem' }}
                  disabled={questionSelectionLocked}
                />
              </label>
              <p style={{ margin: 0, color: '#555' }}>
                Team games allow up to 10 players, at least 2 per team.
              </p>
            </>
          ) : null}
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ marginBottom: '0.5rem' }}>Questions:</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleSelectPreset('short')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.4rem',
                border: '1px solid #4a90e2',
                background: questionPreset === 'short' ? '#91e24b' : 'transparent',
                color: questionPreset === 'short' ? '#fff' : '#000'
              }}
              disabled={questionSelectionLocked}
            >
              Short (5)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('normal')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.4rem',
                border: '1px solid #4a90e2',
                background: questionPreset === 'normal' ? '#e29b4b' : 'transparent',
                color: questionPreset === 'normal' ? '#fff' : '#000'
              }}
              disabled={questionSelectionLocked}
            >
              Normal (10)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('long')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.4rem',
                border: '1px solid #4a90e2',
                background: questionPreset === 'long' ? '#e2694b' : 'transparent',
                color: questionPreset === 'long' ? '#fff' : '#000'
              }}
              disabled={questionSelectionLocked}
            >
              Long (20)
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Custom:
              <input
                type="number"
                min="1"
                max="50"
                value={customQuestionCount}
                onChange={handleCustomQuestionCountChange}
                placeholder="1-50"
                style={{ width: '4.5rem' }}
                disabled={questionSelectionLocked}
              />
            </label>
          </div>
          <p style={{ marginTop: '0.35rem' }}>
            Selected: <strong>{questionCount}</strong> questions
          </p>
        </div>
        <p>Time per question: 20 seconds</p>
        <button type="submit" disabled={questionSelectionLocked || disableCreateGame}>
          Create Game
        </button>
      </form>

      <h3>Lobby</h3>
      <p>
        Game Code: <strong>{gameCode || 'Create a game to get a code'}</strong>
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
        allowDrag={allowTeamDrag}
        onMovePlayer={onMovePlayerTeam}
      />

      <button onClick={handleStartGame} disabled={!canStart}>
        Start Game
      </button>
      {!canStart && (
        <p style={{ color: '#888' }}>
          {isTeamMode
            ? teamReadiness.message || 'Waiting for teams to be ready.'
            : 'Waiting for at least 2 players to join before starting.'}
        </p>
      )}
    </section>
  );
}

export default HostLobby;
