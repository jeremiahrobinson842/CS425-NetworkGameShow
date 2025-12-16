import { useEffect, useRef, useState, useMemo } from 'react';
import { getSocket } from '../lib/socket';

const presetQuestionCounts = { short: 5, normal: 10, long: 20 };
const inferredOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : null;
// Prefer explicit env; fallback to current host; final fallback is local dev backend on 5174.
const apiBase =
  import.meta.env.VITE_API_BASE ||
  (inferredOrigin && inferredOrigin.startsWith('http') ? inferredOrigin : null) ||
  'http://localhost:5174';

export function useGameLogic() {
  const socket = getSocket();

  // Core state
  const [view, setView] = useState('host');
  const [gameCode, setGameCode] = useState('');
  const [gameId, setGameId] = useState(null);
  const [username, setUsername] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameMode, setGameMode] = useState('classic');
  const [teamCount, setTeamCount] = useState(2);
  const [selectedTeamId, setSelectedTeamId] = useState(1);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);

  // Question settings
  const [questionPreset, setQuestionPreset] = useState('normal');
  const [questionCount, setQuestionCount] = useState(presetQuestionCounts.normal);
  const [customQuestionCount, setCustomQuestionCount] = useState('');

  // Game runtime state
  const [countdown, setCountdown] = useState(null);
  const [question, setQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [lastQuestionSummary, setLastQuestionSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameEnded, setGameEnded] = useState(false);
  const [finalRankings, setFinalRankings] = useState([]);
  const [finalTotalQuestions, setFinalTotalQuestions] = useState(null);
  const [betweenRoundCountdown, setBetweenRoundCountdown] = useState(null);
  const [questionSelectionLocked, setQuestionSelectionLocked] = useState(false);

  // Timers
  const timerIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const betweenRoundIntervalRef = useRef(null);
  const gameEndTimeoutRef = useRef(null);

  // Derived flags
  const activePlayerCount = players.length;
  const isTeamMode = gameMode === 'team';

  const teamReadiness = useMemo(() => {
    if (!isTeamMode) return { ready: true, message: null };
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 5) {
      return { ready: false, message: 'Set between 2 and 5 teams.' };
    }
    if (!teams || teams.length !== teamCount) {
      return { ready: false, message: `Waiting for ${teamCount} teams to be set.` };
    }
    const memberCounts = teams.map((t) => (t.members ? t.members.length : 0));
    if (memberCounts.some((c) => c < 2)) {
      return { ready: false, message: 'Each team must have at least 2 players.' };
    }
    if (activePlayerCount > 10) {
      return { ready: false, message: 'Maximum of 10 players allowed in team mode.' };
    }
    return { ready: true, message: null };
  }, [isTeamMode, teamCount, teams, activePlayerCount]);

  const myTeamId = players.find((p) => p.username === username)?.teamId || null;
  const canStart = isHost && (isTeamMode ? teamReadiness.ready : activePlayerCount >= 2);
  const totalQuestions = finalTotalQuestions;
  const lockHostView = isHost && Boolean(gameCode) && activePlayerCount > 1;
  const lockPlayerView = !isHost && Boolean(gameCode);
  const disableCreateGame =
    isHost && Boolean(gameCode) && activePlayerCount >= 2 && !gameEnded;
  const gamePhaseActive =
    countdown !== null || question !== null || lastQuestionSummary !== null || gameEnded;
  const allowTeamDrag = isHost && isTeamMode && !gamePhaseActive;

  // Utility
  const usernameIsValid = (name) => /^[a-zA-Z0-9]{1,15}$/.test(name);

  // Socket listeners
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const syncLobby = (payload) => {
      setPlayers(payload.players || []);
      setTeams(payload.teams || []);
      if (payload.mode) setGameMode(payload.mode);
      if (payload.teamCount != null) setTeamCount(Number(payload.teamCount));
      const me = (payload.players || []).find((p) => p.username === username);
      if (me && me.teamId) setSelectedTeamId(me.teamId);
    };

    const onQuestion = (payload) => {
      setQuestion(payload);
      setCountdown(null);
      setBetweenRoundCountdown(null);

      if (betweenRoundIntervalRef.current) {
        clearInterval(betweenRoundIntervalRef.current);
        betweenRoundIntervalRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      setTimeRemaining(null);
      setLastAnswer(null);
      setLastQuestionSummary(null);

      const totalMs = payload.timeLimit * 1000;
      const endTime = payload.serverStartTime + totalMs;

      const updateTimer = () => {
        const now = Date.now();
        const remainingMs = endTime - now;
        if (remainingMs <= 0) {
          setTimeRemaining(0);
          return false;
        }
        setTimeRemaining(Math.ceil(remainingMs / 1000));
        return true;
      };

      updateTimer();
      timerIntervalRef.current = setInterval(() => {
        if (!updateTimer()) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      }, 250);
    };

    const onQuestionEnded = (payload) => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimeRemaining(0);
      setQuestion(null);
      setBetweenRoundCountdown(5);
      setLastQuestionSummary({
        gameCode: payload.gameCode,
        questionId: payload.questionId,
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation
      });
      setLeaderboard(payload.leaderboard || []);

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
    };

    const onGameEnded = (payload) => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimeRemaining(null);
      setQuestion(null);
      setCountdown(null);
      setQuestionSelectionLocked(false);
      setBetweenRoundCountdown(null);
      setGameEnded(true);
      setLastQuestionSummary(null);
      setFinalTotalQuestions(
        typeof payload.totalQuestions === 'number' ? payload.totalQuestions : null
      );
      setFinalRankings(payload.finalRankings || []);

      if (gameEndTimeoutRef.current) {
        clearTimeout(gameEndTimeoutRef.current);
      }
      gameEndTimeoutRef.current = setTimeout(() => {
        resetToLobbyAfterEnd();
        gameEndTimeoutRef.current = null;
      }, 10000);
    };

    const onGameStarting = (payload) => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setQuestionSelectionLocked(true);
      setCountdown(payload.countdown);
      setLastAnswer(null);
      setLastQuestionSummary(null);
      setLeaderboard([]);
      setGameEnded(false);
      setFinalRankings([]);
      setFinalTotalQuestions(null);
      setBetweenRoundCountdown(null);

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
    };

    socket.on('connect', () => console.log('Socket connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
    socket.on('player_joined', syncLobby);
    socket.on('player_list', syncLobby);
    socket.on('game_starting', onGameStarting);
    socket.on('question', onQuestion);
    socket.on('question_ended', onQuestionEnded);
    socket.on('game_ended', onGameEnded);
    socket.on('host_left', handleLeaveGame);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('player_joined', syncLobby);
      socket.off('player_list', syncLobby);
      socket.off('game_starting', onGameStarting);
      socket.off('question', onQuestion);
      socket.off('question_ended', onQuestionEnded);
      socket.off('game_ended', onGameEnded);
      socket.off('host_left', handleLeaveGame);

      [timerIntervalRef, countdownIntervalRef, betweenRoundIntervalRef].forEach((ref) => {
        if (ref.current) clearInterval(ref.current);
      });
      if (gameEndTimeoutRef.current) clearTimeout(gameEndTimeoutRef.current);
    };
  }, [socket, username]);

  function handleSelectPreset(presetKey) {
    if (questionSelectionLocked) return;
    const value = presetQuestionCounts[presetKey];
    setQuestionPreset(presetKey);
    setQuestionCount(value);
    setCustomQuestionCount('');
  }

  function handleCustomQuestionCountChange(e) {
    if (questionSelectionLocked) return;
    const raw = e.target.value;
    setCustomQuestionCount(raw);
    const parsed = Number(raw);
    if (!raw) {
      setQuestionPreset('custom');
      return;
    }
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 50) {
      if (parsed === presetQuestionCounts.short) setQuestionPreset('short');
      else if (parsed === presetQuestionCounts.normal) setQuestionPreset('normal');
      else if (parsed === presetQuestionCounts.long) setQuestionPreset('long');
      else setQuestionPreset('custom');
      setQuestionCount(parsed);
    }
  }

  async function handleCreateGame(e) {
    e.preventDefault();
    setQuestionSelectionLocked(false);
    if (!usernameIsValid(username)) {
      alert('Enter a host username (1-15 letters/numbers).');
      return;
    }
    if (gameMode === 'team') {
      if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 5) {
        alert('Team games require between 2 and 5 teams.');
        return;
      }
      if (!Number.isInteger(selectedTeamId) || selectedTeamId < 1 || selectedTeamId > teamCount) {
        alert(`Select a valid team number between 1 and ${teamCount}.`);
        return;
      }
    }

    const chosenCountRaw =
      customQuestionCount !== '' ? Number(customQuestionCount) : Number(questionCount);
    const parsedQuestionCount = chosenCountRaw;
    if (!Number.isInteger(parsedQuestionCount) || parsedQuestionCount < 1 || parsedQuestionCount > 50) {
      alert('Question count must be an integer between 1 and 50.');
      return;
    }

    const body = {
      mode: gameMode,
      questionCount: parsedQuestionCount,
      timePerQuestion: 20
    };

    try {
      const res = await fetch(`${apiBase}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data?.gameCode || !data?.gameId) {
        const msg = data && data.error ? data.error : 'Failed to create game. Please try again.';
        alert(msg);
        return;
      }

      setGameCode(data.gameCode);
      setGameId(data.gameId);
      setIsHost(true);
      setGameMode(gameMode);

      const joinPayload = { gameCode: data.gameCode, username, isHost: true };
      if (gameMode === 'team') {
        joinPayload.teamId = selectedTeamId;
        joinPayload.teamCount = teamCount;
      }

      socket.emit('join_game', joinPayload, (ack) => {
        if (!ack?.ok) {
          alert('Failed to join game as host: ' + (ack && ack.error));
        } else {
          setPlayers(ack.players || []);
          setTeams(ack.teams || []);
          if (ack.teamCount != null) setTeamCount(Number(ack.teamCount));
          if (ack.mode) setGameMode(ack.mode);
          if (joinPayload.teamId) setSelectedTeamId(joinPayload.teamId);
        }
      });
    } catch (err) {
      console.error(err);
      alert('Failed to create game. Please check your connection and try again.');
    }
  }

  function handleJoinGame(e) {
    e.preventDefault();
    if (lockHostView && isHost) {
      alert('Host cannot join as a player while a game with players is active.');
      return;
    }
    if (!usernameIsValid(username) || !gameCode) {
      alert('Enter both game code and a valid username (1-15 letters/numbers).');
      return;
    }
    setIsHost(false);

    if (gameMode === 'team') {
      if (!Number.isInteger(selectedTeamId) || selectedTeamId < 1 || selectedTeamId > teamCount) {
        alert(`Select a valid team number between 1 and ${teamCount} before joining.`);
        return;
      }
    }

    const joinPayload = { gameCode, username, isHost: false };
    if (gameMode === 'team') joinPayload.teamId = selectedTeamId;

    socket.emit('join_game', joinPayload, (ack) => {
      if (!ack.ok) {
        alert('Failed to join game: ' + ack.error);
      } else {
        setGameId(ack.gameId);
        setPlayers(ack.players || []);
        setTeams(ack.teams || []);
        if (ack.teamCount != null) setTeamCount(Number(ack.teamCount));
        if (ack.mode) setGameMode(ack.mode);
        if (joinPayload.teamId) setSelectedTeamId(joinPayload.teamId);
      }
    });
  }

  function handleStartGame() {
    if (!gameCode) {
      alert('No gameCode set.');
      return;
    }
    socket.emit('start_game', { gameCode }, (ack) => {
      if (!ack.ok) alert('Could not start game: ' + ack.error);
    });
  }

  function handleAnswerClick(optionLetter) {
    if (!question) {
      alert('No active question.');
      return;
    }
    if (!gameCode) {
      alert('No gameCode set.');
      return;
    }
    const payload = { gameCode, questionId: question.id, answer: optionLetter };
    socket.emit('submit_answer', payload, (ack) => {
      if (!ack || !ack.ok) {
        alert('Failed to submit answer: ' + (ack && ack.error));
        return;
      }
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

  function handleMovePlayerTeam(usernameToMove, targetTeamId) {
    if (!isHost || !isTeamMode) return;
    if (!gameCode) return;
    socket.emit('move_player_team', { gameCode, username: usernameToMove, targetTeamId }, (ack) => {
      if (!ack?.ok) alert(ack?.error || 'Failed to move player.');
    });
  }

  function handleSwitchView(nextView) {
    if (lockHostView && nextView === 'player') return;
    if (lockPlayerView && nextView === 'host') return;
    setView(nextView);
  }

  function handleLeaveGame() {
    if (!gameCode && !socket.connected) return;
    [timerIntervalRef, countdownIntervalRef, betweenRoundIntervalRef].forEach((ref) => {
      if (ref.current) {
        clearInterval(ref.current);
        ref.current = null;
      }
    });

    socket.disconnect();
    setTimeout(() => {
      if (!socket.connected) socket.connect();
    }, 50);

    setGameCode('');
    setGameId(null);
    setPlayers([]);
    setIsHost(false);
    setGameMode('classic');
    setTeamCount(2);
    setSelectedTeamId(1);
    setTeams([]);
    setQuestion(null);
    setCountdown(null);
    setTimeRemaining(null);
    setLastAnswer(null);
    setLastQuestionSummary(null);
    setLeaderboard([]);
    setGameEnded(false);
    setFinalRankings([]);
    setFinalTotalQuestions(null);
    setBetweenRoundCountdown(null);
    setQuestionSelectionLocked(false);
    setQuestionPreset('normal');
    setQuestionCount(presetQuestionCounts.normal);
    setCustomQuestionCount('');
    if (gameEndTimeoutRef.current) {
      clearTimeout(gameEndTimeoutRef.current);
      gameEndTimeoutRef.current = null;
    }
    setView('host');
  }

  function resetToLobbyAfterEnd() {
    setGameEnded(false);
    setQuestion(null);
    setCountdown(null);
    setBetweenRoundCountdown(null);
    setLastAnswer(null);
    setLastQuestionSummary(null);
    setLeaderboard([]);
    setFinalRankings([]);
    setFinalTotalQuestions(null);
    setTimeRemaining(null);
    setQuestionSelectionLocked(false);
    if (gameEndTimeoutRef.current) {
      clearTimeout(gameEndTimeoutRef.current);
      gameEndTimeoutRef.current = null;
    }
  }

  const placeholderTeams =
    isTeamMode &&
    Number.isInteger(teamCount) &&
    teamCount >= 2 &&
    teamCount <= 5
      ? Array.from({ length: teamCount }, (_, idx) => ({
          teamId: idx + 1,
          teamName: `Team ${idx + 1}`,
          members: []
        }))
      : [];

  const lobbyTeams = isTeamMode && teams && teams.length > 0 ? teams : placeholderTeams;

  const formattedFinalLeaderboard = useMemo(() => {
    if (!finalRankings || finalRankings.length === 0) return [];
    const rows = finalRankings.map((entry) => {
      const displayName = entry.teamName || entry.username;
      const playerLabel = `${displayName}${entry.disconnected ? ' (disconnected)' : ''}`;
      const scoreLabel = `${entry.totalScore} pts`;
      const correctLabel =
        typeof entry.correctAnswers === 'number'
          ? totalQuestions
            ? `Correct: ${entry.correctAnswers}/${totalQuestions}`
            : `Correct: ${entry.correctAnswers}`
          : 'Correct: n/a';
      const avgLabel =
        entry.avgResponseMs != null
          ? `Avg: ${(entry.avgResponseMs / 1000).toFixed(1)}s`
          : '';

      return { playerLabel, scoreLabel, correctLabel, avgLabel, rank: entry.rank };
    });

    const widths = rows.reduce(
      (acc, row) => ({
        player: Math.max(acc.player, row.playerLabel.length),
        score: Math.max(acc.score, row.scoreLabel.length),
        correct: Math.max(acc.correct, row.correctLabel.length),
        avg: Math.max(acc.avg, row.avgLabel.length)
      }),
      { player: 0, score: 0, correct: 0, avg: 0 }
    );

    const pad = (val, len) => String(val).padEnd(len, ' ');

    return rows.map((row) => {
      const parts = [
        `#${row.rank}`,
        pad(row.playerLabel, widths.player),
        pad(row.scoreLabel, widths.score),
        pad(row.correctLabel, widths.correct)
      ];
      if (row.avgLabel) parts.push(pad(row.avgLabel, widths.avg));
      return parts.join(' | ');
    });
  }, [finalRankings, totalQuestions]);

  const questionNumberLabel = question
    ? `Question ${question.questionNumber} of ${question.totalQuestions}`
    : '';

  return {
    // state
    view,
    gameCode,
    gameId,
    username,
    isHost,
    gameMode,
    teamCount,
    selectedTeamId,
    players,
    teams,
    questionPreset,
    questionCount,
    customQuestionCount,
    countdown,
    question,
    timeRemaining,
    lastAnswer,
    lastQuestionSummary,
    leaderboard,
    gameEnded,
    finalRankings,
    betweenRoundCountdown,
    questionSelectionLocked,
    lobbyTeams,
    formattedFinalLeaderboard,
    totalQuestions,
    isTeamMode,
    myTeamId,
    canStart,
    lockHostView,
    lockPlayerView,
    disableCreateGame,
    gamePhaseActive,
    allowTeamDrag,
    teamReadiness,
    questionNumberLabel,

    // setters
    setView,
    setUsername,
    setGameMode,
    setTeamCount,
    setSelectedTeamId,
    setGameCode,

    // handlers
    handleSelectPreset,
    handleCustomQuestionCountChange,
    handleCreateGame,
    handleJoinGame,
    handleStartGame,
    handleAnswerClick,
    handleMovePlayerTeam,
    handleSwitchView,
    handleLeaveGame
  };
}
