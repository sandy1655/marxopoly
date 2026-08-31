import { type GameState } from '@rentier/shared';
interface Props {
    state: GameState;
    myId: string | null;
    onTrade: (playerId: string) => void;
}
export default function PlayerList({ state, myId, onTrade }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=PlayerList.d.ts.map