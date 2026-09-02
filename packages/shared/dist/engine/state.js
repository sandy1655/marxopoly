import { DEFAULT_CARDS } from '../data/cards.js';
import { BOARD_SIZE, OWNABLE_TILE_IDS, tileAt } from '../data/board.js';
import { randomSeed, shuffle } from '../rng.js';
export const PLAYER_COLORS = [
    '#e11d48',
    '#2563eb',
    '#16a34a',
    '#f59e0b',
    '#9333ea',
    '#0891b2',
    '#db2777',
    '#65a30d',
];
export const TOKENS = [
    'rocket',
    'anchor',
    'lantern',
    'compass',
    'kite',
    'acorn',
    'bell',
    'crown',
];
export const DEFAULT_SETTINGS = {
    startingCash: 1500,
    startSalary: 200,
    doubleOnExactStart: false,
    auctionsEnabled: true,
    plazaPot: false,
    noRentInHolding: false,
    evenBuild: true,
    doubleRentOnFullGroup: true,
    holdingFine: 50,
    houseSupply: 32,
    hotelSupply: 12,
    turnSeconds: 90,
    seed: 0,
    maxPlayers: 8,
};
export function makeSettings(overrides = {}) {
    const merged = { ...DEFAULT_SETTINGS, ...overrides };
    merged.startingCash = clamp(merged.startingCash, 200, 100000);
    merged.startSalary = clamp(merged.startSalary, 0, 10000);
    merged.holdingFine = clamp(merged.holdingFine, 0, 5000);
    merged.houseSupply = clamp(merged.houseSupply, 0, 200);
    merged.hotelSupply = clamp(merged.hotelSupply, 0, 100);
    merged.turnSeconds = clamp(merged.turnSeconds, 0, 600);
    merged.maxPlayers = clamp(merged.maxPlayers, 2, 8);
    if (!merged.seed)
        merged.seed = randomSeed();
    return merged;
}
function clamp(n, min, max) {
    if (!Number.isFinite(n))
        return min;
    return Math.min(max, Math.max(min, Math.round(n)));
}
export function makePlayer(input, seat, startingCash) {
    return {
        id: input.id,
        name: input.name,
        color: PLAYER_COLORS[seat % PLAYER_COLORS.length],
        token: TOKENS[seat % TOKENS.length],
        cash: startingCash,
        position: 0,
        inHolding: false,
        holdingTurns: 0,
        reprieveCards: 0,
        bankrupt: false,
        connected: true,
        isBot: input.isBot ?? false,
        seat,
        ...(input.name === 'SonToes' ? { sonToesLap: 0 } : {}),
    };
}
export function emptyDeeds() {
    const deeds = {};
    for (const id of OWNABLE_TILE_IDS) {
        deeds[id] = { tileId: id, ownerId: null, houses: 0, mortgaged: false };
    }
    return deeds;
}
function emptyStats(playerIds) {
    return {
        holdingVisits: Object.fromEntries(playerIds.map((id) => [id, 0])),
        plazaTake: Object.fromEntries(playerIds.map((id) => [id, 0])),
        netWorthHistory: [],
    };
}
export function createGame(id, players, settingsOverrides = {}) {
    const settings = makeSettings(settingsOverrides);
    const cards = DEFAULT_CARDS.map((c) => structuredClone(c));
    const fortune = shuffle(deckIds(cards, 'fortune'), settings.seed);
    const ledger = shuffle(deckIds(cards, 'ledger'), fortune.state);
    return {
        id,
        phase: 'lobby',
        settings,
        players: players.map((p, i) => makePlayer(p, i, settings.startingCash)),
        deeds: emptyDeeds(),
        turnSeat: 0,
        dice: null,
        doublesInARow: 0,
        hasRolled: false,
        auction: null,
        debt: null,
        trades: [],
        fortuneDeck: fortune.value,
        ledgerDeck: ledger.value,
        drawnCard: null,
        plazaPot: 0,
        log: [],
        logSeq: 0,
        rngState: ledger.state,
        turnDeadline: null,
        startedAt: null,
        endedAt: null,
        winnerId: null,
        tileNames: {},
        cards,
        stats: emptyStats(players.map((p) => p.id)),
        version: 0,
    };
}
function deckIds(cards, deck) {
    return cards.filter((c) => c.deck === deck).map((c) => c.id);
}
/** Re-shuffle both piles from the current card list. Lobby use only. */
function rebuildDecks(state) {
    const fortune = shuffle(deckIds(state.cards, 'fortune'), state.rngState);
    const ledger = shuffle(deckIds(state.cards, 'ledger'), fortune.state);
    state.fortuneDeck = fortune.value;
    state.ledgerDeck = ledger.value;
    state.rngState = ledger.state;
}
// ---------------------------------------------------------------------------
// Host customisation (lobby only)
// ---------------------------------------------------------------------------
/** Rename a board tile. An empty name restores the default. */
export function renameTile(state, tileId, name) {
    if (state.phase !== 'lobby')
        return state;
    if (!Number.isInteger(tileId) || tileId < 0 || tileId >= BOARD_SIZE)
        return state;
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 28);
    const tileNames = { ...state.tileNames };
    if (!clean || clean === tileAt(tileId).name)
        delete tileNames[tileId];
    else
        tileNames[tileId] = clean;
    return { ...state, tileNames, version: state.version + 1 };
}
/** Append a host-authored card. `id` is assigned by the caller. */
export function addCard(state, card) {
    if (state.phase !== 'lobby')
        return state;
    if (state.cards.some((c) => c.id === card.id))
        return state;
    const next = { ...state, cards: [...state.cards, card], version: state.version + 1 };
    rebuildDecks(next);
    return next;
}
export function removeCard(state, cardId) {
    if (state.phase !== 'lobby')
        return state;
    const target = state.cards.find((c) => c.id === cardId);
    if (!target)
        return state;
    // Never leave a deck with nothing to draw.
    if (state.cards.filter((c) => c.deck === target.deck).length <= 1)
        return state;
    const next = {
        ...state,
        cards: state.cards.filter((c) => c.id !== cardId),
        version: state.version + 1,
    };
    rebuildDecks(next);
    return next;
}
/** Build a Card from a validated input plus a fresh id. */
export function makeCard(input, id) {
    return { id, deck: input.deck, text: input.text, effect: input.effect };
}
export function addPlayerToLobby(state, input) {
    if (state.phase !== 'lobby')
        return state;
    if (state.players.length >= state.settings.maxPlayers)
        return state;
    const seat = state.players.length;
    return {
        ...state,
        players: [...state.players, makePlayer(input, seat, state.settings.startingCash)],
        stats: {
            ...state.stats,
            holdingVisits: { ...state.stats.holdingVisits, [input.id]: 0 },
            plazaTake: { ...state.stats.plazaTake, [input.id]: 0 },
        },
        version: state.version + 1,
    };
}
export function removePlayerFromLobby(state, playerId) {
    if (state.phase !== 'lobby')
        return state;
    const players = state.players
        .filter((p) => p.id !== playerId)
        // Keep humans ahead of bots so seat 0 (the engine's host seat) never lands
        // on a bot when the host leaves the lobby. Array.sort is stable, so the
        // relative order within each group is preserved.
        .sort((a, b) => Number(!!a.isBot) - Number(!!b.isBot))
        .map((p, i) => ({ ...p, seat: i, color: PLAYER_COLORS[i % PLAYER_COLORS.length], token: TOKENS[i % TOKENS.length] }));
    const keep = new Set(players.map((p) => p.id));
    const prune = (record) => Object.fromEntries(Object.entries(record).filter(([id]) => keep.has(id)));
    return {
        ...state,
        players,
        stats: {
            ...state.stats,
            holdingVisits: prune(state.stats.holdingVisits),
            plazaTake: prune(state.stats.plazaTake),
        },
        version: state.version + 1,
    };
}
export function applySettings(state, overrides) {
    if (state.phase !== 'lobby')
        return state;
    const settings = makeSettings({ ...state.settings, ...overrides });
    return {
        ...state,
        settings,
        players: state.players.map((p) => ({ ...p, cash: settings.startingCash })),
        version: state.version + 1,
    };
}
//# sourceMappingURL=state.js.map