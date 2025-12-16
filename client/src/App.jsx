import HostLobby from './components/HostLobby';
import PlayerLobby from './components/PlayerLobby';
import GameView from './components/GameView';
import { useGameLogic } from './hooks/useGameLogic';
import NGSLogo from './components/NGSLogo.png';
import './App.css';
import { useState } from 'react';

function App() {
  const {
    view,
    setView,
    gameCode,
    setGameCode,
    username,
    setUsername,
    gameMode,
    setGameMode,
    teamCount,
    setTeamCount,
    selectedTeamId,
    setSelectedTeamId,
    players,
    teams, // reserved if needed downstream
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
    latencyMs,
    handleSelectPreset,
    handleCustomQuestionCountChange,
    handleCreateGame,
    handleJoinGame,
    handleStartGame,
    handleAnswerClick,
    handleMovePlayerTeam,
    handleSwitchView,
    handleLeaveGame,
  } = useGameLogic();

  
  const [spinning, setSpinning] = useState(false);

  const handleLogoClick = () => {
    // trigger a one-shot spin by toggling the `spin` class
    setSpinning(true);
  };

  const handleLogoAnimationEnd = () => {
    setSpinning(false);
  };
  
  return (
    <div style={{ padding: '1.5rem', fontFamily: 'system-ui' }}>
      <h1>
        <img
          src={NGSLogo}
          alt="NGS Logo"
          className={"logo" + (spinning ? " spin" : "")}
          onClick={handleLogoClick}
          onAnimationEnd={handleLogoAnimationEnd}
        />
        Network Game Show – Real-Time Core
      </h1>
      

      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => handleSwitchView('host')}
          style={{ marginRight: '0.5rem' }}
          disabled={lockPlayerView}
        >
          Host View
        </button>
        <button onClick={() => handleSwitchView('player')} disabled={lockHostView}>
          Player View
        </button>
      </div>

      {!gamePhaseActive &&
        (view === 'host' ? (
          <HostLobby
            username={username}
            setUsername={setUsername}
            handleLeaveGame={handleLeaveGame}
            handleCreateGame={handleCreateGame}
            questionSelectionLocked={questionSelectionLocked}
            disableCreateGame={disableCreateGame}
            gameCode={gameCode}
            gameMode={gameMode}
            setGameMode={setGameMode}
            teamCount={teamCount}
            setTeamCount={setTeamCount}
            selectedTeamId={selectedTeamId}
            setSelectedTeamId={setSelectedTeamId}
            questionPreset={questionPreset}
            handleSelectPreset={handleSelectPreset}
            customQuestionCount={customQuestionCount}
            handleCustomQuestionCountChange={handleCustomQuestionCountChange}
            questionCount={questionCount}
            handleStartGame={handleStartGame}
            canStart={canStart}
            teamReadiness={teamReadiness}
            isTeamMode={isTeamMode}
            allowTeamDrag={allowTeamDrag}
            lobbyTeams={lobbyTeams}
            players={players}
            onMovePlayerTeam={handleMovePlayerTeam}
            latencyMs={latencyMs}
          />
        ) : (
          <PlayerLobby
            username={username}
            setUsername={setUsername}
            gameCode={gameCode}
            setGameCode={setGameCode}
            gameMode={gameMode}
            setGameMode={setGameMode}
            teamCount={teamCount}
            selectedTeamId={selectedTeamId}
            setSelectedTeamId={setSelectedTeamId}
            handleJoinGame={handleJoinGame}
            handleLeaveGame={handleLeaveGame}
            isTeamMode={isTeamMode}
            lobbyTeams={lobbyTeams}
            players={players}
            latencyMs={latencyMs}
          />
        ))}

      {gamePhaseActive && (
        <GameView
          handleLeaveGame={handleLeaveGame}
          countdown={countdown}
          question={question}
          gameEnded={gameEnded}
          questionNumberLabel={questionNumberLabel}
          timeRemaining={timeRemaining}
          handleAnswerClick={handleAnswerClick}
          lastAnswer={lastAnswer}
          lastQuestionSummary={lastQuestionSummary}
          betweenRoundCountdown={betweenRoundCountdown}
          leaderboard={leaderboard}
          isTeamMode={isTeamMode}
          myTeamId={myTeamId}
          username={username}
          formattedFinalLeaderboard={formattedFinalLeaderboard}
          totalQuestions={totalQuestions}
          latencyMs={latencyMs}
        />
      )}
    </div>
  );
}

export default App;
