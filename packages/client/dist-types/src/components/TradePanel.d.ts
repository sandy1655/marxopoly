import { type GameState } from '@marxopoly/shared';
interface Props {
    state: GameState;
    myId: string;
    partnerId: string;
    onClose: () => void;
}
export default function TradePanel({ state, myId, partnerId, onClose }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=TradePanel.d.ts.map