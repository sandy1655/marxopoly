/**
 * Rentier — shared domain types.
 *
 * Everything the server and the client agree on lives here. The engine is a
 * pure function of (state, action) -> state, so these types are the whole
 * contract between the two runtimes.
 */

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export type ColorGroup =
  | 'clay'
  | 'sky'
  | 'rose'
  | 'amber'
  | 'crimson'
  | 'gold'
  | 'forest'
  | 'navy';

export type OwnableGroup = ColorGroup | 'depot' | 'works';

export type TileKind =
  | 'start'
  | 'street'
  | 'depot'
  | 'works'
  | 'tax'
  | 'fortune'
  | 'ledger'
  | 'holding'
  | 'dispatch'
  | 'plaza';

export interface TileBase {
  /** Board index, 0..39, running clockwise from Start. */
  id: number;
  name: string;
  /** Compact label for the board square; the full `name` is used everywhere else. */
  short?: string;
  kind: TileKind;
}

/** Rent ladder: [base, 1 house, 2, 3, 4, hotel]. */
export type RentLadder = readonly [number, number, number, number, number, number];

export interface StreetTile extends TileBase {
  kind: 'street';
  group: ColorGroup;
  price: number;
  rent: RentLadder;
  /** Cost of one house (a hotel costs the same as the fifth house). */
  buildCost: number;
}

export interface DepotTile extends TileBase {
  kind: 'depot';
  group: 'depot';
  price: number;
}

export interface WorksTile extends TileBase {
  kind: 'works';
  group: 'works';
  price: number;
}

export interface TaxTile extends TileBase {
  kind: 'tax';
  amount: number;
}

export interface PlainTile extends TileBase {
  kind: 'start' | 'fortune' | 'ledger' | 'holding' | 'dispatch' | 'plaza';
}

export type OwnableTile = StreetTile | DepotTile | WorksTile;
export type Tile = OwnableTile | TaxTile | PlainTile;

