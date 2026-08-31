import { leaveRoom } from '../net.js';
import { netWorth, type GameState } from '@rentier/shared';
import { TOKEN_GLYPHS, money } from '../lib.js';

interface Props {
  state: GameState;
  myId: string | null;
}

export default function GameOver({ state, myId }: Props) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  const ranked = [...state.players].sort((a, b) => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    if (a.bankrupt && b.bankrupt) return (b.finishedRank ?? 0) - (a.finishedRank ?? 0);
    return netWorth(state, b.id) - netWorth(state, a.id);
  });

  return (
    <div className="modal-backdrop">
      <div className="modal over">
        <h2>{winner ? `${winner.name} takes the table` : 'Game over'}</h2>
        {winner?.id === myId && <p className="win-note">That is your win.</p>}
        <ol className="standings">
          {ranked.map((p, i) => (
            <li key={p.id}>
              <span className="rank">{i + 1}</span>
              <span className="chip" style={{ background: p.color }}>
                {TOKEN_GLYPHS[p.token] ?? '●'}
              </span>
              <span className="standing-name">{p.name}</span>
              <span className="standing-net">{p.bankrupt ? 'bankrupt' : money(netWorth(state, p.id))}</span>
            </li>
          ))}
        </ol>
        <button className="btn primary full" onClick={leaveRoom}>
          Back to the lobby
        </button>
      </div>
    </div>
  );
}
