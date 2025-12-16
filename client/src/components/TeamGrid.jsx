import { useState } from 'react';

function TeamGrid({
  isTeamMode,
  teams,
  players,
  allowDrag = false,
  onMovePlayer
}) {
  const [draggingUser, setDraggingUser] = useState(null);

  if (!isTeamMode) {
    return (
      <ul>
        {players.map((p) => (
          <li key={p.username}>
            {p.username} {p.isHost ? '(Host)' : ''}
          </li>
        ))}
      </ul>
    );
  }

  function handleDragStart(e, username) {
    if (!allowDrag) return;
    e.dataTransfer.setData('text/plain', username);
    setDraggingUser(username);
  }

  function handleDragEnd() {
    setDraggingUser(null);
  }

  function handleDrop(e, teamId) {
    if (!allowDrag) return;
    e.preventDefault();
    const username = e.dataTransfer.getData('text/plain');
    if (!username || !onMovePlayer) return;
    onMovePlayer(username, teamId);
    setDraggingUser(null);
  }

  function handleDragOver(e) {
    if (!allowDrag) return;
    e.preventDefault();
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
      {teams.map((team) => {
        const memberCount = team.members ? team.members.length : 0;
        const dropActive = allowDrag && Boolean(draggingUser);

        return (
          <div
            key={team.teamId || team.teamName}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, team.teamId)}
            style={{
              border: '1px dashed ' + (dropActive ? '#4a90e2' : '#ccc'),
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              minWidth: '170px',
              background: dropActive ? '#f7fbff' : 'transparent'
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {team.teamName || `Team ${team.teamId}`}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#555' }}>
              {memberCount > 0
                ? `${memberCount} player${memberCount === 1 ? '' : 's'}`
                : 'No players yet'}
            </div>
            {allowDrag && (
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                Drag players here to move them
              </div>
            )}
            <ul style={{ marginTop: '0.4rem' }}>
              {(team.members || []).map((m) => (
                <li
                  key={m.username}
                  draggable={allowDrag}
                  onDragStart={(e) => handleDragStart(e, m.username)}
                  onDragEnd={handleDragEnd}
                  style={{
                    cursor: allowDrag ? 'grab' : 'default'
                  }}
                >
                  {m.username} {m.isHost ? '(Host)' : ''}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default TeamGrid;
