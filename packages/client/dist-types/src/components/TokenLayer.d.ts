import type { GameState } from '@marxopoly/shared';
import { type BoardLayout } from '../maps/index.js';
interface Props {
    state: GameState;
    layout: BoardLayout;
}
/**
 * Player pieces drawn on a layer over the board so they can walk tile by tile
 * when a player's position changes, instead of jumping. A move that follows a
 * dice roll waits for the dice animation to finish before the piece sets off.
 */
export default function TokenLayer({ state, layout }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=TokenLayer.d.ts.map