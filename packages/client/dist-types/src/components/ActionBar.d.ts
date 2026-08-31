import { type GameState } from '@marxopoly/shared';
interface Props {
    state: GameState;
    myId: string | null;
    onManage: () => void;
}
export default function ActionBar({ state, myId, onManage }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=ActionBar.d.ts.map