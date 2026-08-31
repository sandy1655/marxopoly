import { leaveRoom } from '../net.js';
import { netWorth, type GameState, type Player } from '@marxopoly/shared';
import { compactMoney, money, playerIcon } from '../lib.js';
import NetWorthChart from './NetWorthChart.js';

interface Props {
  state: GameState;
  myId: string | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GameOver({ state, myId }: Props) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  const ranked = [...state.players].sort(rankCmp(state));
  const podium = ranked.slice(0, 3);
  const podiumOrder = podium.length === 3 ? [podium[1]!, podium[0]!, podium[2]!] : podium;

  const byHolding = [...state.players].sort(
    (a, b) => (state.stats.holdingVisits[b.id] ?? 0) - (state.stats.holdingVisits[a.id] ?? 0),
  );
  const plazaPlayed = Object.values(state.stats.plazaTake).some((v) => v > 0);
  const byPlaza = [...state.players].sort(
    (a, b) => (state.stats.plazaTake[b.id] ?? 0) - (state.stats.plazaTake[a.id] ?? 0),
  );

  return (
    <div className="modal-backdrop">
      <div className="modal over results">
        <h2>{winner ? `${winner.name} takes the table` : 'Game over'}</h2>
        {winner?.id === myId && <p className="win-note">That is your win.</p>}

        <div className="podium">
          {podiumOrder.map((p) => {
            const place = ranked.indexOf(p);
            return (
              <div key={p.id} className={`podium-col p${place + 1}`}>
                <span className="podium-medal">{MEDALS[place]}</span>
                <span className="chip" style={{ background: p.color }}>
                  {playerIcon(p)}
                </span>
                <span className="podium-name">
                  {p.name}
                  {p.id === myId && <span className="tag you">you</span>}
                </span>
                <span className="podium-net">
                  {p.bankrupt ? 'bankrupt' : money(netWorth(state, p.id))}
                </span>
                <span className="podium-block">{place + 1}</span>
              </div>
            );
          })}
        </div>

        {ranked.length > 3 && (
          <ol className="standings">
            {ranked.slice(3).map((p, i) => (
              <li key={p.id}>
                <span className="rank">{i + 4}</span>
                <span className="chip" style={{ background: p.color }}>
                  {playerIcon(p)}
                </span>
                <span className="standing-name">{p.name}</span>
                <span className="standing-net">
                  {p.bankrupt ? 'bankrupt' : money(netWorth(state, p.id))}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="stat-grid">
          <section className="stat-card">
            <h3>Times in the holding yard</h3>
            <StatRows players={byHolding} value={(p) => state.stats.holdingVisits[p.id] ?? 0} format={(v) => `${v}×`} />
          </section>
          <section className="stat-card">
            <h3>Swept from the Plaza</h3>
            {plazaPlayed ? (
              <StatRows players={byPlaza} value={(p) => state.stats.plazaTake[p.id] ?? 0} format={compactMoney} />
            ) : (
              <p className="muted small">The Plaza pot was off this game.</p>
            )}
          </section>
        </div>

        <section className="stat-card wide">
          <h3>Net worth over the game</h3>
          <NetWorthChart history={state.stats.netWorthHistory} players={state.players} />
        </section>

        <button className="btn primary full" onClick={leaveRoom}>
          Back to the lobby
        </button>
      </div>
    </div>
  );
}

function rankCmp(state: GameState) {
  return (a: Player, b: Player): number => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    if (a.bankrupt && b.bankrupt) return (b.finishedRank ?? 0) - (a.finishedRank ?? 0);
    return netWorth(state, b.id) - netWorth(state, a.id);
  };
}

function StatRows({
  players,
  value,
  format,
}: {
  players: Player[];
  value: (p: Player) => number;
  format: (v: number) => string;
}) {
  return (
    <ul className="stat-rows">
      {players.map((p) => (
        <li key={p.id}>
          <span className="chip xs" style={{ background: p.color }} />
          <span className="stat-name">{p.name}</span>
          <span className="stat-val">{format(value(p))}</span>
        </li>
      ))}
    </ul>
  );
}
