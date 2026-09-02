import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { config } from './config.js';
import { RoomManager } from './rooms.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// CLIENT_ORIGIN=* is an explicit opt-in to a fully open CORS policy. Otherwise
// we allow only: the configured origin(s), localhost, private-LAN addresses,
// and the ngrok tunnel origin once it is known.
const openCors = config.clientOrigin === '*';
const staticOrigins = openCors
    ? []
    : config.clientOrigin.split(',').map((o) => o.trim()).filter(Boolean);
let tunnelOrigin = null;
function originAllowed(origin) {
    if (!origin)
        return true; // same-origin, curl, native apps
    if (staticOrigins.includes(origin))
        return true;
    if (tunnelOrigin && origin === tunnelOrigin)
        return true;
    try {
        const { hostname, protocol } = new URL(origin);
        if (protocol !== 'http:' && protocol !== 'https:')
            return false;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')
            return true;
        if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname))
            return true;
        if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname))
            return true;
        if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname))
            return true;
    }
    catch {
        /* not a parseable origin */
    }
    return false;
}
const app = express();
app.use(compression());
app.use(cors(openCors
    ? { origin: true }
    : (req, cb) => cb(null, { origin: originAllowed(req.headers.origin ?? undefined) })));
app.use(express.json({ limit: '64kb' }));
const manager = new RoomManager();
app.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
});
app.get('/api/rooms', (_req, res) => {
    res.json(manager.list());
});
// In production the built client is served from the same origin.
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api|\/socket\.io|\/health).*/, (_req, res, next) => {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
        if (err)
            next();
    });
});
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: openCors
        ? { origin: true, methods: ['GET', 'POST'] }
        : { origin: (origin, cb) => cb(null, originAllowed(origin ?? undefined)), methods: ['GET', 'POST'] },
    pingTimeout: 20_000,
    // Cap inbound frames; nothing this app accepts is anywhere near this size.
    maxHttpBufferSize: 32_768,
});
/** socket.id -> where that socket is seated. `spectator` sockets have no game seat. */
const seats = new Map();
/**
 * The client never needs the RNG or the undrawn deck order — sending them lets
 * anyone predict every future roll and card. Strip them from every broadcast.
 */
