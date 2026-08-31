import { randomUUID } from 'node:crypto';
import { addCard, addPlayerToLobby, applyAction, applySettings, createGame, currentPlayer, makeCard, removeCard, removePlayerFromLobby, renameTile, sanitizeCardInput, } from '@marxopoly/shared';
import { config } from './config.js';
import { decideBotAction } from './bot.js';
const BOT_NAMES = ['Mira', 'Oslo', 'Pike', 'Junot', 'Wren', 'Cass', 'Bly', 'Nero'];
export class RoomManager {
    rooms = new Map();
    onChange = () => { };
    onChat = () => { };
    ticker = null;
    bind(onChange, onChat) {
        this.onChange = onChange;
        this.onChat = onChat;
    }
    start() {
        if (this.ticker)
            return;
        this.ticker = setInterval(() => this.tick(), 1000);
    }
    stop() {
        if (this.ticker)
            clearInterval(this.ticker);
        this.ticker = null;
        for (const room of this.rooms.values()) {
            for (const timer of room.dropTimers.values())
                clearTimeout(timer);
            if (room.botTimer)
                clearTimeout(room.botTimer);
        }
    }
    // -------------------------------------------------------------------------
    // Lookup
    // -------------------------------------------------------------------------
    get(roomId) {
        return this.rooms.get(roomId);
    }
    list() {
        return [...this.rooms.values()]
            // A finished game drops off the board — nothing left to join or watch.
            .filter((r) => !r.isPrivate && r.state.phase !== 'game_over')
            .map((r) => ({
            id: r.id,
            name: r.name,
            hostId: r.hostId,
            playerCount: r.state.players.filter((p) => !p.bankrupt).length,
            maxPlayers: r.state.settings.maxPlayers,
            spectatorCount: r.spectators,
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
    create(opts) {
        const id = shortCode();
        const playerId = randomUUID();
        const token = randomUUID();
        const state = createGame(id, [{ id: playerId, name: clean(opts.playerName) }], {
            turnSeconds: config.turnTimeoutSeconds,
            ...opts.settings,
        });
        const room = {
            id,
            name: clean(opts.roomName) || `${clean(opts.playerName)}'s table`,
            hostId: playerId,
            isPrivate: opts.isPrivate,
            createdAt: Date.now(),
            state,
            tokens: new Map([[playerId, token]]),
            sockets: new Map(),
            chat: [],
            spectators: 0,
            dropTimers: new Map(),
            botTimer: null,
            lastActivity: Date.now(),
        };
        this.rooms.set(id, room);
        return { room, playerId, token };
    }
    join(roomId, playerName, token, socketId) {
        const room = this.rooms.get(roomId.toUpperCase());
        if (!room)
            return { ok: false, error: 'That room does not exist.' };
        // Reconnect path: a known token gets its seat back, even mid-game.
        if (token) {
            for (const [playerId, stored] of room.tokens) {
                if (stored !== token)
                    continue;
                const timer = room.dropTimers.get(playerId);
                if (timer) {
                    clearTimeout(timer);
                    room.dropTimers.delete(playerId);
                }
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
            room.spectators += 1;
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
        room.sockets.set(playerId, socketId);
        room.lastActivity = Date.now();
        this.emit(room);
        return { ok: true, room, playerId, token: newToken };
    }
    addBot(room, requesterId) {
        if (room.hostId !== requesterId)
            return 'Only the host can add bots.';
        if (room.state.phase !== 'lobby')
            return 'Bots can only be added before the game starts.';
        if (room.state.players.length >= room.state.settings.maxPlayers)
            return 'The table is full.';
        const used = new Set(room.state.players.map((p) => p.name));
        const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${room.state.players.length}`;
        room.state = addPlayerToLobby(room.state, { id: randomUUID(), name, isBot: true });
        this.emit(room);
        return null;
    }
    kick(room, requesterId, targetId) {
        if (room.hostId !== requesterId)
            return 'Only the host can remove players.';
        if (room.state.phase !== 'lobby')
            return 'Players can only be removed before the game starts.';
        if (targetId === requesterId)
            return 'You cannot remove yourself.';
        room.state = removePlayerFromLobby(room.state, targetId);
        room.tokens.delete(targetId);
        room.sockets.delete(targetId);
        this.emit(room);
        return null;
    }
    updateSettings(room, requesterId, settings) {
        if (room.hostId !== requesterId)
            return 'Only the host can change the rules.';
        if (room.state.phase !== 'lobby')
            return 'The rules are locked once the game starts.';
        room.state = applySettings(room.state, settings);
        this.emit(room);
        return null;
    }
    renameTile(room, requesterId, tileId, name) {
        if (room.hostId !== requesterId)
            return 'Only the host can rename tiles.';
        if (room.state.phase !== 'lobby')
            return 'The board is locked once the game starts.';
        room.state = renameTile(room.state, tileId, name);
        this.emit(room);
        return null;
    }
    addCard(room, requesterId, input) {
        if (room.hostId !== requesterId)
            return 'Only the host can add cards.';
        if (room.state.phase !== 'lobby')
            return 'Cards are locked once the game starts.';
        const clean = sanitizeCardInput(input);
        if (typeof clean === 'string')
            return clean;
        room.state = addCard(room.state, makeCard(clean, `c-${randomUUID().slice(0, 8)}`));
        this.emit(room);
        return null;
    }
    removeCard(room, requesterId, cardId) {
        if (room.hostId !== requesterId)
            return 'Only the host can remove cards.';
        if (room.state.phase !== 'lobby')
            return 'Cards are locked once the game starts.';
        const before = room.state.cards.length;
        room.state = removeCard(room.state, cardId);
        if (room.state.cards.length === before)
            return 'A deck must keep at least one card.';
        this.emit(room);
        return null;
    }
    leave(room, playerId) {
        room.sockets.delete(playerId);
        if (room.state.phase === 'lobby') {
            room.state = removePlayerFromLobby(room.state, playerId);
            room.tokens.delete(playerId);
            if (room.hostId === playerId) {
                const next = room.state.players.find((p) => !p.isBot);
                if (next)
                    room.hostId = next.id;
            }
            if (room.state.players.every((p) => p.isBot))
                this.destroy(room.id);
            else
                this.emit(room);
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
        if (room.state.phase !== 'game_over') {
            this.dispatchInternal(room, playerId, { type: 'resign' });
        }
        else {
            this.emit(room);
        }
    }
    /** A viewer closed the tab or left; just drop the head count. */
    leaveSpectator(room) {
        room.spectators = Math.max(0, room.spectators - 1);
        room.lastActivity = Date.now();
        this.emit(room);
    }
    /** Called when a socket drops; the seat is held open for the grace period. */
    markDisconnected(room, playerId) {
        room.sockets.delete(playerId);
        this.dispatchInternal(room, playerId, { type: 'set_connected', playerId, connected: false });
        if (room.state.phase === 'lobby') {
            this.leave(room, playerId);
            return;
        }
        if (room.state.phase === 'game_over')
            return;
        const existing = room.dropTimers.get(playerId);
        if (existing)
            clearTimeout(existing);
        room.dropTimers.set(playerId, setTimeout(() => {
            room.dropTimers.delete(playerId);
            if (room.sockets.has(playerId))
                return;
            this.dispatchInternal(room, playerId, { type: 'resign' });
        }, config.reconnectGraceMs));
    }
    // -------------------------------------------------------------------------
    // Gameplay
    // -------------------------------------------------------------------------
    dispatch(room, playerId, action, spectator = false) {
        if (spectator)
            return 'Viewers cannot take actions.';
        // Players may never inject engine-internal actions.
        if (action.type === 'set_connected' || action.type === 'timeout') {
            return 'Not allowed.';
        }
        return this.dispatchInternal(room, playerId, action);
    }
    dispatchInternal(room, playerId, action) {
        const result = applyAction(room.state, { playerId, action, now: Date.now() });
        if (!result.ok)
            return result.error;
        room.state = result.state;
        room.lastActivity = Date.now();
        this.emit(room);
        this.scheduleBot(room);
        return null;
    }
    chat(room, playerId, text) {
        const player = room.state.players.find((p) => p.id === playerId);
        if (!player)
            return;
        const trimmed = clean(text).slice(0, 300);
        if (!trimmed)
            return;
        const message = {
            id: randomUUID(),
            playerId,
            name: player.name,
            color: player.color,
            text: trimmed,
            at: Date.now(),
        };
        room.chat.push(message);
        if (room.chat.length > 200)
            room.chat.shift();
        room.lastActivity = Date.now();
        this.onChat(room, message);
    }
    // -------------------------------------------------------------------------
    // Timers
    // -------------------------------------------------------------------------
    tick() {
        const now = Date.now();
        for (const room of [...this.rooms.values()]) {
            if (room.sockets.size === 0 &&
                room.spectators === 0 &&
                now - room.lastActivity > config.emptyRoomTtlMs) {
                this.destroy(room.id);
                continue;
            }
            const state = room.state;
            if (state.phase === 'lobby' || state.phase === 'game_over')
                continue;
            const deadline = state.phase === 'auction' ? state.auction?.deadline ?? null : state.turnDeadline;
            if (deadline && now > deadline) {
                this.dispatchInternal(room, 'server', { type: 'timeout' });
            }
        }
    }
    /** Bots act on a short delay so a human can follow what happened. */
    scheduleBot(room) {
        if (room.botTimer) {
            clearTimeout(room.botTimer);
            room.botTimer = null;
        }
        const state = room.state;
        if (state.phase === 'lobby' || state.phase === 'game_over')
            return;
        const actor = pickBotActor(state);
        if (!actor)
            return;
        room.botTimer = setTimeout(() => {
            room.botTimer = null;
            const action = decideBotAction(room.state, actor);
            if (!action)
                return;
            this.dispatchInternal(room, actor, action);
        }, config.botThinkMs);
    }
    destroy(roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        for (const timer of room.dropTimers.values())
            clearTimeout(timer);
        if (room.botTimer)
            clearTimeout(room.botTimer);
        this.rooms.delete(roomId);
    }
    emit(room) {
        this.onChange(room);
    }
}
/** Whichever bot the engine is currently waiting on, if any. */
function pickBotActor(state) {
    if (state.phase === 'auction' && state.auction) {
        const id = state.auction.activeIds[state.auction.turnIndex];
        const player = state.players.find((p) => p.id === id);
        return player?.isBot ? player.id : null;
    }
    if (state.phase === 'debt' && state.debt) {
        const player = state.players.find((p) => p.id === state.debt.debtorId);
        return player?.isBot ? player.id : null;
    }
    // A bot with a pending trade offer should answer it even off-turn.
    const pending = state.trades.find((t) => state.players.find((p) => p.id === t.toId)?.isBot);
    if (pending)
        return pending.toId;
    const current = currentPlayer(state);
    return current?.isBot ? current.id : null;
}
function clean(value) {
    return (value ?? '').toString().replace(/\s+/g, ' ').trim().slice(0, 24);
}
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function shortCode() {
    let out = '';
    for (let i = 0; i < 5; i++) {
        out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return out;
}
//# sourceMappingURL=rooms.js.map