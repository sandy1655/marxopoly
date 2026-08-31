import { type GameState } from '@marxopoly/shared';
interface Props {
    state: GameState;
    selected: number | null;
    onSelect: (tileId: number) => void;
}
export default function Board({ state, selected, onSelect }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=Board.d.ts.map