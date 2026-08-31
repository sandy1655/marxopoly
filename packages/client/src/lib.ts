import {
  GROUP_COLORS,
  tileAt,
  type CardEffect,
  type ColorGroup,
  type GameState,
  type Player,
  type Tile,
} from '@rentier/shared';

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

/** Fallback marker when a player somehow has no known token. */
export function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

/** One emoji per seat token (see TOKENS in @rentier/shared). */
export const TOKEN_EMOJI: Record<string, string> = {
  rocket: '🚀',
  anchor: '⚓',
  lantern: '🏮',
  compass: '🧭',
  kite: '🪁',
  acorn: '🌰',
  bell: '🔔',
  crown: '👑',
};

/** The emoji shown for a player's game piece. */
export function playerIcon(player: { token: string; name: string }): string {
  return TOKEN_EMOJI[player.token] ?? initial(player.name);
}

/**
 * Centre of tile `id`'s cell as a percentage of the board box, for the
 * absolutely-positioned token layer. The ring has 11 tracks sized
 * 1.5fr / 9× 1fr / 1.5fr, so 12 units across.
 */
export function tileCentre(id: number): { x: number; y: number } {
  const { gridRow, gridColumn } = gridPosition(id);
  return { x: trackCentre(gridColumn), y: trackCentre(gridRow) };
}

function trackCentre(index: number): number {
  const before = index === 1 ? 0 : 1.5 + (index - 2);
  const size = index === 1 || index === 11 ? 1.5 : 1;
  return ((before + size / 2) / 12) * 100;
}

/** Where a player's piece rests on tile `id`: nudged toward the tile's outer
 *  edge so it sits clear of the street name rather than covering it. */
export function tokenSpot(id: number): { x: number; y: number } {
  const { x, y } = tileCentre(id);
  const push = 2.4;
  switch (tileEdge(id)) {
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

/** Plain-English summary of a card's effect, derived from the effect object so
 *  new cards added to `packages/shared/src/data/cards.ts` describe themselves. */
export function describeCardEffect(effect: CardEffect): string {
  switch (effect.kind) {
    case 'cash':
      return effect.amount >= 0
        ? `Collect ${money(effect.amount)} from the bank.`
        : `Pay ${money(-effect.amount)} to the bank.`;
    case 'collect_each':
      return `Collect ${money(effect.amount)} from every other player.`;
    case 'pay_each':
      return `Pay ${money(effect.amount)} to every other player.`;
    case 'move_to':
      return `Move to ${tileAt(effect.tile).name} (${effect.collectStart ? 'salary if you pass Start' : 'no salary'}).`;
    case 'move_by':
      return effect.steps >= 0
        ? `Move forward ${effect.steps} ${effect.steps === 1 ? 'tile' : 'tiles'}.`
        : `Move back ${Math.abs(effect.steps)} ${Math.abs(effect.steps) === 1 ? 'tile' : 'tiles'}.`;
    case 'advance_nearest':
      return `Advance to the nearest ${effect.target}; pay the owner ${effect.multiplier}× the usual toll.`;
    case 'goto_holding':
      return 'Go straight to the holding yard — no salary.';
    case 'reprieve':
      return 'Keep a reprieve card to leave the holding yard later.';
    case 'assessment':
      return `Pay ${money(effect.perHouse)} per house and ${money(effect.perHotel)} per hotel you own.`;
    default: {
      const unhandled: never = effect;
      return unhandled;
    }
  }
}
