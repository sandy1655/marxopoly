/**
 * Marxopoly — shared domain types.
 *
 * Everything the server and the client agree on lives here. The engine is a
 * pure function of (state, action) -> state, so these types are the whole
 * contract between the two runtimes.
 */
export function isOwnable(tile) {
    return tile.kind === 'street' || tile.kind === 'depot' || tile.kind === 'works';
}
//# sourceMappingURL=types.js.map