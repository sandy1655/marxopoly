import { useState } from 'react';
import {
  GROUP_COLORS,
  GROUP_LABELS,
  GROUP_ORDER,
  GROUP_TILES,
  ownsWholeGroup,
  tileLabel,
  type GameState,
} from '@rentier/shared';

interface Props {
  state: GameState;
  myId: string | null;
}

const GROUPS: readonly string[] = [...GROUP_ORDER, 'depot', 'works'];

export default function Properties({ state, myId }: Props) {
  const [mineOnly, setMineOnly] = useState(true);
  const playerById = new Map(state.players.map((p) => [p.id, p]));
  const myCount = myId
    ? Object.values(state.deeds).filter((d) => d.ownerId === myId).length
    : 0;
  // "Mine" is the default, but a spectator with no seat always sees everything.
  const showMineOnly = mineOnly && !!myId;

  return (
    <div className="panel deeds">
      <div className="deeds-head">
        <h2>Properties</h2>
        {myId && (
          <div className="tabs deeds-tabs">
            <button className={mineOnly ? '' : 'active'} onClick={() => setMineOnly(false)}>
              All
            </button>
            <button className={mineOnly ? 'active' : ''} onClick={() => setMineOnly(true)}>
              Mine ({myCount})
            </button>
          </div>
        )}
      </div>

      <div className="deeds-groups">
        {GROUPS.map((group) => {
          const color = GROUP_COLORS[group as keyof typeof GROUP_COLORS];
          const rows = (GROUP_TILES[group] ?? [])
            .map((id) => ({ id, deed: state.deeds[id] }))
            .filter((r) => !showMineOnly || r.deed?.ownerId === myId);
          if (rows.length === 0) return null;

          const fullSet = !!myId && ownsWholeGroup(state, myId, group);

          return (
            <div key={group} className="deed-group">
              <div className="deed-group-head">
                <span className="deed-group-band" style={{ background: color }} />
                <span className="deed-group-name">
                  {GROUP_LABELS[group as keyof typeof GROUP_LABELS]}
                </span>
                {fullSet && <span className="tag you">full set</span>}
              </div>

              {rows.map(({ id, deed }) => {
                const owner = deed?.ownerId ? playerById.get(deed.ownerId) : null;
                const isMine = !!owner && owner.id === myId;
                return (
                  <div
                    key={id}
                    className={`deed-item${isMine ? ' mine' : ''}${deed?.mortgaged ? ' mtg' : ''}`}
                  >
                    <span className="deed-item-band" style={{ background: color }} />
                    <span className="deed-item-name">
                      {tileLabel(state, id)}
                      {deed && deed.houses > 0 && (
                        <span className="deed-item-houses">
                          {deed.houses === 5 ? 'Hotel' : `${deed.houses}h`}
                        </span>
                      )}
                      {deed?.mortgaged && <span className="deed-item-flag">MTG</span>}
                    </span>
                    <span className="deed-item-owner">
                      {owner ? (
                        <>
                          <span className="chip xs" style={{ background: owner.color }} />
                          <span className={isMine ? 'accent' : ''}>
                            {isMine ? 'You' : owner.name}
                          </span>
                        </>
                      ) : (
                        <span className="muted">Bank</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {showMineOnly && myCount === 0 && <p className="muted small">You do not own anything yet.</p>}
    </div>
  );
}
