import { randomUUID } from 'node:crypto';
import {
  addCard,
  addPlayerToLobby,
  applyAction,
  applySettings,
  createGame,
  currentPlayer,
  makeCard,
  removeCard,
  removePlayerFromLobby,
  renameTile,
  sanitizeCardInput,
  type ChatMessage,
  type GameAction,
  type GameSettings,
  type GameState,
  type RoomSummary,
} from '@marxopoly/shared';
import { config } from './config.js';
import { decideBotAction } from './bot.js';

const BOT_NAMES = ['Mira', 'Oslo', 'Pike', 'Junot', 'Wren', 'Cass', 'Bly', 'Nero'];

/** Hard ceiling on live rooms, so room-create spam cannot exhaust memory. */
const MAX_ROOMS = 400;

export interface Room {
  id: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  createdAt: number;
  state: GameState;
  /** playerId -> reconnect token. */
  tokens: Map<string, string>;
  /** playerId -> epoch ms after which the reconnect token is refused. */
  tokenExpiry: Map<string, number>;
  /** playerId -> socket id, only for connected players. */
  sockets: Map<string, string>;
  chat: ChatMessage[];
  /** Socket ids currently watching without a seat. */
  spectatorSockets: Set<string>;
  /** playerId -> timer that forfeits the seat if they never come back. */
  dropTimers: Map<string, NodeJS.Timeout>;
  botTimer: NodeJS.Timeout | null;
  lastActivity: number;
}

