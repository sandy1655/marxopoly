import { type CardEffect, type GameState, type Player, type Tile } from '@marxopoly/shared';
export declare function money(value: number): string;
/** Compact money for tight spots like chart axes: $0, $850, $1.2k, $3.4M. */
export declare function compactMoney(value: number): string;
export declare function tileColor(tile: Tile): string | null;
export declare function playersOn(state: GameState, tileId: number): Player[];
export declare function phaseLabel(state: GameState, myId: string | null): string;
export declare function secondsLeft(deadline: number | null): number | null;
/** Fallback marker when a player somehow has no known token. */
export declare function initial(name: string): string;
/** One emoji per seat token (see TOKENS in @marxopoly/shared). */
export declare const TOKEN_EMOJI: Record<string, string>;
/** The emoji shown for a player's game piece. */
export declare function playerIcon(player: {
    token: string;
    name: string;
}): string;
/** Plain-English summary of a card's effect, derived from the effect object so
 *  new cards describe themselves. Pass `tileNames` for the host's renames. */
export declare function describeCardEffect(effect: CardEffect, tileNames?: Record<number, string>): string;
//# sourceMappingURL=lib.d.ts.map