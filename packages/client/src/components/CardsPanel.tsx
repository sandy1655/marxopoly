import { FORTUNE_CARDS, LEDGER_CARDS, type Card } from '@rentier/shared';
import { describeCardEffect } from '../lib.js';

interface Props {
  onClose: () => void;
}

const DECKS: [string, readonly Card[]][] = [
  ['Fortune', FORTUNE_CARDS],
  ['Ledger', LEDGER_CARDS],
];

export default function CardsPanel({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal cards" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Card decks</h2>
          <button className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="muted small">
          Defined in <code>packages/shared/src/data/cards.ts</code>. The effect line under each
          card is generated from its <code>effect</code>, so anything you add or change shows up
          here straight away.
        </p>

        {DECKS.map(([label, cards]) => (
          <section key={label} className="card-deck">
            <h3>
              {label} <span className="muted">· {cards.length} cards</span>
            </h3>
            <ul className="card-list">
              {cards.map((c) => (
                <li key={c.id} className="card-row">
                  <span className="card-id">{c.id}</span>
                  <div className="card-copy">
                    <span className="card-text">{c.text}</span>
                    <span className="card-effect">{describeCardEffect(c.effect)}</span>
                  </div>
                  <code className="card-kind">{c.effect.kind}</code>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
