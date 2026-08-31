import type { ActionEnvelope, ApplyResult, GameState } from '../types.js';
/**
 * The only way game state changes. Pure: clones, mutates the clone, returns it.
 * Any rejected action leaves the original state untouched.
 */
export declare function applyAction(state: GameState, envelope: ActionEnvelope): ApplyResult;
declare function money(n: number): string;
/** Sell buildings, then mortgage, until the debt is covered or nothing is left. */
export declare function autoLiquidate(g: GameState, playerId: string, now: number): void;
export { money as formatMoney };
//# sourceMappingURL=engine.d.ts.map