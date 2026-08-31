import type { ColorGroup, Tile } from '../types.js';
export declare const BOARD: readonly Tile[];
export declare const BOARD_SIZE: number;
export declare const HOLDING_TILE = 10;
export declare const START_TILE = 0;
export declare const GROUP_ORDER: readonly ColorGroup[];
export declare const GROUP_COLORS: Record<ColorGroup | 'depot' | 'works', string>;
export declare const GROUP_LABELS: Record<ColorGroup | 'depot' | 'works', string>;
/** Tile ids belonging to each ownable group, in board order. */
export declare const GROUP_TILES: Record<string, number[]>;
export declare const OWNABLE_TILE_IDS: readonly number[];
/** Depot toll by the number of depots the owner holds. */
export declare const DEPOT_RENT: readonly [0, 25, 50, 100, 200];
/** Works multiplier applied to the dice total, by works owned. */
export declare const WORKS_MULTIPLIER: readonly [0, 4, 10];
export declare function tileAt(id: number): Tile;
//# sourceMappingURL=board.d.ts.map