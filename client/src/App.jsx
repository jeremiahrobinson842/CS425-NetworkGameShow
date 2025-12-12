// client/src/App.jsx
import { useEffect, useState, useRef } from 'react';
import { getSocket } from './lib/socket';

function App() {
  const [view, setView] = useState('host'); // 'host' or 'player'

  // Shared game state
  const [gameCode, setGameCode] = useState('');
  const [gameId, setGameId] = useState(null); // currently not displayed, but fine to keep
  const [username, setUsername] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const presetQuestionCounts = {
    short: 5,
    normal: 10,
    long: 20
  };
  const [questionPreset, setQuestionPreset] = useState('normal');
  const [questionCount, setQuestionCount] = useState(presetQuestionCounts.normal);
  const [customQuestionCount, setCustomQuestionCount] = useState('');

  // Game-start + question state
  const [countdown, setCountdown] = useState(null);
  const [question, setQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Timer interval for question countdown
  const timerIntervalRef = useRef(null);
  // Timer interval for pre-game countdown
  const countdownIntervalRef = useRef(null);
  // Timer interval for between-round countdown
  const betweenRoundIntervalRef = useRef(null);

  // Per-question feedback for THIS player
  const [lastAnswer, setLastAnswer] = useState(null); // result of your last submit
  const [lastQuestionSummary, setLastQuestionSummary] = useState(null); // correct answer, explanation

  // Leaderboard for current / last question
  const [leaderboard, setLeaderboard] = useState([]);

  // Game-end state
  const [gameEnded, setGameEnded] = useState(false);
  const [finalRankings, setFinalRankings] = useState([]);
  const [finalTotalQuestions, setFinalTotalQuestions] = useState(null);
  const [betweenRoundCountdown, setBetweenRoundCountdown] = useState(null);

  const socket = getSocket();

  // Attach socket.io listeners once
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    function onConnect() {
      console.log('Socket connected:', socket.id);
    }

    function onDisconnect(reason) {
      console.log('Socket disconnected:', reason);
    }

    function onPlayerJoined(payload) {
      console.log('player_joined', payload);
      setPlayers(payload.players || []);
    }

    function onPlayerList(payload) {
      console.log('player_list', payload);
      setPlayers(payload.players || []);
    }

    function onGameStarting(payload) {
      console.log('game_starting', payload);
      // Clear any previous countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      setCountdown(payload.countdown);

      // Reset between games
      setLastAnswer(null);
      setLastQuestionSummary(null);
      setLeaderboard([]);
      setGameEnded(false);
      setFinalRankings([]);
      setFinalTotalQuestions(null);
      setBetweenRoundCountdown(null);

      // Local ticking countdown (server only sends the starting value)
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) return prev;
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    function onQuestion(payload) {
      console.log('question', payload);
      setQuestion(payload);
      setCountdown(null);
      setBetweenRoundCountdown(null);

      if (betweenRoundIntervalRef.current) {
        clearInterval(betweenRoundIntervalRef.current);
        betweenRoundIntervalRef.current = null;
      }

      // Clear any previous timer to avoid overlaps/flashing
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      // New question -> reset time + per-question UI bits
      setTimeRemaining(null);
      setLastAnswer(null);
      setLastQuestionSummary(null);

      // Setup client-side timer based on serverStartTime + timeLimit
      const totalMs = payload.timeLimit * 1000;
      const start = payload.serverStartTime;
      const endTime = start + totalMs;

      function updateTimer() {
        const now = Date.now();
        const remainingMs = endTime - now;
        if (remainingMs <= 0) {
          setTimeRemaining(0);
          return false;
        }
        setTimeRemaining(Math.ceil(remainingMs / 1000));
        return true;
      }

      updateTimer(); // initial snapshot

      timerIntervalRef.current = setInterval(() => {
        const stillRunning = updateTimer();
        if (!stillRunning) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      }, 250);
    }

    function onQuestionEnded(payload) {
      console.log('question_ended', payload);

      // Stop timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimeRemaining(0);

      // End of this question
      setQuestion(null);
      setBetweenRoundCountdown(5);

      // Store summary + leaderboard for UI
      setLastQuestionSummary({
        gameCode: payload.gameCode,
        questionId: payload.questionId,
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation
      });

      setLeaderboard(payload.leaderboard || []);

      // Start local between-round countdown (server waits ~5s)
      if (betweenRoundIntervalRef.current) {
        clearInterval(betweenRoundIntervalRef.current);
        betweenRoundIntervalRef.current = null;
      }
      betweenRoundIntervalRef.current = setInterval(() => {
        setBetweenRoundCountdown((prev) => {
          if (prev === null) return prev;
          if (prev <= 1) {
            clearInterval(betweenRoundIntervalRef.current);
            betweenRoundIntervalRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    function onGameEnded(payload) {
      console.log('game_ended', payload);

      // Stop any timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      setTimeRemaining(null);
      setQuestion(null);
      setCountdown(null);
      setBetweenRoundCountdown(null);
      setGameEnded(true);
      setLastQuestionSummary(null); // clear per-question UI so we only see final screen
      setFinalTotalQuestions(
        typeof payload.totalQuestions === 'number'
          ? payload.totalQuestions
          : null
      );
      setFinalRankings(payload.finalRankings || []);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('player_joined', onPlayerJoined);
    socket.on('player_list', onPlayerList);
    socket.on('game_starting', onGameStarting);
    socket.on('question', onQuestion);
    socket.on('question_ended', onQuestionEnded);
    socket.on('game_ended', onGameEnded);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('player_joined', onPlayerJoined);
      socket.off('player_list', onPlayerList);
      socket.off('game_starting', onGameStarting);
      socket.off('question', onQuestion);
      socket.off('question_ended', onQuestionEnded);
      socket.off('game_ended', onGameEnded);

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (betweenRoundIntervalRef.current) {
        clearInterval(betweenRoundIntervalRef.current);
        betweenRoundIntervalRef.current = null;
      }
    };
  }, [socket]);

  function handleSelectPreset(presetKey) {
    const value = presetQuestionCounts[presetKey];
    setQuestionPreset(presetKey);
    setQuestionCount(value);
    setCustomQuestionCount('');
  }

  function handleCustomQuestionCountChange(e) {
    const raw = e.target.value;
    setCustomQuestionCount(raw);
    const parsed = Number(raw);
    if (!raw) {
      setQuestionPreset('custom');
      return;
    }
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 50) {
      if (parsed === presetQuestionCounts.short) {
        setQuestionPreset('short');
      } else if (parsed === presetQuestionCounts.normal) {
        setQuestionPreset('normal');
      } else if (parsed === presetQuestionCounts.long) {
        setQuestionPreset('long');
      } else {
        setQuestionPreset('custom');
      }
      setQuestionCount(parsed);
    }
  }

  // Host: create game via REST then join via join_game
  async function handleCreateGame(e) {
    e.preventDefault();
    if (!username) {
      alert('Enter a host username first.');
      return;
    }

    const chosenCountRaw =
      customQuestionCount !== '' ? Number(customQuestionCount) : Number(questionCount);
    const parsedQuestionCount = chosenCountRaw;
    if (
      !Number.isInteger(parsedQuestionCount) ||
      parsedQuestionCount < 1 ||
      parsedQuestionCount > 50
    ) {
      alert('Question count must be an integer between 1 and 50.');
      return;
    }

    const body = {
      mode: 'classic',
      questionCount: parsedQuestionCount,
      timePerQuestion: 20
    };

    try {
      const res = await fetch('http://localhost:4000/api/games/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok || !data?.gameCode || !data?.gameId) {
        const msg =
          data && data.error
            ? data.error
            : 'Failed to create game. Please try again.';
        alert(msg);
        return;
      }

      console.log('Created game:', data);

      setGameCode(data.gameCode);
      setGameId(data.gameId);
      setIsHost(true);

      socket.emit(
        'join_game',
        { gameCode: data.gameCode, username, isHost: true },
        (ack) => {
          console.log('join_game ack (host):', ack);
          if (!ack?.ok) {
            alert('Failed to join game as host: ' + (ack && ack.error));
          } else {
            setPlayers(ack.players || []);
          }
        }
      );
    } catch (err) {
      console.error(err);
      alert('Failed to create game. Please check your connection and try again.');
    }
  }

  // Player: join existing game via join_game
  function handleJoinGame(e) {
    e.preventDefault();
    if (!username || !gameCode) {
      alert('Enter both game code and username.');
      return;
    }

    setIsHost(false);

    socket.emit(
      'join_game',
      { gameCode, username, isHost: false },
      (ack) => {
        console.log('join_game ack (player):', ack);
        if (!ack.ok) {
          alert('Failed to join game: ' + ack.error);
        } else {
          setGameId(ack.gameId);
          setPlayers(ack.players || []);
        }
      }
    );
  }

  function handleStartGame() {
    if (!gameCode) {
      alert('No gameCode set.');
      return;
    }
    socket.emit('start_game', { gameCode }, (ack) => {
      console.log('start_game ack:', ack);
      if (!ack.ok) {
        alert('Could not start game: ' + ack.error);
      }
    });
  }

  // Answer click handler -> emits submit_answer
  function handleAnswerClick(optionLetter) {
    if (!question) {
      alert('No active question.');
      return;
    }
    if (!gameCode) {
      alert('No gameCode set.');
      return;
    }

    const payload = {
      gameCode,
      questionId: question.id,
      answer: optionLetter
    };

    console.log('Emitting submit_answer', payload);

    socket.emit('submit_answer', payload, (ack) => {
      console.log('submit_answer ack:', ack);

      if (!ack || !ack.ok) {
        alert('Failed to submit answer: ' + (ack && ack.error));
        return;
      }

      // Store what happened for THIS player on THIS question
      setLastAnswer({
        chosenOption: optionLetter,
        pointsAwarded: ack.pointsAwarded,
        basePoints: ack.basePoints,
        speedBonus: ack.speedBonus,
        elapsedMs: ack.elapsedMs,
        isCorrect: ack.isCorrect,
        suspicious: ack.suspicious,
        totalScoreAfter: ack.totalScore
      });
    });
  }

  // Basic render helpers
  const playerCount = players.length;
  const canStart = isHost && playerCount >= 2;
  const totalQuestions = finalTotalQuestions; // convenience alias for JSX

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'system-ui' }}>
      <h1>Network Game Show – Real-Time Core</h1>

      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => setView('host')}
          style={{ marginRight: '0.5rem' }}
        >
          Host View
        </button>
        <button onClick={() => setView('player')}>Player View</button>
      </div>

      <section
        style={{
          border: '1px solid #ccc',
          padding: '1rem',
          marginBottom: '1rem',
          borderRadius: '0.5rem'
        }}
      >
        <h2>Common Info</h2>
        <div>
          <label>
            Username:{' '}
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
        </div>
        <div>
          <strong>Current Game Code:</strong> {gameCode || '(none yet)'}
        </div>
        <div>
          <strong>Player Count:</strong> {playerCount}
        </div>
      </section>

      {view === 'host' ? (
        <section
          style={{
            border: '1px solid #4a90e2',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem'
          }}
        >
          <h2>Host Dashboard</h2>
          <form onSubmit={handleCreateGame}>
            <p>Mode: Classic (fixed for now)</p>
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
                    background:
                      questionPreset === 'short' ? '#4a90e2' : 'transparent',
                    color: questionPreset === 'short' ? '#fff' : '#000'
                  }}
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
                    background:
                      questionPreset === 'normal' ? '#4a90e2' : 'transparent',
                    color: questionPreset === 'normal' ? '#fff' : '#000'
                  }}
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
                    background:
                      questionPreset === 'long' ? '#4a90e2' : 'transparent',
                    color: questionPreset === 'long' ? '#fff' : '#000'
                  }}
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
                  />
                </label>
              </div>
              <p style={{ marginTop: '0.35rem' }}>
                Selected: <strong>{questionCount}</strong> questions
              </p>
            </div>
            <p>Time per question: 20 seconds (fixed for now)</p>
            <button type="submit">Create Game</button>
          </form>

          <h3>Lobby</h3>
          <p>
            Game Code:{' '}
            <strong>{gameCode || 'Create a game to get a code'}</strong>
          </p>
          <ul>
            {players.map((p) => (
              <li key={p.username}>
                {p.username} {p.isHost ? '(Host)' : ''}
              </li>
            ))}
          </ul>
          <button onClick={handleStartGame} disabled={!canStart}>
            Start Game (requires ≥ 2 players)
          </button>
          {!canStart && isHost && (
            <p style={{ color: '#888' }}>
              Waiting for at least 2 players to join before starting.
            </p>
          )}
        </section>
      ) : (
        <section
          style={{
            border: '1px solid #7ed321',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem'
          }}
        >
          <h2>Player Join</h2>
          <form onSubmit={handleJoinGame}>
            <div>
              <label>
                Game Code:{' '}
                <input
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                />
              </label>
            </div>
            <button type="submit">Join Game</button>
          </form>

          <h3>Lobby</h3>
          <p>
            Game Code: <strong>{gameCode || '(none)'}</strong>
          </p>
          <ul>
            {players.map((p) => (
              <li key={p.username}>
                {p.username} {p.isHost ? '(Host)' : ''}
              </li>
            ))}
          </ul>
          <p>Waiting for host to start...</p>
        </section>
      )}

      <section
        style={{
          border: '1px solid #999',
          padding: '1rem',
          borderRadius: '0.5rem'
        }}
      >
        <h2>Game View (Shared)</h2>

        {/* Starting countdown */}
        {countdown !== null && !question && !gameEnded && (
          <p>Game starting in: {countdown}...</p>
        )}

        {/* Active question */}
        {question && !gameEnded && (
          <>
            <p>
              Question {question.questionNumber} of {question.totalQuestions}
            </p>
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
            <p>
              Time remaining{' '}
              {timeRemaining !== null ? `${timeRemaining}s` : '...'}
            </p>

            {lastAnswer && (
              <p>
                {lastAnswer.isCorrect
                  ? `Correct! +${lastAnswer.pointsAwarded} points (base ${lastAnswer.basePoints}, bonus ${lastAnswer.speedBonus})`
                  : 'Incorrect.'}
              </p>
            )}
          </>
        )}

        {/* Between questions: feedback + leaderboard */}
        {!question && lastQuestionSummary && !gameEnded && (
          <div style={{ marginTop: '1rem' }}>
            <h3>Question Result</h3>
            {lastAnswer && (
              <>
                <p>
                  {lastAnswer.isCorrect ? 'Correct!' : 'Incorrect.'}{' '}
                  You earned {lastAnswer.pointsAwarded} points this round
                  (base {lastAnswer.basePoints}, speed bonus{' '}
                  {lastAnswer.speedBonus}).
                </p>
                <p>Your total score: {lastAnswer.totalScoreAfter}</p>
                {lastAnswer.suspicious && (
                  <p style={{ color: 'orange' }}>
                    Note: Your answer was extremely fast and may be flagged as
                    suspicious.
                  </p>
                )}
              </>
            )}

            <p>
              Correct answer:{' '}
              <strong>{lastQuestionSummary.correctAnswer}</strong>
            </p>
            <p>{lastQuestionSummary.explanation}</p>

            <h4>Leaderboard</h4>
            <ol>
              {leaderboard.map((entry) => (
                <li
                  key={entry.username}
                  style={{
                    fontWeight:
                      entry.username === username ? 'bold' : 'normal'
                  }}
                >
                  #{entry.rank} – {entry.username} ({entry.totalScore} pts)
                  {entry.disconnected && ' (disconnected)'}
                </li>
              ))}
            </ol>

            <p>
              Next round starts in{' '}
              {betweenRoundCountdown !== null ? betweenRoundCountdown : '...'}s
            </p>
          </div>
        )}

        {/* Final game results */}
        {gameEnded && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3>Game Over – Final Rankings</h3>

            {finalRankings.length === 0 ? (
              <p>No rankings available.</p>
            ) : (
              <>
                {totalQuestions && (
                  <p>Total Questions: {totalQuestions}</p>
                )}

                <ol>
                  {finalRankings.map((entry) => {
                    const percentCorrect =
                      totalQuestions && typeof entry.correctAnswers === 'number'
                        ? Math.round(
                            (entry.correctAnswers / totalQuestions) * 100
                          )
                        : null;

                    const avgSeconds =
                      entry.avgResponseMs != null
                        ? (entry.avgResponseMs / 1000).toFixed(1)
                        : null;

                    return (
                      <li
                        key={entry.username}
                        style={{
                          fontWeight:
                            entry.username === username ? 'bold' : 'normal'
                        }}
                      >
                        #{entry.rank} – {entry.username}{' '}
                        {entry.disconnected && '(disconnected)'} (
                        {entry.totalScore} pts)
                        {typeof entry.correctAnswers === 'number' && (
                          <>
                            {' '}
                            | Correct: {entry.correctAnswers}
                            {totalQuestions
                              ? ` / ${totalQuestions}${
                                  percentCorrect != null
                                    ? ` (${percentCorrect}%)`
                                    : ''
                                }`
                              : ''}
                          </>
                        )}
                        {avgSeconds && <> | Avg time: {avgSeconds}s</>}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>
        )}

        {/* Idle message (before start) */}
        {!question &&
          !lastQuestionSummary &&
          !gameEnded &&
          countdown === null && (
            <p>No question active yet. Host must start the game.</p>
          )}
      </section>
    </div>
  );
}

export default App;
