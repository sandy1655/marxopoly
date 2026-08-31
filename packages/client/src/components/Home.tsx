import { useState } from 'react';
import { createRoom, joinRoom, refreshRooms, setPlayerName, useStore } from '../net.js';

export default function Home() {
  const playerName = useStore((s) => s.playerName);
  const rooms = useStore((s) => s.rooms);
  const joining = useStore((s) => s.joining);
  const [code, setCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setPrivate] = useState(false);

  const nameOk = playerName.trim().length > 0;

  return (
    <div className="home">
      <header className="home-head">
        <h1>
          Rentier<span className="dot" />
        </h1>
        <p>Buy the block, build it up, and bankrupt your friends. Two to eight players, live in the browser.</p>
      </header>

      <div className="home-grid">
        <section className="card">
          <h2>Your name</h2>
          <input
            className="input"
            value={playerName}
            maxLength={24}
            placeholder="e.g. Sandy"
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <h2>Start a table</h2>
          <input
            className="input"
            value={roomName}
            maxLength={30}
            placeholder="Table name (optional)"
            onChange={(e) => setRoomName(e.target.value)}
          />
          <label className="check">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
            <span>Private — only people with the code can find it</span>
          </label>
          <button
            className="btn primary"
            disabled={!nameOk || joining}
            onClick={() => createRoom(roomName, isPrivate)}
          >
            Create table
          </button>
        </section>

        <section className="card">
          <h2>Join with a code</h2>
          <div className="row">
            <input
              className="input code"
              value={code}
              maxLength={5}
              placeholder="ABC12"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn" disabled={!nameOk || code.length < 4 || joining} onClick={() => joinRoom(code)}>
              Join
            </button>
          </div>

          <div className="rooms-head">
            <h2>Open tables</h2>
            <button className="btn ghost small" onClick={refreshRooms}>
              Refresh
            </button>
          </div>
          <div className="hint">
            Testing on your own? Open a <strong>second browser tab</strong> and join with the code —
            each tab is its own player. Refreshing a tab keeps your seat.
          </div>

          <div className="room-list">
            {rooms.length === 0 && <p className="muted">No public tables right now — start one.</p>}
            {rooms.map((room) => {
              const lobby = room.phase === 'lobby';
              const full = room.playerCount >= room.maxPlayers;
              return (
                <button
                  key={room.id}
                  className="room-row"
                  disabled={!nameOk || (lobby && full)}
                  onClick={() => joinRoom(room.id)}
                >
                  <span className="room-name">{room.name}</span>
                  <span className="room-meta">
                    {room.playerCount}/{room.maxPlayers} ·{' '}
                    {lobby ? (full ? 'full' : 'open') : 'in play — watch'}
                    {room.spectatorCount > 0 && ` · ${room.spectatorCount} watching`}
                  </span>
                  <span className="room-code">{room.id}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="home-foot">
        <p className="muted">
          Rentier is an original game. It is not affiliated with, endorsed by, or derived from any commercial
          board game or its publisher.
        </p>
      </footer>
    </div>
  );
}
