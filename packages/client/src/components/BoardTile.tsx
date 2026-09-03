import { type Deed, type GameState, type Tile } from '@marxopoly/shared';
import { money, tileColor } from '../lib.js';
import type { BoardLayout, SpecialTileStyle } from '../maps/index.js';

interface Props {
  tile: Tile;
  state: GameState;
  layout: BoardLayout;
  /** Per-map colours + glyphs for the non-ownable tile kinds. */
  special: Record<string, SpecialTileStyle>;
  onSelect: (tileId: number) => void;
  selected: boolean;
}

export default function BoardTile({ tile, state, layout, special: specialMap, onSelect, selected }: Props) {
  const deed: Deed | undefined = state.deeds[tile.id];
  const owner = deed?.ownerId ? state.players.find((p) => p.id === deed.ownerId) : null;
  const edge = layout.edge(tile.id);
  const ownable = tile.kind === 'street' || tile.kind === 'depot' || tile.kind === 'works';
  const special = specialMap[tile.kind];
  const isCorner = edge === 'corner';
  const custom = state.tileNames[tile.id];
  const label = isCorner
    ? special?.label ?? tile.name
    : custom ?? tile.short ?? tile.name;

  const classes = [
    'tile',
    `edge-${edge}`,
    ownable ? 'ownable' : 'special',
    isCorner ? 'corner' : '',
    selected ? 'selected' : '',
    deed?.mortgaged ? 'mortgaged' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      style={{
        ...layout.position(tile.id),
        ...(isCorner || !ownable ? { '--tile-bg': special?.bg ?? '#f1f5f9' } : null),
      } as React.CSSProperties}
      onClick={() => ownable && onSelect(tile.id)}
      aria-label={custom ?? tile.name}
    >
      {/* Ownership shows as a thick bar on the tile's outer edge. */}
      {owner && <span className="tile-owner-bar" style={{ background: owner.color }} />}

      {ownable && (
        <span className="tile-head" style={{ background: tileColor(tile) ?? '#94a3b8' }}>
          {deed && deed.houses > 0 && (
            <span className="tile-buildings">
              {deed.houses === 5 ? <span className="hotel">HOTEL</span> : '●'.repeat(deed.houses)}
            </span>
          )}
        </span>
      )}

      <span className="tile-body">
        {!ownable && special && <span className="tile-glyph">{special.glyph}</span>}
        <span className="tile-name">{label}</span>
        {'price' in tile && <span className="tile-price">{money(tile.price)}</span>}
        {tile.kind === 'tax' && <span className="tile-price">Pay {money(tile.amount)}</span>}
        {deed?.mortgaged && <span className="tile-mortgage">MORTGAGED</span>}
      </span>
    </button>
  );
}
