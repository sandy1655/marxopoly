import {
  canBuild,
  canMortgage,
  canSellBuilding,
  mortgageValue,
  ownableTile,
  ownedTileIds,
  unmortgageCost,
  type GameState,
} from '@rentier/shared';
import { send } from '../net.js';
import { money, tileColor } from '../lib.js';

interface Props {
  state: GameState;
  myId: string;
  onClose: () => void;
}

export default function ManagePanel({ state, myId, onClose }: Props) {
  const tiles = ownedTileIds(state, myId);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manage" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Your properties</h2>
          <button className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </header>

        {tiles.length === 0 && <p className="muted">You do not own anything yet.</p>}

        <div className="manage-list">
          {tiles.map((id) => {
            const tile = ownableTile(id)!;
            const deed = state.deeds[id]!;
            const build = canBuild(state, myId, id);
            const sell = canSellBuilding(state, myId, id);
            const mort = canMortgage(state, myId, id);
            const me = state.players.find((p) => p.id === myId)!;

            return (
              <div key={id} className="manage-row">
                <span className="manage-band" style={{ background: tileColor(tile) ?? '#475569' }} />
                <div className="manage-info">
                  <strong>{tile.name}</strong>
                  <span className="muted small">
                    {deed.mortgaged
                      ? 'Mortgaged'
                      : deed.houses === 5
                        ? 'Hotel'
                        : deed.houses > 0
                          ? `${deed.houses} house${deed.houses > 1 ? 's' : ''}`
                          : 'Unimproved'}
                  </span>
                </div>
                <div className="manage-actions">
                  {tile.kind === 'street' && (
                    <>
                      <button
                        className="btn small"
                        disabled={!build.ok}
                        title={build.reason}
                        onClick={() => send({ type: 'build', tileId: id })}
                      >
                        Build {money(tile.buildCost)}
                      </button>
                      <button
                        className="btn small"
                        disabled={!sell.ok}
                        title={sell.reason}
                        onClick={() => send({ type: 'sell_building', tileId: id })}
                      >
                        Sell +{money(Math.floor(tile.buildCost / 2))}
                      </button>
                    </>
                  )}
                  {deed.mortgaged ? (
                    <button
                      className="btn small"
                      disabled={me.cash < unmortgageCost(tile)}
                      onClick={() => send({ type: 'unmortgage', tileId: id })}
                    >
                      Lift {money(unmortgageCost(tile))}
                    </button>
                  ) : (
                    <button
                      className="btn small"
                      disabled={!mort.ok}
                      title={mort.reason}
                      onClick={() => send({ type: 'mortgage', tileId: id })}
                    >
                      Mortgage +{money(mortgageValue(tile))}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
