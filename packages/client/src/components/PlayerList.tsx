import { netWorth, ownedTileIds, tileAt, tileLabel, type GameState } from '@rentier/shared';
import { money, playerIcon, tileColor } from '../lib.js';

interface Props {
  state: GameState;
  myId: string | null;
  onTrade: (playerId: string) => void;
}

export default function PlayerList({ state, myId, onTrade }: Props) {
  const current = state.players.find((p) => p.seat === state.turnSeat && !p.bankrupt);
  // A player who has folded is a spectator now — no trading.
  const canTrade = !!myId && !state.players.find((p) => p.id === myId)?.bankrupt;

  return (
    <div className="panel players">
      {state.players.map((p) => {
        const tiles = ownedTileIds(state, p.id);
        return (
          <div
            key={p.id}
            className={`player-card${p.id === current?.id ? ' active' : ''}${p.bankrupt ? ' out' : ''}`}
            style={{ '--pc': p.color } as React.CSSProperties}
          >
            <div className="player-top">
              <span className="chip" style={{ background: p.color }}>
                {playerIcon(p)}
              </span>
              <span className="player-name">
                {p.name}
                {p.id === myId && <span className="tag you">you</span>}
                {p.isBot && <span className="tag bot">bot</span>}
                {!p.connected && !p.isBot && <span className="tag off">away</span>}
              </span>
              <span className="player-cash">{p.bankrupt ? 'out' : money(p.cash)}</span>
            </div>
            <div className="player-meta">
              <span>{tiles.length} {tiles.length === 1 ? 'deed' : 'deeds'}</span>
              <span>net {money(netWorth(state, p.id))}</span>
              {p.inHolding && <span className="warn">in holding</span>}
              {p.reprieveCards > 0 && <span>{p.reprieveCards} reprieve</span>}
            </div>
            <div className="deed-strip">
              {tiles.map((id) => {
                const tile = tileAt(id);
                const deed = state.deeds[id]!;
                return (
                  <span
                    key={id}
                    className={`deed-dot${deed.mortgaged ? ' mtg' : ''}`}
                    style={{ background: tileColor(tile) ?? '#4b5563' }}
                    title={`${tileLabel(state, id)}${deed.mortgaged ? ' (mortgaged)' : ''}`}
                  />
                );
              })}
            </div>
            {canTrade && p.id !== myId && !p.bankrupt && state.phase !== 'game_over' && (
              <button className="btn ghost small full" onClick={() => onTrade(p.id)}>
                Offer trade
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
