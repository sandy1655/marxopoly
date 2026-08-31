import type { GameState, OwnableTile, Player, Tile } from '../types.js';
export declare function getPlayer(state: GameState, id: string): Player | undefined;
export declare function requirePlayer(state: GameState, id: string): Player;
export declare function currentPlayer(state: GameState): Player | undefined;
export declare function activePlayers(state: GameState): Player[];
export declare function ownableTile(tileId: number): OwnableTile | null;
/** A tile's name for display, honouring the host's lobby renames. */
export declare function tileLabel(state: Pick<GameState, 'tileNames'>, tileId: number): string;
export declare function ownedTileIds(state: GameState, playerId: string): number[];
export declare function groupOf(tile: Tile): string | null;
export declare function ownsWholeGroup(state: GameState, playerId: string, group: string): boolean;
export declare function countOwnedInGroup(state: GameState, playerId: string, group: string): number;
export declare function groupHasBuildings(state: GameState, group: string): boolean;
export declare function mortgageValue(tile: OwnableTile): number;
export declare function unmortgageCost(tile: OwnableTile): number;
/** Houses (1..4) currently placed on the board. Hotels are counted separately. */
export declare function housesInUse(state: GameState): number;
export declare function hotelsInUse(state: GameState): number;
/**
 * Rent owed for landing on `tileId`. `diceTotal` only matters for works.
 * Returns 0 when the tile is unowned, mortgaged, or owned by the visitor.
 */
export declare function rentFor(state: GameState, tileId: number, visitorId: string, diceTotal: number): number;
export interface BuildCheck {
    ok: boolean;
    reason?: string;
    cost?: number;
}
export declare function canBuild(state: GameState, playerId: string, tileId: number): BuildCheck;
export declare function canSellBuilding(state: GameState, playerId: string, tileId: number): BuildCheck;
export declare function canMortgage(state: GameState, playerId: string, tileId: number): BuildCheck;
/** Cash plus everything the player could raise by selling buildings and mortgaging. */
export declare function liquidValue(state: GameState, playerId: string): number;
/** Cash + full property value + buildings at cost. Used for the scoreboard. */
export declare function netWorth(state: GameState, playerId: string): number;
export declare function nextTileOfKind(from: number, kind: 'depot' | 'works'): number;
export declare function isPlayersTurn(state: GameState, playerId: string): boolean;
export declare function standings(state: GameState): {
    playerId: string;
    net: number;
}[];
//# sourceMappingURL=selectors.d.ts.map