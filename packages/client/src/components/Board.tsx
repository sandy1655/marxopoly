import { BOARD, type GameState } from '@marxopoly/shared';
import BoardTile from './BoardTile.js';
import TokenLayer from './TokenLayer.js';
import { money } from '../lib.js';
import Dice from './Dice.js';

interface Props {
  state: GameState;
  selected: number | null;
  onSelect: (tileId: number) => void;
}

export default function Board({ state, selected, onSelect }: Props) {
  const current = state.players.find((p) => p.seat === state.turnSeat && !p.bankrupt);
  const card = state.drawnCard;
  const cardText = card ? state.cards.find((c) => c.id === card.cardId)?.text ?? '' : '';

  return (
    <div className="board-wrap">
      <div className="board">
        {BOARD.map((tile) => (
          <BoardTile
            key={tile.id}
            tile={tile}
            state={state}
            selected={selected === tile.id}
            onSelect={onSelect}
          />
        ))}

        <TokenLayer state={state} />

        <div className="board-centre">
          <div className="brand">
            Marxopoly<span className="dot" />
          </div>
          <Dice dice={state.dice} />
          {current && (
            <div className="centre-turn">
              <span className="chip sm" style={{ background: current.color }} />
              {current.name}'s turn
            </div>
          )}
          {state.settings.plazaPot && state.plazaPot > 0 && (
            <div className="centre-pot">Plaza pot: {money(state.plazaPot)}</div>
          )}
          {card && (
            <div className={`centre-card ${card.deck}`}>
              <span className="deck-label">{card.deck === 'fortune' ? 'Fortune' : 'Ledger'}</span>
              {cardText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
