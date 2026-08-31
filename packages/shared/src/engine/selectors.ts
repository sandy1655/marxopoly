import {
  BOARD,
  BOARD_SIZE,
  DEPOT_RENT,
  GROUP_TILES,
  OWNABLE_TILE_IDS,
  WORKS_MULTIPLIER,
  tileAt,
} from '../data/board.js';
import type { GameState, OwnableTile, Player, Tile } from '../types.js';
import { isOwnable } from '../types.js';

export function getPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function requirePlayer(state: GameState, id: string): Player {
  const player = getPlayer(state, id);
  if (!player) throw new Error(`Unknown player ${id}`);
  return player;
}

export function currentPlayer(state: GameState): Player | undefined {
  return state.players.find((p) => p.seat === state.turnSeat && !p.bankrupt);
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.bankrupt);
}

export function ownableTile(tileId: number): OwnableTile | null {
  const tile = tileAt(tileId);
  return isOwnable(tile) ? tile : null;
}

/** A tile's name for display, honouring the host's lobby renames. */
export function tileLabel(state: Pick<GameState, 'tileNames'>, tileId: number): string {
  return state.tileNames[tileId] ?? tileAt(tileId).name;
}

export function ownedTileIds(state: GameState, playerId: string): number[] {
  return OWNABLE_TILE_IDS.filter((id) => state.deeds[id]?.ownerId === playerId);
}

export function groupOf(tile: Tile): string | null {
  if (tile.kind === 'street') return tile.group;
  if (tile.kind === 'depot') return 'depot';
  if (tile.kind === 'works') return 'works';
  return null;
}

export function ownsWholeGroup(state: GameState, playerId: string, group: string): boolean {
  const ids = GROUP_TILES[group] ?? [];
  return ids.length > 0 && ids.every((id) => state.deeds[id]?.ownerId === playerId);
}

export function countOwnedInGroup(state: GameState, playerId: string, group: string): number {
  return (GROUP_TILES[group] ?? []).filter((id) => state.deeds[id]?.ownerId === playerId).length;
}

export function groupHasBuildings(state: GameState, group: string): boolean {
  return (GROUP_TILES[group] ?? []).some((id) => (state.deeds[id]?.houses ?? 0) > 0);
}

export function mortgageValue(tile: OwnableTile): number {
  return Math.floor(tile.price / 2);
}

export function unmortgageCost(tile: OwnableTile): number {
  return Math.ceil((mortgageValue(tile) * 11) / 10);
}

/** Houses (1..4) currently placed on the board. Hotels are counted separately. */
export function housesInUse(state: GameState): number {
  return OWNABLE_TILE_IDS.reduce((sum, id) => {
    const h = state.deeds[id]?.houses ?? 0;
    return sum + (h === 5 ? 0 : h);
  }, 0);
}

export function hotelsInUse(state: GameState): number {
  return OWNABLE_TILE_IDS.reduce((sum, id) => sum + ((state.deeds[id]?.houses ?? 0) === 5 ? 1 : 0), 0);
}

/**
 * Rent owed for landing on `tileId`. `diceTotal` only matters for works.
 * Returns 0 when the tile is unowned, mortgaged, or owned by the visitor.
 */
export function rentFor(state: GameState, tileId: number, visitorId: string, diceTotal: number): number {
  const tile = ownableTile(tileId);
  const deed = state.deeds[tileId];
  if (!tile || !deed || !deed.ownerId || deed.ownerId === visitorId || deed.mortgaged) return 0;

  const owner = getPlayer(state, deed.ownerId);
  if (!owner || owner.bankrupt) return 0;
  if (state.settings.noRentInHolding && owner.inHolding) return 0;

  if (tile.kind === 'street') {
    if (deed.houses > 0) return tile.rent[deed.houses] ?? tile.rent[0];
    const full = ownsWholeGroup(state, deed.ownerId, tile.group);
    return full && state.settings.doubleRentOnFullGroup ? tile.rent[0] * 2 : tile.rent[0];
  }
  if (tile.kind === 'depot') {
    const owned = countOwnedInGroup(state, deed.ownerId, 'depot');
    return DEPOT_RENT[Math.min(owned, 4)] ?? 0;
  }
  // works
  const owned = countOwnedInGroup(state, deed.ownerId, 'works');
  const multiplier = WORKS_MULTIPLIER[Math.min(owned, 2)] ?? 0;
  return multiplier * diceTotal;
}

export interface BuildCheck {
  ok: boolean;
  reason?: string;
  cost?: number;
}

