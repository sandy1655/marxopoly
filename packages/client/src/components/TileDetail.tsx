import {
  DEPOT_RENT,
  WORKS_MULTIPLIER,
  countOwnedInGroup,
  mortgageValue,
  ownableTile,
  tileLabel,
  type GameState,
} from '@rentier/shared';
import { money, tileColor } from '../lib.js';

interface Props {
  state: GameState;
  tileId: number;
  onClose: () => void;
}

export default function TileDetail({ state, tileId, onClose }: Props) {
  const tile = ownableTile(tileId);
  if (!tile) return null;
  const deed = state.deeds[tileId]!;
  const owner = deed.ownerId ? state.players.find((p) => p.id === deed.ownerId) : null;

  return (
    <div className="panel detail">
      <div className="detail-head" style={{ background: tileColor(tile) ?? '#475569' }}>
        <strong>{tileLabel(state, tileId)}</strong>
        <button className="x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="detail-body">
        <div className="detail-row">
          <span>Price</span>
          <span>{money(tile.price)}</span>
        </div>
        <div className="detail-row">
          <span>Owner</span>
          <span>{owner ? owner.name : 'Bank'}</span>
        </div>
        {deed.mortgaged && <p className="warn small">Mortgaged — no rent is collected.</p>}

        {tile.kind === 'street' && (
          <>
            <div className="rent-table">
              {['Base rent', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel'].map((label, i) => (
                <div key={label} className={`detail-row${deed.houses === i ? ' current' : ''}`}>
                  <span>{label}</span>
                  <span>{money(tile.rent[i] ?? 0)}</span>
                </div>
              ))}
            </div>
            <div className="detail-row">
              <span>House cost</span>
              <span>{money(tile.buildCost)}</span>
            </div>
          </>
        )}

        {tile.kind === 'depot' && (
          <div className="rent-table">
            {DEPOT_RENT.slice(1).map((rent, i) => {
              const held = owner ? countOwnedInGroup(state, owner.id, 'depot') : 0;
              return (
                <div key={rent} className={`detail-row${held === i + 1 ? ' current' : ''}`}>
                  <span>{i + 1} depot{i > 0 ? 's' : ''}</span>
                  <span>{money(rent)}</span>
                </div>
              );
            })}
          </div>
        )}

        {tile.kind === 'works' && (
          <div className="rent-table">
            {WORKS_MULTIPLIER.slice(1).map((mult, i) => {
              const held = owner ? countOwnedInGroup(state, owner.id, 'works') : 0;
              return (
                <div key={mult} className={`detail-row${held === i + 1 ? ' current' : ''}`}>
                  <span>{i + 1} works</span>
                  <span>{mult}× the roll</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="detail-row">
          <span>Mortgage value</span>
          <span>{money(mortgageValue(tile))}</span>
        </div>
      </div>
    </div>
  );
}
