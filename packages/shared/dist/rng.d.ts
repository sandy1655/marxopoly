/**
 * Deterministic PRNG (mulberry32). The whole engine draws from a seed stored
 * in game state, so a game can be replayed exactly from its action log.
 */
export interface RandomDraw<T> {
    value: T;
    state: number;
}
export declare function nextRandom(state: number): {
    value: number;
    state: number;
};
export declare function nextInt(state: number, minInclusive: number, maxInclusive: number): RandomDraw<number>;
export declare function rollDice(state: number): RandomDraw<[number, number]>;
/** Fisher–Yates using the seeded stream. */
export declare function shuffle<T>(items: readonly T[], state: number): RandomDraw<T[]>;
export declare function randomSeed(): number;
//# sourceMappingURL=rng.d.ts.map