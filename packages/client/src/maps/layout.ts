import { BOARD_SIZE } from '@marxopoly/shared';

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
  centre: { column: string; row: string };
  /** CSS grid cell for tile `id`. */
  position(id: number): { gridRow: number; gridColumn: number };
  /** The side of the ring tile `id` belongs to. */
  edge(id: number): Edge;
  /** Centre of tile `id`'s cell as a percentage of the board box — used to
   *  place the absolutely-positioned player tokens. */
  cellCentre(id: number): { x: number; y: number };
}

/**
 * The classic Monopoly-style ring: `BOARD_SIZE` tiles on an 11×11 grid,
 * running clockwise from the bottom-right corner. `cornerFr` sets how much
 * wider the four corner tracks are than the side tracks (1 = all equal).
 */
export function ringLayout({ cornerFr = 1.5 }: { cornerFr?: number } = {}): BoardLayout {
  const SIDE = 10; // tiles per side including the leading corner → ring of 40
  const TRACKS = SIDE + 1; // 11 grid tracks per axis
  const totalFr = cornerFr * 2 + (TRACKS - 2);

  const norm = (id: number) => ((id % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  const trackSize = (index: number) => (index === 1 || index === TRACKS ? cornerFr : 1);

  /** Centre of grid track `index` (1-based) as a percentage of the axis. */
  const trackCentre = (index: number) => {
    let before = 0;
    for (let i = 1; i < index; i++) before += trackSize(i);
    return ((before + trackSize(index) / 2) / totalFr) * 100;
  };

  const position = (id: number): { gridRow: number; gridColumn: number } => {
    const n = norm(id);
    if (n === 0) return { gridRow: TRACKS, gridColumn: TRACKS };
    if (n < SIDE) return { gridRow: TRACKS, gridColumn: TRACKS - n };
    if (n === SIDE) return { gridRow: TRACKS, gridColumn: 1 };
    if (n < 2 * SIDE) return { gridRow: 2 * SIDE + 1 - n, gridColumn: 1 };
    if (n === 2 * SIDE) return { gridRow: 1, gridColumn: 1 };
    if (n < 3 * SIDE) return { gridRow: 1, gridColumn: n - (2 * SIDE - 1) };
    if (n === 3 * SIDE) return { gridRow: 1, gridColumn: TRACKS };
    return { gridRow: n - (3 * SIDE - 1), gridColumn: TRACKS };
  };

  const edge = (id: number): Edge => {
    const n = norm(id);
    if (n % SIDE === 0) return 'corner';
    if (n < SIDE) return 'bottom';
    if (n < 2 * SIDE) return 'left';
    if (n < 3 * SIDE) return 'top';
    return 'right';
  };

  const cellCentre = (id: number) => {
    const { gridRow, gridColumn } = position(id);
    return { x: trackCentre(gridColumn), y: trackCentre(gridRow) };
  };

  const template = `${cornerFr}fr repeat(${SIDE - 1}, 1fr) ${cornerFr}fr`;

  return {
    gridTemplateColumns: template,
    gridTemplateRows: template,
    centre: { column: `2 / ${TRACKS}`, row: `2 / ${TRACKS}` },
    position,
    edge,
    cellCentre,
  };
}

/** Where a player's piece rests on tile `id`: nudged toward the ring's outer
 *  edge so it sits clear of the tile name rather than covering it. */
export function tokenSpot(layout: BoardLayout, id: number): { x: number; y: number } {
  const { x, y } = layout.cellCentre(id);
  const push = 2.4;
  switch (layout.edge(id)) {
    case 'bottom':
      return { x, y: y + push };
    case 'top':
      return { x, y: y - push };
    case 'left':
      return { x: x - push, y };
    case 'right':
      return { x: x + push, y };
    default:
      return { x, y };
  }
}
