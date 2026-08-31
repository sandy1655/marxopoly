import { type GameState } from '@marxopoly/shared';
interface Props {
    state: GameState;
    /** The host, in the lobby, can add/delete cards and rename tiles. */
    editable: boolean;
    onClose: () => void;
}
export default function CardsPanel({ state, editable, onClose }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=CardsPanel.d.ts.map