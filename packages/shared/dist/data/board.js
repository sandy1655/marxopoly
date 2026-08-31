/**
 * The Marxopoly board: 40 tiles running clockwise from Start (index 0).
 * Streets, depots and works are the ownable tiles.
 */
const street = (id, name, short, group, price, rent, buildCost) => ({ id, name, short, kind: 'street', group, price, rent, buildCost });
const depot = (id, name) => ({
    id,
    name,
    kind: 'depot',
    group: 'depot',
    price: 200,
});
const works = (id, name, short) => ({
    id,
    name,
    short,
    kind: 'works',
    group: 'works',
    price: 150,
});
export const BOARD = Object.freeze([
    { id: 0, name: 'Start', kind: 'start' },
    street(1, 'Stalingrad', 'Stalingrad', 'clay', 60, [2, 10, 30, 90, 160, 250], 50),
    { id: 2, name: 'Ledger', kind: 'ledger' },
    street(3, 'Leningrad', 'Leningrad', 'clay', 60, [4, 20, 60, 180, 320, 450], 50),
    { id: 4, name: 'Income Levy', short: 'Income', kind: 'tax', amount: 200 },
    depot(5, 'Stuttgart 21'),
    street(6, 'Tel Aviv', 'Tel Aviv', 'sky', 100, [6, 30, 90, 270, 400, 550], 50),
    { id: 7, name: 'Fortune', kind: 'fortune' },
    street(8, 'Jerusalem', 'Jerusalem', 'sky', 100, [6, 30, 90, 270, 400, 550], 50),
    street(9, 'Gaza Strip', 'Gaza Strip', 'sky', 120, [8, 40, 100, 300, 450, 600], 50),
    { id: 10, name: 'Holding Yard', kind: 'holding' },
    street(11, 'Bangkok', 'Bangkok', 'rose', 140, [10, 50, 150, 450, 625, 750], 100),
    works(12, 'AI Datacenter', 'Datacenter'),
    street(13, 'Phuket', 'Phuket', 'rose', 140, [10, 50, 150, 450, 625, 750], 100),
    street(14, 'Ladyboy Street', 'Ladyboy Street', 'rose', 160, [12, 60, 180, 500, 700, 900], 100),
    depot(15, 'Berlin Flughafen'),
    street(16, 'Folk Valley', 'Folk Valley', 'amber', 180, [14, 70, 200, 550, 750, 950], 100),
    { id: 17, name: 'Ledger', kind: 'ledger' },
    street(18, 'Epstein Island', 'Epstein Island', 'amber', 180, [14, 70, 200, 550, 750, 950], 100),
    street(19, 'Dagestan', 'Dagestan', 'amber', 200, [16, 80, 220, 600, 800, 1000], 100),
    { id: 20, name: 'Plaza', kind: 'plaza' },
    street(21, 'Mumbai', 'Mumbai', 'crimson', 220, [18, 90, 250, 700, 875, 1050], 150),
    { id: 22, name: 'Fortune', kind: 'fortune' },
    street(23, 'Bangalore', 'Bangalore', 'crimson', 220, [18, 90, 250, 700, 875, 1050], 150),
    street(24, 'Curry-City', 'Curry-City', 'crimson', 240, [20, 100, 300, 750, 925, 1100], 150),
    depot(25, 'Hamburger Hafen'),
    street(26, 'Feuerbach', 'Feuerbach', 'gold', 260, [22, 110, 330, 800, 975, 1150], 150),
    street(27, 'Cannstatt', 'Cannstatt', 'gold', 260, [22, 110, 330, 800, 975, 1150], 150),
    works(28, 'Plantation', 'Plantation'),
    street(29, 'Bosch-Areal', 'Bosch-Areal', 'gold', 280, [24, 120, 360, 850, 1025, 1200], 150),
    { id: 30, name: 'Dispatch', kind: 'dispatch' },
    street(31, 'Hellmich-Street', 'Hellmich-Street', 'forest', 300, [26, 130, 390, 900, 1100, 1275], 200),
    street(32, 'Babylon-Tower', 'Babylon-Tower', 'forest', 300, [26, 130, 390, 900, 1100, 1275], 200),
    { id: 33, name: 'Ledger', kind: 'ledger' },
    street(34, 'Schuerstedt-Datacenter', 'Schuerstedt-Datacenter', 'forest', 320, [28, 150, 450, 1000, 1200, 1400], 200),
    depot(35, 'West Depot'),
    { id: 36, name: 'Fortune', kind: 'fortune' },
    street(37, 'Zuerich', 'Zuerich', 'navy', 350, [35, 175, 500, 1100, 1300, 1500], 200),
    { id: 38, name: 'Luxury Duty', short: 'Luxury', kind: 'tax', amount: 100 },
    street(39, 'Bern', 'Bern', 'navy', 400, [50, 200, 600, 1400, 1700, 2000], 200),
]);
export const BOARD_SIZE = BOARD.length;
export const HOLDING_TILE = 10;
export const START_TILE = 0;
export const GROUP_ORDER = [
    'clay',
    'sky',
    'rose',
    'amber',
    'crimson',
    'gold',
    'forest',
    'navy',
];
export const GROUP_COLORS = {
    clay: '#a0522d',
    sky: '#38bdf8',
    rose: '#ec4899',
    amber: '#fb923c',
    crimson: '#ef4444',
    gold: '#facc15',
    forest: '#22c55e',
    navy: '#4f46e5',
    depot: '#334155',
    works: '#14b8a6',
};
export const GROUP_LABELS = {
    clay: 'Clay',
    sky: 'Sky',
    rose: 'Rose',
    amber: 'Amber',
    crimson: 'Crimson',
    gold: 'Gold',
    forest: 'Forest',
    navy: 'Navy',
    depot: 'Depots',
    works: 'Works',
};
/** Tile ids belonging to each ownable group, in board order. */
export const GROUP_TILES = (() => {
    const map = {};
    for (const tile of BOARD) {
        if (tile.kind === 'street')
            (map[tile.group] ??= []).push(tile.id);
        else if (tile.kind === 'depot')
            (map.depot ??= []).push(tile.id);
        else if (tile.kind === 'works')
            (map.works ??= []).push(tile.id);
    }
    return map;
})();
export const OWNABLE_TILE_IDS = BOARD.filter((t) => t.kind === 'street' || t.kind === 'depot' || t.kind === 'works').map((t) => t.id);
/** Depot toll by the number of depots the owner holds. */
export const DEPOT_RENT = [0, 25, 50, 100, 200];
/** Works multiplier applied to the dice total, by works owned. */
export const WORKS_MULTIPLIER = [0, 4, 10];
export function tileAt(id) {
    const tile = BOARD[((id % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];
    if (!tile)
        throw new Error(`No tile at index ${id}`);
    return tile;
}
/**
 * Board index of the tile with this `name` (case-insensitive), so other data —
 * the action cards especially — can point at a street by the exact name shown
 * on the board and stay in sync when it is renamed. Throws with the list of
 * valid names when nothing matches.
 */
export function tileIdByName(name) {
    const wanted = name.trim().toLowerCase();
    const tile = BOARD.find((t) => t.name.toLowerCase() === wanted);
    if (!tile) {
        throw new Error(`No board tile named "${name}". Valid names: ${BOARD.map((t) => t.name).join(', ')}`);
    }
    return tile.id;
}
//# sourceMappingURL=board.js.map