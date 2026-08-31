import { useMemo, useState } from 'react';
import { ownableTile, ownedTileIds, tileLabel, type GameState, type TradeSide } from '@marxopoly/shared';
import { send } from '../net.js';
import { money, tileColor } from '../lib.js';

interface Props {
  state: GameState;
  myId: string;
  partnerId: string;
  onClose: () => void;
}

const EMPTY: TradeSide = { cash: 0, tileIds: [], reprieveCards: 0 };

export default function TradePanel({ state, myId, partnerId, onClose }: Props) {
  const me = state.players.find((p) => p.id === myId)!;
  const them = state.players.find((p) => p.id === partnerId)!;
  const [give, setGive] = useState<TradeSide>(EMPTY);
  const [receive, setReceive] = useState<TradeSide>(EMPTY);
  const [message, setMessage] = useState('');

  const myTiles = useMemo(() => ownedTileIds(state, myId), [state, myId]);
  const theirTiles = useMemo(() => ownedTileIds(state, partnerId), [state, partnerId]);

  const toggle = (side: TradeSide, set: (s: TradeSide) => void, id: number) => {
    set({
      ...side,
      tileIds: side.tileIds.includes(id) ? side.tileIds.filter((t) => t !== id) : [...side.tileIds, id],
    });
  };

  const empty =
    give.cash === 0 && give.tileIds.length === 0 && give.reprieveCards === 0 &&
    receive.cash === 0 && receive.tileIds.length === 0 && receive.reprieveCards === 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal trade" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Trade with {them.name}</h2>
          <button className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="trade-grid">
          <TradeColumn
            title="You give"
            side={give}
            setSide={setGive}
            tiles={myTiles}
            state={state}
            maxCash={me.cash}
            maxCards={me.reprieveCards}
            onToggle={(id) => toggle(give, setGive, id)}
          />
          <TradeColumn
            title={`${them.name} gives`}
            side={receive}
            setSide={setReceive}
            tiles={theirTiles}
            state={state}
            maxCash={them.cash}
            maxCards={them.reprieveCards}
            onToggle={(id) => toggle(receive, setReceive, id)}
          />
        </div>

        <input
          className="input"
          placeholder="Add a note (optional)"
          maxLength={140}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          className="btn primary full"
          disabled={empty}
          onClick={() => {
            send({ type: 'propose_trade', toId: partnerId, give, receive, message: message || undefined });
            onClose();
          }}
        >
          Send offer
        </button>
      </div>
    </div>
  );
}

function TradeColumn({
  title,
  side,
  setSide,
  tiles,
  state,
  maxCash,
  maxCards,
  onToggle,
}: {
  title: string;
  side: TradeSide;
  setSide: (s: TradeSide) => void;
  tiles: number[];
  state: GameState;
  maxCash: number;
  maxCards: number;
  onToggle: (id: number) => void;
}) {
  return (
    <div className="trade-col">
      <h3>{title}</h3>
      <label className="field">
        <span>Cash (max {money(maxCash)})</span>
        <input
          className="input"
          type="number"
          min={0}
          max={maxCash}
          step={10}
          value={side.cash}
          onChange={(e) => setSide({ ...side, cash: Math.min(maxCash, Math.max(0, Number(e.target.value))) })}
        />
      </label>
      {maxCards > 0 && (
        <label className="field">
          <span>Reprieve cards (max {maxCards})</span>
          <input
            className="input"
            type="number"
            min={0}
            max={maxCards}
            value={side.reprieveCards}
            onChange={(e) =>
              setSide({ ...side, reprieveCards: Math.min(maxCards, Math.max(0, Number(e.target.value))) })
            }
          />
        </label>
      )}
      <div className="trade-tiles">
        {tiles.length === 0 && <p className="muted small">No deeds.</p>}
        {tiles.map((id) => {
          const tile = ownableTile(id)!;
          const deed = state.deeds[id]!;
          const picked = side.tileIds.includes(id);
          return (
            <button
              key={id}
              className={`trade-tile${picked ? ' picked' : ''}`}
              onClick={() => onToggle(id)}
              disabled={deed.houses > 0}
              title={deed.houses > 0 ? 'Sell the buildings before trading this' : undefined}
            >
              <span className="dot" style={{ background: tileColor(tile) ?? '#475569' }} />
              {tileLabel(state, id)}
              {deed.mortgaged && <span className="tag">mtg</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
