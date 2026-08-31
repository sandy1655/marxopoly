import { ALL_CARDS, BOARD, type GameState } from '@rentier/shared';
import BoardTile from './BoardTile.js';
import { money } from '../lib.js';
import Dice from './Dice.js';

interface Props {
  state: GameState;
  selected: number | null;
  onSelect: (tileId: number) => void;
}

const CARD_TEXT = new Map(ALL_CARDS.map((c) => [c.id, c.text]));

export default function Board({ state, selected, onSelect }: Props) {
  const current = state.players.find((p) => p.seat === state.turnSeat && !p.bankrupt);
  const card = state.drawnCard;

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

        <div className="board-centre">
          <div className="brand">
            Rentier<span className="dot" />
          </div>
          <Dice dice={state.dice} />
          {current && (
            <div className="centre-turn">
              <span className="chip sm" style={{ background: current.color }} />
              {current.name}
            </div>
          )}
          {state.settings.plazaPot && state.plazaPot > 0 && (
            <div className="centre-pot">Plaza pot: {money(state.plazaPot)}</div>
          )}
          {card && (
            <div className={`centre-card ${card.deck}`}>
              <span className="deck-label">{card.deck === 'fortune' ? 'Fortune' : 'Ledger'}</span>
              {CARD_TEXT.get(card.cardId) ?? ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
