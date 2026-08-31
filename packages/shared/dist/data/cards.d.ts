import type { Card, CardEffect, CardInput } from '../types.js';
export declare const FORTUNE_CARDS: readonly Card[];
export declare const LEDGER_CARDS: readonly Card[];
export declare const ALL_CARDS: readonly Card[];
/** The default deck contents a fresh game starts with (mutable copy). */
export declare const DEFAULT_CARDS: readonly Card[];
export declare function cardById(id: string): Card;
/** Turn an untrusted `{ deck, text, effect }` payload into a clean effect, or
 *  return an error string. Keeps every custom card safe for the engine. */
export declare function sanitizeCardEffect(raw: unknown): CardEffect | string;
export declare function sanitizeCardInput(raw: unknown): CardInput | string;
//# sourceMappingURL=cards.d.ts.map