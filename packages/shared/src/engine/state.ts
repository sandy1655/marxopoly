import { FORTUNE_CARDS, LEDGER_CARDS } from '../data/cards.js';
import { OWNABLE_TILE_IDS } from '../data/board.js';
import { randomSeed, shuffle } from '../rng.js';
import type { Deed, GameSettings, GameState, Player } from '../types.js';

export const PLAYER_COLORS = [
  '#e11d48',
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#9333ea',
  '#0891b2',
  '#db2777',
  '#65a30d',
] as const;

export const TOKENS = [
  'rocket',
  'anchor',
  'lantern',
  'compass',
  'kite',
  'acorn',
  'bell',
  'crown',
] as const;

export const DEFAULT_SETTINGS: GameSettings = {
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

export function makeSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  const merged: GameSettings = { ...DEFAULT_SETTINGS, ...overrides };
  merged.startingCash = clamp(merged.startingCash, 200, 100000);
  merged.startSalary = clamp(merged.startSalary, 0, 10000);
  merged.holdingFine = clamp(merged.holdingFine, 0, 5000);
  merged.houseSupply = clamp(merged.houseSupply, 0, 200);
  merged.hotelSupply = clamp(merged.hotelSupply, 0, 100);
  merged.turnSeconds = clamp(merged.turnSeconds, 0, 600);
  merged.maxPlayers = clamp(merged.maxPlayers, 2, 8);
  if (!merged.seed) merged.seed = randomSeed();
  return merged;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export interface NewPlayerInput {
  id: string;
  name: string;
  isBot?: boolean;
}

export function makePlayer(input: NewPlayerInput, seat: number, startingCash: number): Player {
  return {
    id: input.id,
    name: input.name,
    color: PLAYER_COLORS[seat % PLAYER_COLORS.length]!,
    token: TOKENS[seat % TOKENS.length]!,
    cash: startingCash,
    position: 0,
    inHolding: false,
    holdingTurns: 0,
    reprieveCards: 0,
    bankrupt: false,
    connected: true,
    isBot: input.isBot ?? false,
    seat,
  };
}

export function emptyDeeds(): Record<number, Deed> {
  const deeds: Record<number, Deed> = {};
  for (const id of OWNABLE_TILE_IDS) {
    deeds[id] = { tileId: id, ownerId: null, houses: 0, mortgaged: false };
  }
  return deeds;
}

export function createGame(
  id: string,
  players: NewPlayerInput[],
  settingsOverrides: Partial<GameSettings> = {},
): GameState {
  const settings = makeSettings(settingsOverrides);
  const fortune = shuffle(
    FORTUNE_CARDS.map((c) => c.id),
    settings.seed,
  );
  const ledger = shuffle(
    LEDGER_CARDS.map((c) => c.id),
    fortune.state,
  );

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
    version: 0,
  };
}

export function addPlayerToLobby(state: GameState, input: NewPlayerInput): GameState {
  if (state.phase !== 'lobby') return state;
  if (state.players.length >= state.settings.maxPlayers) return state;
  const seat = state.players.length;
  return {
    ...state,
    players: [...state.players, makePlayer(input, seat, state.settings.startingCash)],
    version: state.version + 1,
  };
}

export function removePlayerFromLobby(state: GameState, playerId: string): GameState {
  if (state.phase !== 'lobby') return state;
  const players = state.players
    .filter((p) => p.id !== playerId)
    .map((p, i) => ({ ...p, seat: i, color: PLAYER_COLORS[i % PLAYER_COLORS.length]!, token: TOKENS[i % TOKENS.length]! }));
  return { ...state, players, version: state.version + 1 };
}

export function applySettings(state: GameState, overrides: Partial<GameSettings>): GameState {
  if (state.phase !== 'lobby') return state;
  const settings = makeSettings({ ...state.settings, ...overrides });
  return {
    ...state,
    settings,
    players: state.players.map((p) => ({ ...p, cash: settings.startingCash })),
    version: state.version + 1,
  };
}
