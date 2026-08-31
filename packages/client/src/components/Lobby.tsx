import { useState } from 'react';
import { addBot, kickPlayer, leaveRoom, send, updateSettings, useStore } from '../net.js';
import type { GameSettings } from '@rentier/shared';
import { playerIcon } from '../lib.js';
import CardsPanel from './CardsPanel.js';

const TOGGLES: { key: keyof GameSettings; label: string; hint: string }[] = [
  { key: 'auctionsEnabled', label: 'Auctions', hint: 'Declined properties go under the hammer.' },
  { key: 'evenBuild', label: 'Even building', hint: 'Houses must be spread across a colour group.' },
  { key: 'doubleRentOnFullGroup', label: 'Double rent on full sets', hint: 'Unimproved streets pay double for a complete set.' },
  { key: 'plazaPot', label: 'Plaza pot', hint: 'Taxes and fees pile up and are swept by whoever lands on the Plaza.' },
  { key: 'noRentInHolding', label: 'No rent from the holding yard', hint: 'Owners collect nothing while detained.' },
  { key: 'doubleOnExactStart', label: 'Bonus on exact Start', hint: 'Landing exactly on Start pays double salary.' },
];

const NUMBERS: { key: keyof GameSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'startingCash', label: 'Starting cash', min: 500, max: 5000, step: 100 },
  { key: 'startSalary', label: 'Salary at Start', min: 0, max: 1000, step: 50 },
  { key: 'holdingFine', label: 'Holding yard fine', min: 0, max: 500, step: 10 },
  { key: 'turnSeconds', label: 'Turn timer (seconds, 0 = off)', min: 0, max: 300, step: 15 },
  { key: 'maxPlayers', label: 'Max players', min: 2, max: 8, step: 1 },
];

export default function Lobby() {
  const game = useStore((s) => s.game)!;
  const hostId = useStore((s) => s.hostId);
  const playerId = useStore((s) => s.playerId);
  const roomName = useStore((s) => s.roomName);
  const roomId = useStore((s) => s.roomId);
  const isHost = hostId === playerId;
  const [showCards, setShowCards] = useState(false);

  return (
    <div className="lobby">
      <header className="lobby-head">
        <div>
          <h1>{roomName}</h1>
          <p className="muted">
            Share this code to invite people: <strong className="code-chip">{roomId}</strong>
          </p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => setShowCards(true)}>
            View cards
          </button>
          <button className="btn ghost" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </header>

      {showCards && <CardsPanel onClose={() => setShowCards(false)} />}

      <div className="lobby-grid">
        <section className="card">
          <h2>Players ({game.players.length}/{game.settings.maxPlayers})</h2>
          <ul className="seat-list">
            {game.players.map((p) => (
              <li key={p.id} className="seat">
                <span className="chip" style={{ background: p.color }}>
                  {playerIcon(p)}
                </span>
                <span className="seat-name">
                  {p.name}
                  {p.id === hostId && <span className="tag">host</span>}
                  {p.isBot && <span className="tag bot">bot</span>}
                  {p.id === playerId && <span className="tag you">you</span>}
                </span>
                {isHost && p.id !== playerId && (
                  <button className="btn ghost small" onClick={() => kickPlayer(p.id)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isHost && (
            <div className="row">
              <button
                className="btn"
                onClick={addBot}
                disabled={game.players.length >= game.settings.maxPlayers}
              >
                Add a bot
              </button>
              <button
                className="btn primary"
                onClick={() => send({ type: 'start_game' })}
                disabled={game.players.length < 2}
              >
                Start game
              </button>
            </div>
          )}
          {!isHost && <p className="muted">Waiting for the host to start…</p>}
        </section>

        <section className="card">
          <h2>House rules</h2>
          <div className="settings">
            {TOGGLES.map((t) => (
              <label key={t.key} className="check">
                <input
                  type="checkbox"
                  disabled={!isHost}
                  checked={Boolean(game.settings[t.key])}
                  onChange={(e) => updateSettings({ [t.key]: e.target.checked } as Partial<GameSettings>)}
                />
                <span>
                  <strong>{t.label}</strong>
                  <em>{t.hint}</em>
                </span>
              </label>
            ))}
          </div>
          <div className="settings numbers">
            {NUMBERS.map((n) => (
              <label key={n.key} className="field">
                <span>{n.label}</span>
                <input
                  className="input"
                  type="number"
                  disabled={!isHost}
                  min={n.min}
                  max={n.max}
                  step={n.step}
                  value={Number(game.settings[n.key])}
                  onChange={(e) =>
                    updateSettings({ [n.key]: Number(e.target.value) } as Partial<GameSettings>)
                  }
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
