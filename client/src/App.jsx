// client/src/App.jsx
import { useEffect, useState } from 'react';
import { getSocket } from './lib/socket';

function App() {
  const [view, setView] = useState('host'); // 'host' or 'player'

  // Shared game state
  const [gameCode, setGameCode] = useState('');
  const [gameId, setGameId] = useState(null);
  const [username, setUsername] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);

  // Game-start + question state
  const [countdown, setCountdown] = useState(null);
  const [question, setQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

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
      setCountdown(payload.countdown);
    }

    function onQuestion(payload) {
      console.log('question', payload);
      setQuestion(payload);

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

      updateTimer(); // initial

      const intervalId = setInterval(() => {
        const stillRunning = updateTimer();
        if (!stillRunning) {
          clearInterval(intervalId);
        }
      }, 250);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('player_joined', onPlayerJoined);
    socket.on('player_list', onPlayerList);
    socket.on('game_starting', onGameStarting);
    socket.on('question', onQuestion);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('player_joined', onPlayerJoined);
      socket.off('player_list', onPlayerList);
      socket.off('game_starting', onGameStarting);
      socket.off('question', onQuestion);
    };
  }, [socket]);

  // Host: create game via REST then join via join_game
  async function handleCreateGame(e) {
    e.preventDefault();
    if (!username) {
      alert('Enter a host username first.');
      return;
    }

    const body = {
      mode: 'classic',
      questionCount: 10,
      timePerQuestion: 20
    };

    const res = await fetch('http://localhost:4000/api/games/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log('Created game:', data);

    setGameCode(data.gameCode);
    setGameId(data.gameId);
    setIsHost(true);

    socket.emit(
      'join_game',
      { gameCode: data.gameCode, username, isHost: true },
      (ack) => {
        console.log('join_game ack (host):', ack);
        if (!ack.ok) {
          alert('Failed to join game as host: ' + ack.error);
        } else {
          setPlayers(ack.players || []);
        }
      }
    );
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

  // Basic render helpers
  const playerCount = players.length;
  const canStart = isHost && playerCount >= 2;

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'system-ui' }}>
      <h1>Network Game Show – Week 2 Real-Time Core</h1>

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
            <p>Questions: 10 (fixed for now)</p>
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
        {countdown !== null && question == null && (
          <p>Game starting in: {countdown}...</p>
        )}

        {question && (
          <>
            <p>
              Question {question.questionNumber} of {question.totalQuestions}
            </p>
            <h3>{question.text}</h3>
            <div style={{ marginBottom: '1rem' }}>
              <button style={{ display: 'block', margin: '0.25rem 0' }}>
                A) {question.options.A}
              </button>
              <button style={{ display: 'block', margin: '0.25rem 0' }}>
                B) {question.options.B}
              </button>
              <button style={{ display: 'block', margin: '0.25rem 0' }}>
                C) {question.options.C}
              </button>
              <button style={{ display: 'block', margin: '0.25rem 0' }}>
                D) {question.options.D}
              </button>
            </div>
            <p>
              Time remaining:{' '}
              {timeRemaining !== null ? `${timeRemaining}s` : '...'}
            </p>
            <p>Your score: (will be implemented in Week 3, currently 0)</p>
          </>
        )}

        {!question && countdown === null && (
          <p>No question active yet. Host must start the game.</p>
        )}
      </section>
    </div>
  );
}

export default App;