export type RoomListener = (room: Room) => void;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private onChange: RoomListener = () => {};
  private onChat: (room: Room, message: ChatMessage) => void = () => {};
  private ticker: NodeJS.Timeout | null = null;

  bind(onChange: RoomListener, onChat: (room: Room, message: ChatMessage) => void): void {
    this.onChange = onChange;
    this.onChat = onChat;
  }

  start(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    for (const room of this.rooms.values()) {
      for (const timer of room.dropTimers.values()) clearTimeout(timer);
      if (room.botTimer) clearTimeout(room.botTimer);
    }
  }

  // -------------------------------------------------------------------------
  // Lookup
  // -------------------------------------------------------------------------

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  list(): RoomSummary[] {
    return [...this.rooms.values()]
      // A finished game drops off the board — nothing left to join or watch.
      .filter((r) => !r.isPrivate && r.state.phase !== 'game_over')
      .map((r) => ({
        id: r.id,
        name: r.name,
        playerCount: r.state.players.filter((p) => !p.bankrupt).length,
        maxPlayers: r.state.settings.maxPlayers,
        spectatorCount: r.spectatorSockets.size,
        phase: r.state.phase,
        isPrivate: r.isPrivate,
        createdAt: r.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  }

  // -------------------------------------------------------------------------
  // Membership
  // -------------------------------------------------------------------------

  create(opts: {
    roomName: string;
    playerName: string;
    isPrivate: boolean;
    settings?: Partial<GameSettings>;
  }): { room: Room; playerId: string; token: string } {
    if (this.rooms.size >= MAX_ROOMS) {
      throw new Error('The server is at capacity right now. Try again in a few minutes.');
    }
    const id = shortCode();
    const playerId = randomUUID();
    const token = randomUUID();
    const state = createGame(id, [{ id: playerId, name: clean(opts.playerName) }], {
      turnSeconds: config.turnTimeoutSeconds,
      ...opts.settings,
    });

    const room: Room = {
      id,
      name: clean(opts.roomName) || `${clean(opts.playerName)}'s table`,
      hostId: playerId,
      isPrivate: opts.isPrivate,
      createdAt: Date.now(),
      state,
      tokens: new Map([[playerId, token]]),
      tokenExpiry: new Map([[playerId, Date.now() + config.reconnectTokenTtlMs]]),
      sockets: new Map(),
      chat: [],
      spectatorSockets: new Set(),
      dropTimers: new Map(),
      botTimer: null,
      lastActivity: Date.now(),
    };
    this.rooms.set(id, room);
    return { room, playerId, token };
  }

  join(
    roomId: string,
    playerName: string,
    token: string | undefined,
    socketId: string,
  ):
    | { ok: true; room: Room; playerId: string; token: string; displacedSocketId?: string }
    | { ok: true; room: Room; spectator: true }
    | { ok: false; error: string } {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return { ok: false, error: 'That room does not exist.' };

    // Reconnect path: a known, unexpired token gets its seat back, even mid-game.
    if (token) {
      for (const [playerId, stored] of room.tokens) {
        if (stored !== token) continue;
        if (Date.now() > (room.tokenExpiry.get(playerId) ?? 0)) break; // expired — treat as a fresh join
        const timer = room.dropTimers.get(playerId);
        if (timer) {
          clearTimeout(timer);
          room.dropTimers.delete(playerId);
        }
        // Sliding expiry: an actively used seat keeps its token alive.
        room.tokenExpiry.set(playerId, Date.now() + config.reconnectTokenTtlMs);
        // If another socket still holds this seat, it is a stale tab: hand the
        // seat to the new socket and tell the old one it has been replaced.
        const previous = room.sockets.get(playerId);
        room.sockets.set(playerId, socketId);
        this.dispatchInternal(room, playerId, { type: 'set_connected', playerId, connected: true });
        return previous && previous !== socketId
          ? { ok: true, room, playerId, token, displacedSocketId: previous }
          : { ok: true, room, playerId, token };
      }
    }

    // A game already under way has no seats to give — join as a viewer instead.
    if (room.state.phase !== 'lobby') {
      room.spectatorSockets.add(socketId);
      room.lastActivity = Date.now();
      this.emit(room);
      return { ok: true, room, spectator: true };
    }
    if (room.state.players.length >= room.state.settings.maxPlayers) {
      return { ok: false, error: 'That table is full.' };
    }

    const playerId = randomUUID();
    const newToken = randomUUID();
    room.state = addPlayerToLobby(room.state, { id: playerId, name: clean(playerName) });
    room.tokens.set(playerId, newToken);
    room.tokenExpiry.set(playerId, Date.now() + config.reconnectTokenTtlMs);
    room.sockets.set(playerId, socketId);
    room.lastActivity = Date.now();
    this.emit(room);
    return { ok: true, room, playerId, token: newToken };
  }

  addBot(room: Room, requesterId: string): string | null {
    if (room.hostId !== requesterId) return 'Only the host can add bots.';
    if (room.state.phase !== 'lobby') return 'Bots can only be added before the game starts.';
    if (room.state.players.length >= room.state.settings.maxPlayers) return 'The table is full.';
    const used = new Set(room.state.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${room.state.players.length}`;
    room.state = addPlayerToLobby(room.state, { id: randomUUID(), name, isBot: true });
    this.emit(room);
    return null;
  }

  kick(room: Room, requesterId: string, targetId: string): string | null {
    if (room.hostId !== requesterId) return 'Only the host can remove players.';
    if (room.state.phase !== 'lobby') return 'Players can only be removed before the game starts.';
    if (targetId === requesterId) return 'You cannot remove yourself.';
    room.state = removePlayerFromLobby(room.state, targetId);
    room.tokens.delete(targetId);
    room.tokenExpiry.delete(targetId);
    room.sockets.delete(targetId);
    this.emit(room);
    return null;
  }

  updateSettings(room: Room, requesterId: string, settings: Partial<GameSettings>): string | null {
    if (room.hostId !== requesterId) return 'Only the host can change the rules.';
    if (room.state.phase !== 'lobby') return 'The rules are locked once the game starts.';
    room.state = applySettings(room.state, settings);
    this.emit(room);
    return null;
  }

  renameTile(room: Room, requesterId: string, tileId: number, name: string): string | null {
    if (room.hostId !== requesterId) return 'Only the host can rename tiles.';
    if (room.state.phase !== 'lobby') return 'The board is locked once the game starts.';
    room.state = renameTile(room.state, tileId, name);
    this.emit(room);
    return null;
  }

  addCard(room: Room, requesterId: string, input: unknown): string | null {
    if (room.hostId !== requesterId) return 'Only the host can add cards.';
    if (room.state.phase !== 'lobby') return 'Cards are locked once the game starts.';
    const clean = sanitizeCardInput(input);
    if (typeof clean === 'string') return clean;
    room.state = addCard(room.state, makeCard(clean, `c-${randomUUID().slice(0, 8)}`));
    this.emit(room);
    return null;
  }

  removeCard(room: Room, requesterId: string, cardId: string): string | null {
    if (room.hostId !== requesterId) return 'Only the host can remove cards.';
    if (room.state.phase !== 'lobby') return 'Cards are locked once the game starts.';
    const before = room.state.cards.length;
    room.state = removeCard(room.state, cardId);
    if (room.state.cards.length === before) return 'A deck must keep at least one card.';
    this.emit(room);
    return null;
  }

  leave(room: Room, playerId: string): void {
    room.sockets.delete(playerId);
    if (room.state.phase === 'lobby') {
      room.state = removePlayerFromLobby(room.state, playerId);
      room.tokens.delete(playerId);
      room.tokenExpiry.delete(playerId);
      if (room.hostId === playerId) {
        const next = room.state.players.find((p) => !p.isBot);
        if (next) room.hostId = next.id;
      }
      if (room.state.players.every((p) => p.isBot)) this.destroy(room.id);
      else this.emit(room);
      return;
    }

    // Explicitly leaving a game in progress is a forfeit: the engine hands the
    // player's properties back to the bank (no houses, buyable again), zeroes
    // their cash, and ends the game if only one player is left standing.
    const timer = room.dropTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      room.dropTimers.delete(playerId);
    }
    room.tokens.delete(playerId);
    room.tokenExpiry.delete(playerId);
    if (room.state.phase !== 'game_over') {
      this.dispatchInternal(room, playerId, { type: 'resign' });
    } else {
      this.emit(room);
    }
  }

  /** A viewer closed the tab or left; drop them from the watch set. */
  leaveSpectator(room: Room, socketId: string): void {
    if (!room.spectatorSockets.delete(socketId)) return;
    room.lastActivity = Date.now();
    this.emit(room);
  }

  /** Called when a socket drops; the seat is held open for the grace period. */
  markDisconnected(room: Room, playerId: string): void {
    room.sockets.delete(playerId);
    this.dispatchInternal(room, playerId, { type: 'set_connected', playerId, connected: false });

    if (room.state.phase === 'lobby') {
      this.leave(room, playerId);
      return;
    }
    if (room.state.phase === 'game_over') return;

    const existing = room.dropTimers.get(playerId);
    if (existing) clearTimeout(existing);
    room.dropTimers.set(
      playerId,
      setTimeout(() => {
        room.dropTimers.delete(playerId);
        if (room.sockets.has(playerId)) return;
        this.dispatchInternal(room, playerId, { type: 'resign' });
      }, config.reconnectGraceMs),
    );
  }

  // -------------------------------------------------------------------------
  // Gameplay
  // -------------------------------------------------------------------------

  dispatch(room: Room, playerId: string, action: GameAction, spectator = false): string | null {
    if (spectator) return 'Viewers cannot take actions.';
    // Players may never inject engine-internal actions.
    if (action.type === 'set_connected' || action.type === 'timeout') {
      return 'Not allowed.';
    }
    return this.dispatchInternal(room, playerId, action);
  }

  private dispatchInternal(room: Room, playerId: string, action: GameAction): string | null {
    const result = applyAction(room.state, { playerId, action, now: Date.now() });
    if (!result.ok) return result.error;
    room.state = result.state;
    room.lastActivity = Date.now();
    this.emit(room);
    this.scheduleBot(room);
    return null;
  }

  chat(room: Room, playerId: string, text: string): void {
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) return;
    const trimmed = clean(text).slice(0, 300);
    if (!trimmed) return;
    const message: ChatMessage = {
      id: randomUUID(),
      playerId,
      name: player.name,
      color: player.color,
      text: trimmed,
      at: Date.now(),
    };
    room.chat.push(message);
    if (room.chat.length > 200) room.chat.shift();
    room.lastActivity = Date.now();
    this.onChat(room, message);
  }

  // -------------------------------------------------------------------------
  // Timers
  // -------------------------------------------------------------------------

  private tick(): void {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (
        room.sockets.size === 0 &&
        room.spectatorSockets.size === 0 &&
        now - room.lastActivity > config.emptyRoomTtlMs
      ) {
        this.destroy(room.id);
        continue;
      }
      const state = room.state;
      if (state.phase === 'lobby' || state.phase === 'game_over') continue;

      const deadline = state.phase === 'auction' ? state.auction?.deadline ?? null : state.turnDeadline;
      if (deadline && now > deadline) {
        this.dispatchInternal(room, 'server', { type: 'timeout' });
      }
    }
  }

  /** Bots act on a short delay so a human can follow what happened. */
  private scheduleBot(room: Room): void {
    if (room.botTimer) {
      clearTimeout(room.botTimer);
      room.botTimer = null;
    }
    const state = room.state;
    if (state.phase === 'lobby' || state.phase === 'game_over') return;

    const actor = pickBotActor(state);
    if (!actor) return;

    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      const action = decideBotAction(room.state, actor);
      if (!action) return;
      this.dispatchInternal(room, actor, action);
    }, config.botThinkMs);
  }

  destroy(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const timer of room.dropTimers.values()) clearTimeout(timer);
    if (room.botTimer) clearTimeout(room.botTimer);
    this.rooms.delete(roomId);
  }

  private emit(room: Room): void {
    this.onChange(room);
  }
}

/** Whichever bot the engine is currently waiting on, if any. */
function pickBotActor(state: GameState): string | null {
  if (state.phase === 'auction' && state.auction) {
    const id = state.auction.activeIds[state.auction.turnIndex];
    const player = state.players.find((p) => p.id === id);
    return player?.isBot ? player.id : null;
  }
  if (state.phase === 'debt' && state.debt) {
    const player = state.players.find((p) => p.id === state.debt!.debtorId);
    return player?.isBot ? player.id : null;
  }
  // A bot with a pending trade offer should answer it even off-turn.
  const pending = state.trades.find((t) => state.players.find((p) => p.id === t.toId)?.isBot);
  if (pending) return pending.toId;

  const current = currentPlayer(state);
  return current?.isBot ? current.id : null;
}

function clean(value: string): string {
  return (value ?? '').toString().replace(/\s+/g, ' ').trim().slice(0, 24);
}

// 6 chars from a 31-char alphabet ≈ 887M codes. Combined with join rate limiting
// this keeps "private" (unlisted) rooms effectively unguessable.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function shortCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}
