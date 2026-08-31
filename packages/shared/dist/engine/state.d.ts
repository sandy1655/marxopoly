import type { Card, CardInput, Deed, GameSettings, GameState, Player } from '../types.js';
export declare const PLAYER_COLORS: readonly ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#0891b2", "#db2777", "#65a30d"];
export declare const TOKENS: readonly ["rocket", "anchor", "lantern", "compass", "kite", "acorn", "bell", "crown"];
export declare const DEFAULT_SETTINGS: GameSettings;
export declare function makeSettings(overrides?: Partial<GameSettings>): GameSettings;
export interface NewPlayerInput {
    id: string;
    name: string;
    isBot?: boolean;
}
export declare function makePlayer(input: NewPlayerInput, seat: number, startingCash: number): Player;
export declare function emptyDeeds(): Record<number, Deed>;
export declare function createGame(id: string, players: NewPlayerInput[], settingsOverrides?: Partial<GameSettings>): GameState;
/** Rename a board tile. An empty name restores the default. */
export declare function renameTile(state: GameState, tileId: number, name: string): GameState;
/** Append a host-authored card. `id` is assigned by the caller. */
export declare function addCard(state: GameState, card: Card): GameState;
export declare function removeCard(state: GameState, cardId: string): GameState;
/** Build a Card from a validated input plus a fresh id. */
export declare function makeCard(input: CardInput, id: string): Card;
export declare function addPlayerToLobby(state: GameState, input: NewPlayerInput): GameState;
export declare function removePlayerFromLobby(state: GameState, playerId: string): GameState;
export declare function applySettings(state: GameState, overrides: Partial<GameSettings>): GameState;
//# sourceMappingURL=state.d.ts.map