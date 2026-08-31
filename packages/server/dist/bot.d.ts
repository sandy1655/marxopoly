import { type GameAction, type GameState } from '@marxopoly/shared';
/**
 * A deliberately simple heuristic opponent. It is not trying to be strong —
 * it is trying to keep a table moving when seats are empty.
 */
export declare function decideBotAction(state: GameState, playerId: string): GameAction | null;
//# sourceMappingURL=bot.d.ts.map