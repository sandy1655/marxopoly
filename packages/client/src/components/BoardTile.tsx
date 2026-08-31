import { type Deed, type GameState, type Tile } from '@rentier/shared';
import { TOKEN_GLYPHS, gridPosition, money, playersOn, tileColor, tileEdge } from '../lib.js';

interface Props {
  tile: Tile;
  state: GameState;
  onSelect: (tileId: number) => void;
  selected: boolean;
}

const KIND_GLYPH: Record<string, string> = {
  start: '➜',
  holding: '⌗',
  plaza: '✧',
  dispatch: '⚑',
  fortune: '?',
  ledger: '✎',
  tax: '$',
  depot: '▤',
  works: '⚙',
};

export default function BoardTile({ tile, state, onSelect, selected }: Props) {
  const deed: Deed | undefined = state.deeds[tile.id];
  const owner = deed?.ownerId ? state.players.find((p) => p.id === deed.ownerId) : null;
  const color = tileColor(tile);
  const edge = tileEdge(tile.id);
  const here = playersOn(state, tile.id);
  const ownable = tile.kind === 'street' || tile.kind === 'depot' || tile.kind === 'works';

  return (
    <button
      type="button"
      className={`tile edge-${edge}${selected ? ' selected' : ''}${deed?.mortgaged ? ' mortgaged' : ''}`}
      style={{ ...gridPosition(tile.id) }}
      onClick={() => ownable && onSelect(tile.id)}
      aria-label={tile.name}
    >
      {color && <span className="tile-band" style={{ background: color }} />}
      {owner && <span className="tile-owner" style={{ background: owner.color }} />}

      <span className="tile-body">
        <span className="tile-name">{tile.name}</span>
        {tile.kind === 'street' && <span className="tile-price">{money(tile.price)}</span>}
        {(tile.kind === 'depot' || tile.kind === 'works') && (
          <span className="tile-price">{money(tile.price)}</span>
        )}
        {tile.kind === 'tax' && <span className="tile-price">{money(tile.amount)}</span>}
        {!ownable && tile.kind !== 'tax' && (
          <span className="tile-glyph">{KIND_GLYPH[tile.kind] ?? ''}</span>
        )}
      </span>

      {deed && deed.houses > 0 && (
        <span className="tile-buildings">
          {deed.houses === 5 ? <span className="hotel">H</span> : '▪'.repeat(deed.houses)}
        </span>
      )}
      {deed?.mortgaged && <span className="tile-mortgage">MTG</span>}

      <span className="tile-tokens">
        {here.map((p) => (
          <span
            key={p.id}
            className={`token${state.players.find((x) => x.seat === state.turnSeat)?.id === p.id ? ' active' : ''}`}
            style={{ background: p.color }}
            title={p.name}
          >
            {TOKEN_GLYPHS[p.token] ?? '●'}
          </span>
        ))}
      </span>
    </button>
  );
}