export function isOwnable(tile: Tile): tile is OwnableTile {
  return tile.kind === 'street' || tile.kind === 'depot' || tile.kind === 'works';
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type CardEffect =
  /** Positive credits the player, negative debits them (bank is the counterparty). */
  | { kind: 'cash'; amount: number }
  /** Every other solvent player pays the drawer `amount`. */
  | { kind: 'collect_each'; amount: number }
  /** The drawer pays every other solvent player `amount`. */
  | { kind: 'pay_each'; amount: number }
  | { kind: 'move_to'; tile: number; collectStart: boolean }
  | { kind: 'move_by'; steps: number }
  /** Advance to the next depot/works; rent is charged at `multiplier` x normal. */
  | { kind: 'advance_nearest'; target: 'depot' | 'works'; multiplier: number }
  | { kind: 'goto_holding' }
  | { kind: 'reprieve' }
  | { kind: 'assessment'; perHouse: number; perHotel: number };

export type CardEffectKind = CardEffect['kind'];

export interface Card {
  id: string;
  deck: 'fortune' | 'ledger';
  text: string;
  effect: CardEffect;
}

/** A card the host is proposing; the id is assigned server-side. */
export interface CardInput {
  deck: 'fortune' | 'ledger';
  text: string;
  effect: CardEffect;
}

// ---------------------------------------------------------------------------
// Players & ownership
// ---------------------------------------------------------------------------

export interface Player {
  id: string;
  name: string;
  /** Hex colour used for the token and the property tags. */
  color: string;
  /** Token shape key, purely cosmetic. */
  token: string;
  cash: number;
  position: number;
  inHolding: boolean;
  /** Turns already spent in the holding yard (0..3). */
  holdingTurns: number;
  reprieveCards: number;
  bankrupt: boolean;
  connected: boolean;
  isBot: boolean;
  /** Seat order, stable for the life of the game. */
  seat: number;
  /** Set when the player goes bankrupt, for the final scoreboard. */
  finishedRank?: number;
}

export interface Deed {
  tileId: number;
  ownerId: string | null;
  /** 0..4 houses, 5 means a hotel. */
  houses: number;
  mortgaged: boolean;
}

// ---------------------------------------------------------------------------
// Trading & auctions
// ---------------------------------------------------------------------------

export interface TradeSide {
  cash: number;
  tileIds: number[];
  reprieveCards: number;
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  give: TradeSide;
  receive: TradeSide;
  createdAt: number;
  message?: string;
}

export interface AuctionState {
  tileId: number;
  /** Highest bid so far; 0 with no bidder means nobody has bid yet. */
  highBid: number;
  highBidderId: string | null;
  /** Players still eligible to bid, in bidding order. */
  activeIds: string[];
  /** Index into `activeIds` whose turn it is to bid or pass. */
  turnIndex: number;
  /** Wall-clock deadline for the current bidder, or null when untimed. */
  deadline: number | null;
}

// ---------------------------------------------------------------------------
// Debt
// ---------------------------------------------------------------------------

export interface Debt {
  debtorId: string;
  /** null = the bank. */
  creditorId: string | null;
  amount: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export type Phase =
  | 'lobby'
  | 'pre_roll'
  | 'awaiting_buy'
  | 'auction'
  | 'debt'
  | 'post_roll'
  | 'game_over';

export interface GameSettings {
  startingCash: number;
  /** Salary paid for passing or landing on Start. */
  startSalary: number;
  /** Double salary when landing exactly on Start. */
  doubleOnExactStart: boolean;
  /** Unbought properties go to auction instead of staying with the bank. */
  auctionsEnabled: boolean;
  /** Taxes and fees accumulate on the Plaza and are paid out to whoever lands there. */
  plazaPot: boolean;
  /** Rent is not collected while the owner sits in the holding yard. */
  noRentInHolding: boolean;
  /** Houses must be built evenly across a colour group. */
  evenBuild: boolean;
  /** Rent doubles on unimproved streets when one player owns the whole group. */
  doubleRentOnFullGroup: boolean;
  /** Fee to leave the holding yard early. */
  holdingFine: number;
  /** Maximum houses in the game (0 = unlimited). */
  houseSupply: number;
  hotelSupply: number;
  /** Seconds a player gets to act before the turn auto-resolves; 0 disables. */
  turnSeconds: number;
  /** Deterministic seed; the server picks one per room. */
  seed: number;
  /** Bankruptcy ends the game when only one player is left standing. */
  maxPlayers: number;
}

export interface LogEntry {
  id: number;
  at: number;
  /** Player the entry is attributed to, when there is one. */
  playerId?: string;
  text: string;
  kind: 'roll' | 'move' | 'money' | 'trade' | 'build' | 'card' | 'system' | 'chat';
}

/** Net-worth of every player at one point in the game. */
export interface NetWorthSnapshot {
  /** Monotonic sample index; roughly "turns played so far". */
  turn: number;
  /** playerId -> net worth (bankrupt players are 0). */
  worth: Record<string, number>;
}

/** Running analytics, surfaced on the end-of-game screen. */
export interface GameStats {
  /** Times each player was sent to / entered the holding yard. */
  holdingVisits: Record<string, number>;
  /** Total cash each player has swept from the Plaza pot. */
  plazaTake: Record<string, number>;
  /** Net-worth history, one entry per turn (index 0 = game start). */
  netWorthHistory: NetWorthSnapshot[];
}

export interface GameState {
  id: string;
  phase: Phase;
  settings: GameSettings;
  players: Player[];
  deeds: Record<number, Deed>;
  /** Seat index of the player whose turn it is. */
  turnSeat: number;
  /** Last dice pair rolled, or null before the first roll. */
  dice: [number, number] | null;
  doublesInARow: number;
  /** True once the current player has rolled and moved this turn. */
  hasRolled: boolean;
  auction: AuctionState | null;
  debt: Debt | null;
  trades: TradeOffer[];
  fortuneDeck: string[];
  ledgerDeck: string[];
  /** Card currently shown to the table, cleared when the turn advances. */
  drawnCard: { deck: 'fortune' | 'ledger'; cardId: string } | null;
  plazaPot: number;
  log: LogEntry[];
  logSeq: number;
  rngState: number;
  turnDeadline: number | null;
  startedAt: number | null;
  endedAt: number | null;
  winnerId: string | null;
  /** Host overrides for board tile names: tileId -> custom name. Sparse. */
  tileNames: Record<number, string>;
  /** The Fortune + Ledger decks in play. Host-editable in the lobby. */
  cards: Card[];
  /** Running analytics for the end-of-game screen. */
  stats: GameStats;
  /** Monotonic counter bumped on every applied action; useful for client reconciliation. */
  version: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'start_game' }
  | { type: 'roll_dice' }
  | { type: 'buy_property' }
  | { type: 'decline_property' }
  | { type: 'bid'; amount: number }
  | { type: 'pass_bid' }
  | { type: 'build'; tileId: number }
  | { type: 'sell_building'; tileId: number }
  | { type: 'mortgage'; tileId: number }
  | { type: 'unmortgage'; tileId: number }
  | { type: 'pay_holding_fine' }
  | { type: 'use_reprieve' }
  | { type: 'end_turn' }
  | { type: 'propose_trade'; toId: string; give: TradeSide; receive: TradeSide; message?: string }
  | { type: 'accept_trade'; tradeId: string }
  | { type: 'decline_trade'; tradeId: string }
  | { type: 'cancel_trade'; tradeId: string }
  | { type: 'declare_bankruptcy' }
  | { type: 'resign'; reason?: 'left' | 'bankrupt' }
  | { type: 'set_connected'; playerId: string; connected: boolean }
  | { type: 'timeout' };

export interface ActionEnvelope {
  playerId: string;
  action: GameAction;
  /** Server clock, injected so the engine stays pure. */
  now: number;
}

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Lobby / transport
// ---------------------------------------------------------------------------

export interface RoomSummary {
  id: string;
  name: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  /** How many people are currently watching without a seat. */
  spectatorCount: number;
  phase: Phase;
  isPrivate: boolean;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export interface ServerToClientEvents {
  'room:state': (payload: { state: GameState; hostId: string; roomName: string }) => void;
  'room:list': (rooms: RoomSummary[]) => void;
  'room:joined': (payload: {
    roomId: string;
    playerId: string;
    token: string;
    /** True when there was no seat to take and the socket joined as a viewer. */
    spectator?: boolean;
  }) => void;
  'room:chat': (message: ChatMessage) => void;
  'room:error': (payload: { message: string }) => void;
  'room:left': (payload: { reason: string }) => void;
}

export interface ClientToServerEvents {
  'lobby:list': () => void;
  'room:create': (
    payload: { name: string; playerName: string; isPrivate: boolean; settings?: Partial<GameSettings> },
    ack: (res: { ok: boolean; roomId?: string; error?: string }) => void,
  ) => void;
  'room:join': (
    payload: { roomId: string; playerName: string; token?: string },
    ack: (res: { ok: boolean; error?: string; spectator?: boolean }) => void,
  ) => void;
  'room:leave': () => void;
  'room:action': (action: GameAction, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'room:chat': (text: string) => void;
  'room:settings': (settings: Partial<GameSettings>) => void;
  'room:add_bot': () => void;
  'room:kick': (playerId: string) => void;
  /** Host only, lobby only: rename a board tile (empty string clears the override). */
  'room:rename_tile': (payload: { tileId: number; name: string }) => void;
  /** Host only, lobby only: append a new special card. */
  'room:add_card': (card: CardInput) => void;
  /** Host only, lobby only: delete a special card by id. */
  'room:remove_card': (cardId: string) => void;
}
