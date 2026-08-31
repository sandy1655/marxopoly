import { type GameState, type Tile } from '@marxopoly/shared';
interface Props {
    tile: Tile;
    state: GameState;
    onSelect: (tileId: number) => void;
    selected: boolean;
}
export default function BoardTile({ tile, state, onSelect, selected }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=BoardTile.d.ts.map