import type { ColorGroup, RentLadder, Tile } from '../types.js';

/**
 * The Rentier board: 40 tiles running clockwise from Start (index 0).
 * Streets, depots and works are the ownable tiles.
 */

const street = (
  id: number,
  name: string,
  group: ColorGroup,
  price: number,
  rent: RentLadder,
  buildCost: number,
): Tile => ({ id, name, kind: 'street', group, price, rent, buildCost });

const depot = (id: number, name: string): Tile => ({
  id,
  name,
  kind: 'depot',
  group: 'depot',
  price: 200,
});

const works = (id: number, name: string): Tile => ({
  id,
  name,
  kind: 'works',
  group: 'works',
  price: 150,
});

export const BOARD: readonly Tile[] = Object.freeze([
  { id: 0, name: 'Start', kind: 'start' },
  street(1, 'Alder Lane', 'clay', 60, [2, 10, 30, 90, 160, 250], 50),
  { id: 2, name: 'Ledger', kind: 'ledger' },
  street(3, 'Birch Row', 'clay', 60, [4, 20, 60, 180, 320, 450], 50),
  { id: 4, name: 'Income Levy', kind: 'tax', amount: 200 },
  depot(5, 'North Depot'),
  street(6, 'Cedar Street', 'sky', 100, [6, 30, 90, 270, 400, 550], 50),
  { id: 7, name: 'Fortune', kind: 'fortune' },
  street(8, 'Dogwood Drive', 'sky', 100, [6, 30, 90, 270, 400, 550], 50),
  street(9, 'Elmcroft Court', 'sky', 120, [8, 40, 100, 300, 450, 600], 50),
  { id: 10, name: 'Holding Yard', kind: 'holding' },
  street(11, 'Foxglove Way', 'rose', 140, [10, 50, 150, 450, 625, 750], 100),
  works(12, 'Power Grid'),
  street(13, 'Garnet Grove', 'rose', 140, [10, 50, 150, 450, 625, 750], 100),
  street(14, 'Hawthorn Hill', 'rose', 160, [12, 60, 180, 500, 700, 900], 100),
  depot(15, 'East Depot'),
  street(16, 'Ivywood Road', 'amber', 180, [14, 70, 200, 550, 750, 950], 100),
  { id: 17, name: 'Ledger', kind: 'ledger' },
  street(18, 'Juniper Junction', 'amber', 180, [14, 70, 200, 550, 750, 950], 100),
  street(19, 'Kingfisher Close', 'amber', 200, [16, 80, 220, 600, 800, 1000], 100),
  { id: 20, name: 'Plaza', kind: 'plaza' },
  street(21, 'Larkspur Lane', 'crimson', 220, [18, 90, 250, 700, 875, 1050], 150),
  { id: 22, name: 'Fortune', kind: 'fortune' },
  street(23, 'Maple Mews', 'crimson', 220, [18, 90, 250, 700, 875, 1050], 150),
  street(24, 'Nightingale Nook', 'crimson', 240, [20, 100, 300, 750, 925, 1100], 150),
  depot(25, 'South Depot'),
  street(26, 'Orchard Parade', 'gold', 260, [22, 110, 330, 800, 975, 1150], 150),
  street(27, 'Poplar Place', 'gold', 260, [22, 110, 330, 800, 975, 1150], 150),
  works(28, 'Water Supply'),
  street(29, 'Quarry Quay', 'gold', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { id: 30, name: 'Dispatch', kind: 'dispatch' },
  street(31, 'Rosewood Rise', 'forest', 300, [26, 130, 390, 900, 1100, 1275], 200),
  street(32, 'Sycamore Square', 'forest', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { id: 33, name: 'Ledger', kind: 'ledger' },
  street(34, 'Thistle Terrace', 'forest', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  depot(35, 'West Depot'),
  { id: 36, name: 'Fortune', kind: 'fortune' },
  street(37, 'Umberland Avenue', 'navy', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { id: 38, name: 'Luxury Duty', kind: 'tax', amount: 100 },
  street(39, 'Vanguard Boulevard', 'navy', 400, [50, 200, 600, 1400, 1700, 2000], 200),
] as const satisfies readonly Tile[]);

export const BOARD_SIZE = BOARD.length;
export const HOLDING_TILE = 10;
export const START_TILE = 0;

export const GROUP_ORDER: readonly ColorGroup[] = [
  'clay',
  'sky',
  'rose',
  'amber',
  'crimson',
  'gold',
  'forest',
  'navy',
];

export const GROUP_COLORS: Record<ColorGroup | 'depot' | 'works', string> = {
  clay: '#8d5b3f',
  sky: '#7fc7e8',
  rose: '#d8639b',
  amber: '#e8912d',
  crimson: '#d0342c',
  gold: '#f2c53d',
  forest: '#3f9b52',
  navy: '#2f5fb5',
  depot: '#3b4252',
  works: '#6b7b8c',
};

export const GROUP_LABELS: Record<ColorGroup | 'depot' | 'works', string> = {
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
export const GROUP_TILES: Record<string, number[]> = (() => {
  const map: Record<string, number[]> = {};
  for (const tile of BOARD) {
    if (tile.kind === 'street') (map[tile.group] ??= []).push(tile.id);
    else if (tile.kind === 'depot') (map.depot ??= []).push(tile.id);
    else if (tile.kind === 'works') (map.works ??= []).push(tile.id);
  }
  return map;
})();

export const OWNABLE_TILE_IDS: readonly number[] = BOARD.filter(
  (t) => t.kind === 'street' || t.kind === 'depot' || t.kind === 'works',
).map((t) => t.id);

/** Depot toll by the number of depots the owner holds. */
export const DEPOT_RENT = [0, 25, 50, 100, 200] as const;

/** Works multiplier applied to the dice total, by works owned. */
export const WORKS_MULTIPLIER = [0, 4, 10] as const;

export function tileAt(id: number): Tile {
  const tile = BOARD[((id % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];
  if (!tile) throw new Error(`No tile at index ${id}`);
  return tile;
}
