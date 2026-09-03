import { type GameState, type Tile } from '@marxopoly/shared';
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
export default function BoardTile({ tile, state, layout, special: specialMap, onSelect, selected }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=BoardTile.d.ts.map