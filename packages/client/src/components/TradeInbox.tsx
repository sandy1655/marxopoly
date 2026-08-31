import { tileLabel, type GameState, type TradeSide } from '@marxopoly/shared';
import { send } from '../net.js';
import { money } from '../lib.js';

interface Props {
  state: GameState;
  myId: string;
}

export default function TradeInbox({ state, myId }: Props) {
  const mine = state.trades.filter((t) => t.toId === myId || t.fromId === myId);
  if (mine.length === 0) return null;

  return (
    <div className="panel trades">
      <h3>Open offers</h3>
      {mine.map((offer) => {
        const incoming = offer.toId === myId;
        const other = state.players.find((p) => p.id === (incoming ? offer.fromId : offer.toId));
        return (
          <div key={offer.id} className="trade-offer">
            <div className="trade-offer-head">
              <strong>{incoming ? `${other?.name} offers` : `To ${other?.name}`}</strong>
            </div>
            <div className="trade-offer-body">
              <div>
                <span className="muted small">{incoming ? 'You get' : 'You give'}</span>
                <SideSummary side={offer.give} state={state} />
              </div>
              <div>
                <span className="muted small">{incoming ? 'You give' : 'You get'}</span>
                <SideSummary side={offer.receive} state={state} />
              </div>
            </div>
            {offer.message && <p className="trade-note">“{offer.message}”</p>}
            <div className="row">
              {incoming ? (
                <>
                  <button className="btn primary small" onClick={() => send({ type: 'accept_trade', tradeId: offer.id })}>
                    Accept
                  </button>
                  <button className="btn small" onClick={() => send({ type: 'decline_trade', tradeId: offer.id })}>
                    Decline
                  </button>
                </>
              ) : (
                <button className="btn small" onClick={() => send({ type: 'cancel_trade', tradeId: offer.id })}>
                  Withdraw
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SideSummary({ side, state }: { side: TradeSide; state: GameState }) {
  const parts: string[] = [];
  if (side.cash > 0) parts.push(money(side.cash));
  if (side.reprieveCards > 0) parts.push(`${side.reprieveCards} reprieve`);
  for (const id of side.tileIds) parts.push(tileLabel(state, id));
  return <div className="side-summary">{parts.length ? parts.join(' · ') : 'nothing'}</div>;
}
