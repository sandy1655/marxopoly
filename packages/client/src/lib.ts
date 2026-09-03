import {
  GROUP_COLORS,
  tileAt,
  type CardEffect,
  type ColorGroup,
  type GameState,
  type Player,
  type Tile,
} from '@marxopoly/shared';

export function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/** Compact money for tight spots like chart axes: $0, $850, $1.2k, $3.4M. */
export function compactMoney(value: number): string {
  const n = Math.round(value);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${n}`;
}

export function tileColor(tile: Tile): string | null {
  if (tile.kind === 'street') return GROUP_COLORS[tile.group as ColorGroup];
  if (tile.kind === 'depot') return GROUP_COLORS.depot;
  if (tile.kind === 'works') return GROUP_COLORS.works;
  return null;
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

/** One emoji per seat token (see TOKENS in @marxopoly/shared). */
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

/** Plain-English summary of a card's effect, derived from the effect object so
 *  new cards describe themselves. Pass `tileNames` for the host's renames. */
export function describeCardEffect(
  effect: CardEffect,
  tileNames?: Record<number, string>,
): string {
  switch (effect.kind) {
    case 'cash':
      return effect.amount >= 0
        ? `Collect ${money(effect.amount)} from the bank.`
        : `Pay ${money(-effect.amount)} to the bank.`;
    case 'collect_each':
      return `Collect ${money(effect.amount)} from every other player.`;
    case 'pay_each':
      return `Pay ${money(effect.amount)} to every other player.`;
    case 'move_to': {
      const name = tileNames?.[effect.tile] ?? tileAt(effect.tile).name;
      return `Move to ${name} (${effect.collectStart ? 'salary if you pass Start' : 'no salary'}).`;
    }
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
