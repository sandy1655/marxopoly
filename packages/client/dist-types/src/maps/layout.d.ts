/** Which side of the ring a tile sits on — drives its flex direction and the
 *  placement of the owner bar and the player token. */
export type Edge = 'bottom' | 'left' | 'top' | 'right' | 'corner';
/**
 * The geometry of a board: where every tile sits and how big the ring tracks
 * are. A map supplies one of these so the visual arrangement is swappable
 * without touching the game rules (the tile data in `@marxopoly/shared`
 * stays the single source of truth for names, prices and rent).
 */
export interface BoardLayout {
    /** `grid-template-columns` for the `.board` element. */
    gridTemplateColumns: string;
    /** `grid-template-rows` for the `.board` element. */
    gridTemplateRows: string;
    /** `grid-column` / `grid-row` for the centre panel. */
    centre: {
        column: string;
        row: string;
    };
    /** CSS grid cell for tile `id`. */
    position(id: number): {
        gridRow: number;
        gridColumn: number;
    };
    /** The side of the ring tile `id` belongs to. */
    edge(id: number): Edge;
    /** Centre of tile `id`'s cell as a percentage of the board box — used to
     *  place the absolutely-positioned player tokens. */
    cellCentre(id: number): {
        x: number;
        y: number;
    };
}
/**
 * The classic Monopoly-style ring: `BOARD_SIZE` tiles on an 11×11 grid,
 * running clockwise from the bottom-right corner. `cornerFr` sets how much
 * wider the four corner tracks are than the side tracks (1 = all equal).
 */
export declare function ringLayout({ cornerFr }?: {
    cornerFr?: number;
}): BoardLayout;
/** Where a player's piece rests on tile `id`: nudged toward the ring's outer
 *  edge so it sits clear of the tile name rather than covering it. */
export declare function tokenSpot(layout: BoardLayout, id: number): {
    x: number;
    y: number;
};
//# sourceMappingURL=layout.d.ts.map