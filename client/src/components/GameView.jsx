function LeaderboardList({ leaderboard, isTeamMode, myTeamId, username }) {
  return (
    <ol>
      {leaderboard.map((entry) => (
        <li
          key={entry.teamId || entry.username}
          style={{
            fontWeight:
              (isTeamMode
                ? entry.teamId && entry.teamId === myTeamId
                : entry.username === username)
                ? 'bold'
                : 'normal'
          }}
        >
          #{entry.rank} – {entry.teamName || entry.username} ({entry.totalScore} pts)
          {entry.disconnected && ' (disconnected)'}
        </li>
      ))}
    </ol>
  );
}

function FinalLeaderboard({ totalQuestions, formattedFinalLeaderboard }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3>Game Over – Final Rankings</h3>

      {formattedFinalLeaderboard.length === 0 ? (
        <p>No rankings available.</p>
      ) : (
        <>
          {totalQuestions && <p>Total Questions: {totalQuestions}</p>}

          <pre
            style={{
              background: '#f7f7f7',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              overflowX: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
              fontSize: '0.95rem'
            }}
          >
            {formattedFinalLeaderboard.join('\n')}
          </pre>
        </>
      )}
    </div>
  );
}

function GameView({
  handleLeaveGame,
  countdown,
  question,
  gameEnded,
  questionNumberLabel,
  timeRemaining,
  handleAnswerClick,
  lastAnswer,
  lastQuestionSummary,
  betweenRoundCountdown,
  leaderboard,
  isTeamMode,
  myTeamId,
  username,
  formattedFinalLeaderboard,
  totalQuestions,
  latencyMs
}) {
  return (
    <section
      style={{
        border: '1px solid #999',
        padding: '1rem',
        borderRadius: '0.5rem',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Game View</h2>
        <button type="button" onClick={handleLeaveGame}>
          Leave Game
        </button>
      </div>
      <p style={{ margin: '0.35rem 0' }}>
        Latency: <strong>{latencyMs != null ? `${latencyMs} ms` : '...'}</strong>
      </p>

      {countdown !== null && !question && !gameEnded && (
        <p>Game starting in: {countdown}...</p>
      )}

      {question && !gameEnded && (
        <>
          <p>{questionNumberLabel}</p>
          <h3>{question.text}</h3>
          <div style={{ marginBottom: '1rem' }}>
            <button
              style={{ display: 'block', margin: '0.25rem 0' }}
              onClick={() => handleAnswerClick('A')}
            >
              A) {question.options.A}
            </button>
            <button
              style={{ display: 'block', margin: '0.25rem 0' }}
              onClick={() => handleAnswerClick('B')}
            >
              B) {question.options.B}
            </button>
            <button
              style={{ display: 'block', margin: '0.25rem 0' }}
              onClick={() => handleAnswerClick('C')}
            >
              C) {question.options.C}
            </button>
            <button
              style={{ display: 'block', margin: '0.25rem 0' }}
              onClick={() => handleAnswerClick('D')}
            >
              D) {question.options.D}
            </button>
          </div>
          <p>Time remaining {timeRemaining !== null ? `${timeRemaining}s` : '...'}</p>

          {lastAnswer && (
            <p>
              {lastAnswer.isCorrect
                ? `Correct! +${lastAnswer.pointsAwarded} points (base ${lastAnswer.basePoints}, bonus ${lastAnswer.speedBonus})`
                : 'Incorrect.'}
            </p>
          )}
        </>
      )}

      {!question && lastQuestionSummary && !gameEnded && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Question Result</h3>
          {lastAnswer && (
            <>
              <p>
                {lastAnswer.isCorrect ? 'Correct!' : 'Incorrect.'} You earned {lastAnswer.pointsAwarded}{' '}
                points this round (base {lastAnswer.basePoints}, speed bonus {lastAnswer.speedBonus}).
              </p>
              <p>Your total score: {lastAnswer.totalScoreAfter}</p>
              {lastAnswer.suspicious && (
                <p style={{ color: 'orange' }}>
                  Note: Your answer was extremely fast and may be flagged as suspicious.
                </p>
              )}
            </>
          )}

          <p>
            Correct answer: <strong>{lastQuestionSummary.correctAnswer}</strong>
          </p>
          <p>{lastQuestionSummary.explanation}</p>

          <h4>Leaderboard</h4>
          <LeaderboardList
            leaderboard={leaderboard}
            isTeamMode={isTeamMode}
            myTeamId={myTeamId}
            username={username}
          />

          <p>
            Next round starts in {betweenRoundCountdown !== null ? betweenRoundCountdown : '...'}s
          </p>
        </div>
      )}

      {gameEnded && (
        <FinalLeaderboard
          totalQuestions={totalQuestions}
          formattedFinalLeaderboard={formattedFinalLeaderboard}
        />
      )}

      {!question && !lastQuestionSummary && !gameEnded && countdown === null && (
        <p>No question active yet. Host must start the game.</p>
      )}
    </section>
  );
}

export default GameView;
