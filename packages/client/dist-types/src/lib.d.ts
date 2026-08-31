import { type CardEffect, type GameState, type Player, type Tile } from '@rentier/shared';
export declare function money(value: number): string;
export declare function tileColor(tile: Tile): string | null;
/** CSS grid placement for tile `id` on the 11x11 ring. */
export declare function gridPosition(id: number): {
    gridRow: number;
    gridColumn: number;
};
export type Edge = 'bottom' | 'left' | 'top' | 'right' | 'corner';
export declare function tileEdge(id: number): Edge;
export declare function playersOn(state: GameState, tileId: number): Player[];
export declare function phaseLabel(state: GameState, myId: string | null): string;
export declare function secondsLeft(deadline: number | null): number | null;
/** Fallback marker when a player somehow has no known token. */
export declare function initial(name: string): string;
/** One emoji per seat token (see TOKENS in @rentier/shared). */
export declare const TOKEN_EMOJI: Record<string, string>;
/** The emoji shown for a player's game piece. */
export declare function playerIcon(player: {
    token: string;
    name: string;
}): string;
/**
 * Centre of tile `id`'s cell as a percentage of the board box, for the
 * absolutely-positioned token layer. The ring has 11 tracks sized
 * 1.5fr / 9× 1fr / 1.5fr, so 12 units across.
 */
export declare function tileCentre(id: number): {
    x: number;
    y: number;
};
/** Where a player's piece rests on tile `id`: nudged toward the tile's outer
 *  edge so it sits clear of the street name rather than covering it. */
export declare function tokenSpot(id: number): {
    x: number;
    y: number;
};
/** Plain-English summary of a card's effect, derived from the effect object so
 *  new cards added to `packages/shared/src/data/cards.ts` describe themselves. */
export declare function describeCardEffect(effect: CardEffect): string;
//# sourceMappingURL=lib.d.ts.map