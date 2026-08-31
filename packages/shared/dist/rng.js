/**
 * Deterministic PRNG (mulberry32). The whole engine draws from a seed stored
 * in game state, so a game can be replayed exactly from its action log.
 */
export function nextRandom(state) {
    let t = (state + 0x6d2b79f5) | 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    return { value, state: t };
}
export function nextInt(state, minInclusive, maxInclusive) {
    const { value, state: next } = nextRandom(state);
    const span = maxInclusive - minInclusive + 1;
    return { value: minInclusive + Math.floor(value * span), state: next };
}
export function rollDice(state) {
    const a = nextInt(state, 1, 6);
    const b = nextInt(a.state, 1, 6);
    return { value: [a.value, b.value], state: b.state };
}
/** Fisher–Yates using the seeded stream. */
export function shuffle(items, state) {
    const out = [...items];
    let s = state;
    for (let i = out.length - 1; i > 0; i--) {
        const draw = nextInt(s, 0, i);
        s = draw.state;
        const tmp = out[i];
        out[i] = out[draw.value];
        out[draw.value] = tmp;
    }
    return { value: out, state: s };
}
export function randomSeed() {
    return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) | 0;
}
//# sourceMappingURL=rng.js.map