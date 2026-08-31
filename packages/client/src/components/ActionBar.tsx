import { useEffect, useState } from 'react';
import {
  canBuild,
  canMortgage,
  canSellBuilding,
  liquidValue,
  ownableTile,
  type GameState,
} from '@marxopoly/shared';
import { send } from '../net.js';
import { money, phaseLabel, secondsLeft } from '../lib.js';

interface Props {
  state: GameState;
  myId: string | null;
  onManage: () => void;
}

export default function ActionBar({ state, myId, onManage }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);

  const me = state.players.find((p) => p.id === myId);
  const current = state.players.find((p) => p.seat === state.turnSeat && !p.bankrupt);
  const mine = !!me && current?.id === me.id;
  const deadline = state.phase === 'auction' ? state.auction?.deadline ?? null : state.turnDeadline;
  const left = secondsLeft(deadline);

  const landedTile = me ? ownableTile(me.position) : null;
  const debtIsMine = state.debt?.debtorId === myId;

  return (
    <div className={`actionbar${mine || debtIsMine ? ' mine' : ''}`}>
      <div className="actionbar-status">
        <span className="status-text">{phaseLabel(state, myId)}</span>
        {left !== null && state.phase !== 'game_over' && (
          <span className={`timer${left <= 10 ? ' urgent' : ''}`}>{left}s</span>
        )}
      </div>

      <div className="actionbar-buttons">
        {mine && state.phase === 'pre_roll' && (
          <>
            {me?.inHolding && me.reprieveCards > 0 && (
              <button className="btn" onClick={() => send({ type: 'use_reprieve' })}>
                Use reprieve card
              </button>
            )}
            {me?.inHolding && me.cash >= state.settings.holdingFine && (
              <button className="btn" onClick={() => send({ type: 'pay_holding_fine' })}>
                Pay {money(state.settings.holdingFine)} fine
              </button>
            )}
            <button className="btn primary big" onClick={() => send({ type: 'roll_dice' })}>
              Roll dice
            </button>
          </>
        )}

        {mine && state.phase === 'awaiting_buy' && landedTile && (
          <>
            <button
              className="btn primary big"
              disabled={(me?.cash ?? 0) < landedTile.price}
              onClick={() => send({ type: 'buy_property' })}
            >
              Buy {landedTile.name} — {money(landedTile.price)}
            </button>
            <button className="btn" onClick={() => send({ type: 'decline_property' })}>
              {state.settings.auctionsEnabled ? 'Send to auction' : 'Pass'}
            </button>
          </>
        )}

        {mine && state.phase === 'post_roll' && (
          <button className="btn primary big" onClick={() => send({ type: 'end_turn' })}>
            End turn
          </button>
        )}

        {debtIsMine && state.debt && (
          <>
            <span className="debt-note">
              You owe {money(state.debt.amount)} — {state.debt.reason}. You can raise{' '}
              {money(liquidValue(state, state.debt.debtorId))}.
            </span>
            <button className="btn" onClick={onManage}>
              Raise funds
            </button>
            <button
              className="btn danger"
              disabled={liquidValue(state, state.debt.debtorId) >= state.debt.amount}
              onClick={() => send({ type: 'declare_bankruptcy' })}
            >
              Declare bankruptcy
            </button>
          </>
        )}

        {me && !me.bankrupt && state.phase !== 'game_over' && (
          <button className="btn ghost" onClick={onManage} disabled={!canManageNow(state, me.id)}>
            Manage property
          </button>
        )}
      </div>
    </div>
  );
}

function canManageNow(state: GameState, playerId: string): boolean {
  if (!['pre_roll', 'post_roll', 'debt', 'awaiting_buy'].includes(state.phase)) return false;
  const owned = Object.values(state.deeds).filter((d) => d.ownerId === playerId);
  return owned.some(
    (d) =>
      canBuild(state, playerId, d.tileId).ok ||
      canSellBuilding(state, playerId, d.tileId).ok ||
      canMortgage(state, playerId, d.tileId).ok ||
      d.mortgaged,
  );
}
