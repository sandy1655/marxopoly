import { useState } from 'react';
import {
  BOARD,
  sanitizeCardInput,
  tileLabel,
  type CardEffect,
  type CardEffectKind,
  type GameState,
} from '@marxopoly/shared';
import { addCard } from '../net.js';
import { describeCardEffect } from '../lib.js';

interface Props {
  state: GameState;
  onClose: () => void;
}

const KINDS: { value: CardEffectKind; label: string }[] = [
  { value: 'cash', label: 'Money to / from the bank' },
  { value: 'collect_each', label: 'Collect from every other player' },
  { value: 'pay_each', label: 'Pay every other player' },
  { value: 'move_to', label: 'Move to a specific tile' },
  { value: 'move_by', label: 'Move forwards / backwards' },
  { value: 'advance_nearest', label: 'Advance to the nearest depot / works' },
  { value: 'goto_holding', label: 'Send to the holding yard' },
  { value: 'reprieve', label: 'Grant a reprieve card' },
  { value: 'assessment', label: 'Repair bill (per house / hotel)' },
];

export default function CardEditor({ state, onClose }: Props) {
  const [deck, setDeck] = useState<'fortune' | 'ledger'>('fortune');
  const [text, setText] = useState('');
  const [kind, setKind] = useState<CardEffectKind>('cash');

  const [amount, setAmount] = useState(100);
  const [tile, setTile] = useState(0);
  const [collectStart, setCollectStart] = useState(true);
  const [steps, setSteps] = useState(-3);
  const [target, setTarget] = useState<'depot' | 'works'>('depot');
  const [multiplier, setMultiplier] = useState(2);
  const [perHouse, setPerHouse] = useState(25);
  const [perHotel, setPerHotel] = useState(100);

  const effect = buildEffect();
  const check = sanitizeCardInput({ deck, text, effect });
  const error = typeof check === 'string' ? check : null;

  function buildEffect(): CardEffect {
    switch (kind) {
      case 'cash':
      case 'collect_each':
      case 'pay_each':
        return { kind, amount };
      case 'move_to':
        return { kind, tile, collectStart };
      case 'move_by':
        return { kind, steps };
      case 'advance_nearest':
        return { kind, target, multiplier };
      case 'goto_holding':
        return { kind: 'goto_holding' };
      case 'reprieve':
        return { kind: 'reprieve' };
      case 'assessment':
        return { kind, perHouse, perHotel };
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (error) return;
    addCard({ deck, text: text.trim(), effect });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal card-editor" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header>
          <h2>New special card</h2>
          <button type="button" className="btn ghost small" onClick={onClose}>
            Cancel
          </button>
        </header>

        <label className="field">
          <span>Deck</span>
          <div className="seg">
            {(['fortune', 'ledger'] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={deck === d ? 'active' : ''}
                onClick={() => setDeck(d)}
              >
                {d === 'fortune' ? 'Fortune' : 'Ledger'}
              </button>
            ))}
          </div>
        </label>

        <label className="field">
          <span>Card text (what the player reads)</span>
          <textarea
            className="input"
            rows={2}
            maxLength={240}
            value={text}
            placeholder="e.g. The council rewards your civic spirit. Collect 100."
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        <label className="field">
          <span>What it does</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as CardEffectKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        <div className="editor-params">
          {(kind === 'cash' || kind === 'collect_each' || kind === 'pay_each') && (
            <label className="field">
              <span>
                Amount{kind === 'cash' ? ' (negative = pay the bank)' : ''}
              </span>
              <input
                className="input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.round(Number(e.target.value)))}
              />
            </label>
          )}

          {kind === 'move_to' && (
            <>
              <label className="field">
                <span>Destination</span>
                <select className="input" value={tile} onChange={(e) => setTile(Number(e.target.value))}>
                  {BOARD.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id}. {tileLabel(state, t.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={collectStart}
                  onChange={(e) => setCollectStart(e.target.checked)}
                />
                <span>Collect salary if they pass Start</span>
              </label>
            </>
          )}

          {kind === 'move_by' && (
            <label className="field">
              <span>Tiles (negative = backwards)</span>
              <input
                className="input"
                type="number"
                value={steps}
                onChange={(e) => setSteps(Math.round(Number(e.target.value)))}
              />
            </label>
          )}

          {kind === 'advance_nearest' && (
            <>
              <label className="field">
                <span>Target</span>
                <select
                  className="input"
                  value={target}
                  onChange={(e) => setTarget(e.target.value as 'depot' | 'works')}
                >
                  <option value="depot">Nearest depot</option>
                  <option value="works">Nearest works</option>
                </select>
              </label>
              <label className="field">
                <span>Rent multiplier (×)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={50}
                  value={multiplier}
                  onChange={(e) => setMultiplier(Math.round(Number(e.target.value)))}
                />
              </label>
            </>
          )}

          {kind === 'assessment' && (
            <>
              <label className="field">
                <span>Per house</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={perHouse}
                  onChange={(e) => setPerHouse(Math.round(Number(e.target.value)))}
                />
              </label>
              <label className="field">
                <span>Per hotel</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={perHotel}
                  onChange={(e) => setPerHotel(Math.round(Number(e.target.value)))}
                />
              </label>
            </>
          )}

          {(kind === 'goto_holding' || kind === 'reprieve') && (
            <p className="muted small">No settings — this effect is all-or-nothing.</p>
          )}
        </div>

        <p className="card-effect editor-preview">{describeCardEffect(effect, state.tileNames)}</p>
        {error && <p className="warn small">{error}</p>}

        <button type="submit" className="btn primary full" disabled={!!error}>
          Add to the {deck === 'fortune' ? 'Fortune' : 'Ledger'} deck
        </button>
      </form>
    </div>
  );
}
