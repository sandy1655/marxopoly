import { useState } from 'react';
import { BOARD, tileLabel, type GameState } from '@rentier/shared';
import { removeCard, renameTile } from '../net.js';
import { describeCardEffect } from '../lib.js';
import CardEditor from './CardEditor.js';

interface Props {
  state: GameState;
  /** The host, in the lobby, can add/delete cards and rename tiles. */
  editable: boolean;
  onClose: () => void;
}

type Tab = 'fortune' | 'ledger' | 'streets';

export default function CardsPanel({ state, editable, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('fortune');
  const [creating, setCreating] = useState(false);

  const deckCards = state.cards.filter((c) => c.deck === tab);

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal cards" onClick={(e) => e.stopPropagation()}>
          <header>
            <h2>{editable ? 'Customise cards & board' : 'Card decks'}</h2>
            <button className="btn ghost small" onClick={onClose}>
              Close
            </button>
          </header>

          <div className="tabs">
            <button className={tab === 'fortune' ? 'active' : ''} onClick={() => setTab('fortune')}>
              Fortune ({state.cards.filter((c) => c.deck === 'fortune').length})
            </button>
            <button className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}>
              Ledger ({state.cards.filter((c) => c.deck === 'ledger').length})
            </button>
            <button className={tab === 'streets' ? 'active' : ''} onClick={() => setTab('streets')}>
              Streets
            </button>
          </div>

          {tab === 'streets' ? (
            <>
              <p className="muted small">
                {editable
                  ? 'Rename any tile. Blank restores the original name. Locked once the game starts.'
                  : 'Tile names in this game.'}
              </p>
              <ul className="card-list">
                {BOARD.filter((t) => t.kind === 'street' || t.kind === 'depot' || t.kind === 'works').map(
                  (t) => (
                    <li key={t.id} className="street-row">
                      <span className="card-id">{t.id}</span>
                      {editable ? (
                        <input
                          className="input"
                          defaultValue={state.tileNames[t.id] ?? t.name}
                          maxLength={28}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (state.tileNames[t.id] ?? t.name)) renameTile(t.id, v);
                          }}
                        />
                      ) : (
                        <span className="street-name">{tileLabel(state, t.id)}</span>
                      )}
                      <span className="muted small">{t.name}</span>
                    </li>
                  ),
                )}
              </ul>
            </>
          ) : (
            <>
              <p className="muted small">
                The effect line is generated from the card, so custom cards read the same way.
                {editable ? ' A deck must keep at least one card.' : ''}
              </p>

              {editable && (
                <button className="btn small" onClick={() => setCreating(true)}>
                  + New {tab === 'fortune' ? 'Fortune' : 'Ledger'} card
                </button>
              )}

              <ul className="card-list">
                {deckCards.map((c) => (
                  <li key={c.id} className="card-row">
                    <span className="card-id">{c.id}</span>
                    <div className="card-copy">
                      <span className="card-text">{c.text}</span>
                      <span className="card-effect">{describeCardEffect(c.effect, state.tileNames)}</span>
                    </div>
                    <code className="card-kind">{c.effect.kind}</code>
                    {editable && (
                      <button
                        className="btn ghost small danger"
                        title="Delete this card"
                        disabled={deckCards.length <= 1}
                        onClick={() => removeCard(c.id)}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {creating && (
        <CardEditor state={state} onClose={() => setCreating(false)} />
      )}
    </>
  );
}
