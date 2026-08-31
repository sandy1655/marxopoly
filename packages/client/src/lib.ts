import { GROUP_COLORS, type ColorGroup, type GameState, type Player, type Tile } from '@rentier/shared';

export function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function tileColor(tile: Tile): string | null {
  if (tile.kind === 'street') return GROUP_COLORS[tile.group as ColorGroup];
  if (tile.kind === 'depot') return GROUP_COLORS.depot;
  if (tile.kind === 'works') return GROUP_COLORS.works;
  return null;
}

/** CSS grid placement for tile `id` on the 11x11 ring. */
export function gridPosition(id: number): { gridRow: number; gridColumn: number } {
  if (id === 0) return { gridRow: 11, gridColumn: 11 };
  if (id < 10) return { gridRow: 11, gridColumn: 11 - id };
  if (id === 10) return { gridRow: 11, gridColumn: 1 };
  if (id < 20) return { gridRow: 21 - id, gridColumn: 1 };
  if (id === 20) return { gridRow: 1, gridColumn: 1 };
  if (id < 30) return { gridRow: 1, gridColumn: id - 19 };
  if (id === 30) return { gridRow: 1, gridColumn: 11 };
  return { gridRow: id - 29, gridColumn: 11 };
}

export type Edge = 'bottom' | 'left' | 'top' | 'right' | 'corner';

export function tileEdge(id: number): Edge {
  if (id === 0 || id === 10 || id === 20 || id === 30) return 'corner';
  if (id < 10) return 'bottom';
  if (id < 20) return 'left';
  if (id < 30) return 'top';
  return 'right';
}

export function playersOn(state: GameState, tileId: number): Player[] {
  return state.players.filter((p) => !p.bankrupt && p.position === tileId);
}

export function phaseLabel(state: GameState, myId: string | null): string {
  const current = state.players.find((p) => p.seat === state.turnSeat && !p.bankrupt);
  const mine = current?.id === myId;
  switch (state.phase) {
    case 'lobby':
      return 'Waiting in the lobby';
    case 'pre_roll':
      return mine ? 'Your turn — roll the dice' : `${current?.name ?? '—'} is rolling`;
    case 'awaiting_buy':
      return mine ? 'Buy it or send it to auction' : `${current?.name ?? '—'} is deciding`;
    case 'auction':
      return 'Auction in progress';
    case 'debt': {
      const debtor = state.players.find((p) => p.id === state.debt?.debtorId);
      return debtor?.id === myId ? 'You owe money — raise it or fold' : `${debtor?.name ?? '—'} owes money`;
    }
    case 'post_roll':
      return mine ? 'Manage your board, then end your turn' : `${current?.name ?? '—'} is finishing up`;
    case 'game_over':
      return 'Game over';
    default:
      return '';
  }
}

export function secondsLeft(deadline: number | null): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/** Board tokens show the player's initial — the clearest marker at small sizes. */
export function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export const TOKEN_GLYPHS: Record<string, string> = {
  rocket: '▲',
  anchor: '⚓',
  lantern: '✦',
  compass: '✳',
  kite: '◆',
  acorn: '●',
  bell: '⬢',
  crown: '★',
};