export function canBuild(state: GameState, playerId: string, tileId: number): BuildCheck {
  const tile = ownableTile(tileId);
  if (!tile || tile.kind !== 'street') return { ok: false, reason: 'Only streets can be improved.' };
  const deed = state.deeds[tileId];
  if (!deed || deed.ownerId !== playerId) return { ok: false, reason: 'You do not own this street.' };
  if (deed.mortgaged) return { ok: false, reason: 'Mortgaged streets cannot be improved.' };
  if (!ownsWholeGroup(state, playerId, tile.group)) {
    return { ok: false, reason: 'You need the whole colour group first.' };
  }
  const ids = GROUP_TILES[tile.group] ?? [];
  if (ids.some((id) => state.deeds[id]?.mortgaged)) {
    return { ok: false, reason: 'Lift the mortgage on the rest of the group first.' };
  }
  if (deed.houses >= 5) return { ok: false, reason: 'Already at a hotel.' };
  if (state.settings.evenBuild) {
    const min = Math.min(...ids.map((id) => state.deeds[id]?.houses ?? 0));
    if (deed.houses > min) return { ok: false, reason: 'Build evenly across the group.' };
  }
  const nextIsHotel = deed.houses === 4;
  if (nextIsHotel) {
    if (state.settings.hotelSupply > 0 && hotelsInUse(state) >= state.settings.hotelSupply) {
      return { ok: false, reason: 'No hotels left in the bank.' };
    }
  } else if (state.settings.houseSupply > 0 && housesInUse(state) >= state.settings.houseSupply) {
    return { ok: false, reason: 'No houses left in the bank.' };
  }
  const player = getPlayer(state, playerId);
  if (!player || player.cash < tile.buildCost) return { ok: false, reason: 'Not enough cash.' };
  return { ok: true, cost: tile.buildCost };
}

export function canSellBuilding(state: GameState, playerId: string, tileId: number): BuildCheck {
  const tile = ownableTile(tileId);
  if (!tile || tile.kind !== 'street') return { ok: false, reason: 'Nothing to sell here.' };
  const deed = state.deeds[tileId];
  if (!deed || deed.ownerId !== playerId) return { ok: false, reason: 'You do not own this street.' };
  if (deed.houses <= 0) return { ok: false, reason: 'No buildings on this street.' };
  if (state.settings.evenBuild) {
    const ids = GROUP_TILES[tile.group] ?? [];
    const max = Math.max(...ids.map((id) => state.deeds[id]?.houses ?? 0));
    if (deed.houses < max) return { ok: false, reason: 'Sell evenly across the group.' };
  }
  return { ok: true, cost: Math.floor(tile.buildCost / 2) };
}

export function canMortgage(state: GameState, playerId: string, tileId: number): BuildCheck {
  const tile = ownableTile(tileId);
  if (!tile) return { ok: false, reason: 'This tile cannot be mortgaged.' };
  const deed = state.deeds[tileId];
  if (!deed || deed.ownerId !== playerId) return { ok: false, reason: 'You do not own this property.' };
  if (deed.mortgaged) return { ok: false, reason: 'Already mortgaged.' };
  const group = groupOf(tile);
  if (group && groupHasBuildings(state, group)) {
    return { ok: false, reason: 'Sell the buildings in this group first.' };
  }
  return { ok: true, cost: mortgageValue(tile) };
}

/** Cash plus everything the player could raise by selling buildings and mortgaging. */
export function liquidValue(state: GameState, playerId: string): number {
  const player = getPlayer(state, playerId);
  if (!player) return 0;
  let total = player.cash;
  for (const id of ownedTileIds(state, playerId)) {
    const tile = ownableTile(id)!;
    const deed = state.deeds[id]!;
    if (tile.kind === 'street' && deed.houses > 0) {
      total += Math.floor(tile.buildCost / 2) * deed.houses;
    }
    if (!deed.mortgaged) total += mortgageValue(tile);
  }
  return total;
}

/** Cash + full property value + buildings at cost. Used for the scoreboard. */
export function netWorth(state: GameState, playerId: string): number {
  const player = getPlayer(state, playerId);
  if (!player) return 0;
  let total = player.cash;
  for (const id of ownedTileIds(state, playerId)) {
    const tile = ownableTile(id)!;
    const deed = state.deeds[id]!;
    total += deed.mortgaged ? mortgageValue(tile) : tile.price;
    if (tile.kind === 'street') total += tile.buildCost * deed.houses;
  }
  return total;
}

export function nextTileOfKind(from: number, kind: 'depot' | 'works'): number {
  for (let step = 1; step <= BOARD_SIZE; step++) {
    const id = (from + step) % BOARD_SIZE;
    if (BOARD[id]?.kind === kind) return id;
  }
  return from;
}

export function isPlayersTurn(state: GameState, playerId: string): boolean {
  return currentPlayer(state)?.id === playerId;
}

export function standings(state: GameState): { playerId: string; net: number }[] {
  return state.players
    .map((p) => ({ playerId: p.id, net: p.bankrupt ? 0 : netWorth(state, p.id) }))
    .sort((a, b) => b.net - a.net);
}