function publicState(state) {
    return {
        ...state,
        rngState: 0,
        settings: { ...state.settings, seed: 0 },
        fortuneDeck: [],
        ledgerDeck: [],
    };
}
function roomStatePayload(room) {
    return { state: publicState(room.state), hostId: room.hostId, roomName: room.name };
}
// Coalesce lobby-list broadcasts: a burst of room changes produces one emit.
let listBroadcastPending = false;
function broadcastRoomList() {
    if (listBroadcastPending)
        return;
    listBroadcastPending = true;
    setTimeout(() => {
        listBroadcastPending = false;
        io.emit('room:list', manager.list());
    }, 400);
}
manager.bind((room) => {
    io.to(room.id).emit('room:state', roomStatePayload(room));
    broadcastRoomList();
}, (room, message) => {
    io.to(room.id).emit('room:chat', message);
});
manager.start();
// ---------------------------------------------------------------------------
// Per-socket rate limiting (token bucket) + per-connection room-creation cap
// ---------------------------------------------------------------------------
const RATE_CAPACITY = 40;
const RATE_REFILL_PER_SEC = 15;
const rateBuckets = new Map();
const roomsCreatedBy = new Map();
const MAX_ROOMS_PER_CONNECTION = 8;
function rateLimited(socketId, cost = 1) {
    const now = Date.now();
    let bucket = rateBuckets.get(socketId);
    if (!bucket) {
        bucket = { tokens: RATE_CAPACITY, ts: now };
        rateBuckets.set(socketId, bucket);
    }
    bucket.tokens = Math.min(RATE_CAPACITY, bucket.tokens + ((now - bucket.ts) / 1000) * RATE_REFILL_PER_SEC);
    bucket.ts = now;
    if (bucket.tokens < cost)
        return true;
    bucket.tokens -= cost;
    return false;
}
/** Returns true (and answers the caller) when this socket is over its budget. */
function tooFast(socket, ack, cost = 1) {
    if (!rateLimited(socket.id, cost))
        return false;
    const message = 'You are doing that too fast — slow down for a moment.';
    if (ack)
        ack({ ok: false, error: message });
    else
        socket.emit('room:error', { message });
    return true;
}
io.on('connection', (socket) => {
    socket.emit('room:list', manager.list());
    socket.on('lobby:list', () => {
        if (tooFast(socket))
            return;
        socket.emit('room:list', manager.list());
    });
    socket.on('room:create', (payload, ack) => {
        if (tooFast(socket, ack, 5))
            return;
        try {
            if (!payload?.playerName?.trim()) {
                ack({ ok: false, error: 'Pick a name first.' });
                return;
            }
            if ((roomsCreatedBy.get(socket.id) ?? 0) >= MAX_ROOMS_PER_CONNECTION) {
                ack({ ok: false, error: 'You have opened too many rooms from this connection.' });
                return;
            }
            const { room, playerId, token } = manager.create({
                roomName: payload.name ?? '',
                playerName: payload.playerName,
                isPrivate: !!payload.isPrivate,
                settings: sanitizeSettings(payload.settings),
            });
            roomsCreatedBy.set(socket.id, (roomsCreatedBy.get(socket.id) ?? 0) + 1);
            seatSocket(socket, room, playerId, token);
            ack({ ok: true, roomId: room.id });
        }
        catch (err) {
            ack({ ok: false, error: errorText(err) });
        }
    });
    socket.on('room:join', (payload, ack) => {
        if (tooFast(socket, ack, 4))
            return;
        try {
            const result = manager.join((payload?.roomId ?? '').trim(), payload?.playerName ?? 'Player', payload?.token, socket.id);
            if (!result.ok) {
                ack({ ok: false, error: result.error });
                return;
            }
            if ('spectator' in result) {
                seatSpectator(socket, result.room);
                ack({ ok: true, spectator: true });
                return;
            }
            if (result.displacedSocketId) {
                const stale = io.sockets.sockets.get(result.displacedSocketId);
                seats.delete(result.displacedSocketId);
                stale?.emit('room:left', { reason: 'You opened this table in another tab.' });
                stale?.leave(result.room.id);
            }
            seatSocket(socket, result.room, result.playerId, result.token);
            ack({ ok: true });
        }
        catch (err) {
            ack({ ok: false, error: errorText(err) });
        }
    });
    socket.on('room:action', (action, ack) => {
        if (tooFast(socket, ack))
            return;
        const seat = seats.get(socket.id);
        if (!seat) {
            ack?.({ ok: false, error: 'You are not in a room.' });
            return;
        }
        const room = manager.get(seat.roomId);
        if (!room) {
            ack?.({ ok: false, error: 'That room is gone.' });
            return;
        }
        const error = manager.dispatch(room, seat.playerId, action, seat.spectator);
        if (error) {
            socket.emit('room:error', { message: error });
            ack?.({ ok: false, error });
            return;
        }
        ack?.({ ok: true });
    });
    socket.on('room:chat', (text) => {
        if (tooFast(socket))
            return;
        const seat = seats.get(socket.id);
        if (!seat)
            return;
        const room = manager.get(seat.roomId);
        if (!room)
            return;
        manager.chat(room, seat.playerId, text ?? '');
    });
    socket.on('room:settings', (settings) => {
        if (tooFast(socket))
            return;
        const seat = seats.get(socket.id);
        if (!seat)
            return;
        const room = manager.get(seat.roomId);
        if (!room)
            return;
        const error = manager.updateSettings(room, seat.playerId, sanitizeSettings(settings) ?? {});
        if (error)
            socket.emit('room:error', { message: error });
    });
    socket.on('room:add_bot', () => {
        if (tooFast(socket))
            return;
        const seat = seats.get(socket.id);
        if (!seat)
            return;
        const room = manager.get(seat.roomId);
        if (!room)
            return;
        const error = manager.addBot(room, seat.playerId);
        if (error)
            socket.emit('room:error', { message: error });
    });
    socket.on('room:kick', (playerId) => {
        if (tooFast(socket))
            return;
        const seat = seats.get(socket.id);
        if (!seat)
            return;
        const room = manager.get(seat.roomId);
        if (!room)
            return;
        const error = manager.kick(room, seat.playerId, playerId);
        if (error)
            socket.emit('room:error', { message: error });
    });
    socket.on('room:rename_tile', (payload) => {
        if (tooFast(socket))
            return;
        const seat = seats.get(socket.id);
        if (!seat)
            return;
        const room = manager.get(seat.roomId);
        if (!room)
            return;
        const tileId = Number(payload?.tileId);
        if (!Number.isInteger(tileId))
            return;
        const error = manager.renameTile(room, seat.playerId, tileId, String(payload?.name ?? ''));
        if (error)
            socket.emit('room:error', { message: error });
    });
    socket.on('room:add_card', (card) => {
        if (tooFast(socket))
            return;
        const seat = seats.get(socket.id);
        if (!seat)
            return;
        const room = manager.get(seat.roomId);
        if (!room)
            return;
        const error = manager.addCard(room, seat.playerId, card);
        if (error)
            socket.emit('room:error', { message: error });
    });
    socket.on('room:remove_card', (cardId) => {
        if (tooFast(socket))
            return;
        const seat = seats.get(socket.id);
        if (!seat)
            return;
        const room = manager.get(seat.roomId);
        if (!room)
            return;
        const error = manager.removeCard(room, seat.playerId, String(cardId ?? ''));
        if (error)
            socket.emit('room:error', { message: error });
    });
    socket.on('room:leave', () => {
        const seat = seats.get(socket.id);
        if (!seat)
            return;
        const room = manager.get(seat.roomId);
        seats.delete(socket.id);
        socket.leave(seat.roomId);
        if (room) {
            if (seat.spectator)
                manager.leaveSpectator(room, socket.id);
            else
                manager.leave(room, seat.playerId);
        }
        socket.emit('room:left', { reason: seat.spectator ? 'You stopped watching.' : 'You left the table.' });
    });
    socket.on('disconnect', () => {
        rateBuckets.delete(socket.id);
        roomsCreatedBy.delete(socket.id);
        const seat = seats.get(socket.id);
        if (!seat)
            return;
        seats.delete(socket.id);
        const room = manager.get(seat.roomId);
        if (!room)
            return;
        if (seat.spectator)
            manager.leaveSpectator(room, socket.id);
        else
            manager.markDisconnected(room, seat.playerId);
    });
});
function seatSocket(socket, room, playerId, token) {
    seats.set(socket.id, { roomId: room.id, playerId });
    socket.join(room.id);
    socket.emit('room:joined', { roomId: room.id, playerId, token });
    socket.emit('room:state', roomStatePayload(room));
    for (const message of room.chat.slice(-30))
        socket.emit('room:chat', message);
}
/** Watch-only: no game seat, no reconnect token, no ability to act. */
function seatSpectator(socket, room) {
    const viewerId = `spectator:${socket.id}`;
    seats.set(socket.id, { roomId: room.id, playerId: viewerId, spectator: true });
    socket.join(room.id);
    socket.emit('room:joined', { roomId: room.id, playerId: viewerId, token: '', spectator: true });
    socket.emit('room:state', roomStatePayload(room));
    for (const message of room.chat.slice(-30))
        socket.emit('room:chat', message);
}
const NUMERIC_SETTINGS = [
    'startingCash',
    'startSalary',
    'holdingFine',
    'houseSupply',
    'hotelSupply',
    'turnSeconds',
    'maxPlayers',
];
const BOOLEAN_SETTINGS = [
    'doubleOnExactStart',
    'auctionsEnabled',
    'plazaPot',
    'noRentInHolding',
    'evenBuild',
    'doubleRentOnFullGroup',
];
/** Only known keys of the right type ever reach the engine. */
function sanitizeSettings(input) {
    if (!input || typeof input !== 'object')
        return undefined;
    const out = {};
    for (const key of NUMERIC_SETTINGS) {
        const value = input[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            out[key] = value;
        }
    }
    for (const key of BOOLEAN_SETTINGS) {
        const value = input[key];
        if (typeof value === 'boolean')
            out[key] = value;
    }
    return out;
}
function errorText(err) {
    return err instanceof Error ? err.message : 'Something went wrong.';
}
let tunnel = null;
/** Non-internal IPv4 addresses, so people on the same Wi-Fi can join too. */
function lanAddresses() {
    const out = [];
    for (const iface of Object.values(networkInterfaces())) {
        for (const net of iface ?? []) {
            if (net.family === 'IPv4' && !net.internal)
                out.push(net.address);
        }
    }
    return out;
}
function banner(lines) {
    const width = Math.max(...lines.map((line) => line.length));
    const rule = '─'.repeat(width + 2);
    console.log(`\n┌${rule}┐`);
    for (const line of lines)
        console.log(`│ ${line.padEnd(width)} │`);
    console.log(`└${rule}┘\n`);
}
function missingTokenHelp() {
    console.error('  No ngrok token found. The SDK only reads the NGROK_AUTHTOKEN');
    console.error('  environment variable — NOT `ngrok config add-authtoken`.');
    console.error('  Add this line to `.env` in the repo root:');
    console.error('      NGROK_AUTHTOKEN=<token from https://dashboard.ngrok.com>\n');
}
async function openTunnel() {
    if (!config.ngrokAuthtoken) {
        console.error('\n  ngrok tunnel skipped.');
        missingTokenHelp();
        return;
    }
    console.log('  Opening ngrok tunnel…');
    try {
        const ngrok = await import('@ngrok/ngrok');
        const listener = await ngrok.forward({
            addr: config.port,
            authtoken: config.ngrokAuthtoken,
            ...(config.ngrokDomain ? { domain: config.ngrokDomain } : {}),
        });
        tunnel = listener;
        const url = listener.url();
        if (url) {
            try {
                tunnelOrigin = new URL(url).origin;
            }
            catch {
                /* keep tunnelOrigin null; the configured origins still work */
            }
            banner(['Invite link — anyone can join from here:', '', `    ${url}`]);
        }
        else {
            console.log('  ngrok tunnel started but returned no URL.\n');
        }
    }
    catch (err) {
        const message = errorText(err);
        console.error(`\n  ngrok tunnel failed: ${message}`);
        if (/ERR_NGROK_4018|not authenticated|authtoken/i.test(message)) {
            missingTokenHelp();
        }
        else if (/ERR_NGROK_334|already online/i.test(message)) {
            console.error('  Another ngrok session is still running (free ngrok allows one).');
            console.error('  Close the other `pnpm share` / ngrok agent, or wait ~1 min and retry.\n');
        }
    }
}
httpServer.listen(config.port, () => {
    const urls = [
        `http://localhost:${config.port}`,
        ...lanAddresses().map((ip) => `http://${ip}:${config.port}`),
    ];
    banner(['Marxopoly server is running', '', ...urls.map((u) => `    ${u}`)]);
    if (config.share) {
        void openTunnel();
    }
    else if (!config.isProd) {
        console.log('  Tip: `pnpm share` publishes a public ngrok link for remote players.\n');
    }
});
const shutdown = async () => {
    manager.stop();
    io.close();
    if (tunnel) {
        try {
            const ngrok = await import('@ngrok/ngrok');
            await ngrok.kill(); // ends the whole session so the free endpoint frees up
        }
        catch {
            /* ignore */
        }
    }
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
//# sourceMappingURL=index.js.map