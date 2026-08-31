import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  GameAction,
  GameSettings,
  ServerToClientEvents,
} from '@rentier/shared';
import { config } from './config.js';
import { RoomManager, type Room } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// When sharing over ngrok the client is served from the tunnel origin and talks
// to socket.io on that same origin, so just reflect whatever origin asks.
const corsOrigin: boolean | string[] =
  config.share || config.clientOrigin === '*' ? true : config.clientOrigin.split(',');

const app = express();
app.use(compression());
app.use(cors({ origin: corsOrigin }));
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
    if (err) next();
  });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  pingTimeout: 20_000,
});

/** socket.id -> where that socket is seated. */
const seats = new Map<string, { roomId: string; playerId: string }>();

manager.bind(
  (room) => {
    io.to(room.id).emit('room:state', {
      state: room.state,
      hostId: room.hostId,
      roomName: room.name,
    });
    io.emit('room:list', manager.list());
  },
  (room, message) => {
    io.to(room.id).emit('room:chat', message);
  },
);
manager.start();

io.on('connection', (socket) => {
  socket.emit('room:list', manager.list());

  socket.on('lobby:list', () => {
    socket.emit('room:list', manager.list());
  });

  socket.on('room:create', (payload, ack) => {
    try {
      if (!payload?.playerName?.trim()) {
        ack({ ok: false, error: 'Pick a name first.' });
        return;
      }
      const { room, playerId, token } = manager.create({
        roomName: payload.name ?? '',
        playerName: payload.playerName,
        isPrivate: !!payload.isPrivate,
        settings: sanitizeSettings(payload.settings),
      });
      seatSocket(socket, room, playerId, token);
      ack({ ok: true, roomId: room.id });
    } catch (err) {
      ack({ ok: false, error: errorText(err) });
    }
  });

  socket.on('room:join', (payload, ack) => {
    try {
      const result = manager.join(
        (payload?.roomId ?? '').trim(),
        payload?.playerName ?? 'Player',
        payload?.token,
        socket.id,
      );
      if (!result.ok) {
        ack({ ok: false, error: result.error });
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
    } catch (err) {
      ack({ ok: false, error: errorText(err) });
    }
  });

  socket.on('room:action', (action: GameAction, ack) => {
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
    const error = manager.dispatch(room, seat.playerId, action);
    if (error) {
      socket.emit('room:error', { message: error });
      ack?.({ ok: false, error });
      return;
    }
    ack?.({ ok: true });
  });

  socket.on('room:chat', (text) => {
    const seat = seats.get(socket.id);
    if (!seat) return;
    const room = manager.get(seat.roomId);
    if (!room) return;
    manager.chat(room, seat.playerId, text ?? '');
  });

  socket.on('room:settings', (settings) => {
    const seat = seats.get(socket.id);
    if (!seat) return;
    const room = manager.get(seat.roomId);
    if (!room) return;
    const error = manager.updateSettings(room, seat.playerId, sanitizeSettings(settings) ?? {});
    if (error) socket.emit('room:error', { message: error });
  });

  socket.on('room:add_bot', () => {
    const seat = seats.get(socket.id);
    if (!seat) return;
    const room = manager.get(seat.roomId);
    if (!room) return;
    const error = manager.addBot(room, seat.playerId);
    if (error) socket.emit('room:error', { message: error });
  });

  socket.on('room:kick', (playerId) => {
    const seat = seats.get(socket.id);
    if (!seat) return;
    const room = manager.get(seat.roomId);
    if (!room) return;
    const error = manager.kick(room, seat.playerId, playerId);
    if (error) socket.emit('room:error', { message: error });
  });

  socket.on('room:leave', () => {
    const seat = seats.get(socket.id);
    if (!seat) return;
    const room = manager.get(seat.roomId);
    seats.delete(socket.id);
    socket.leave(seat.roomId);
    if (room) manager.leave(room, seat.playerId);
    socket.emit('room:left', { reason: 'You left the table.' });
  });

  socket.on('disconnect', () => {
    const seat = seats.get(socket.id);
    if (!seat) return;
    seats.delete(socket.id);
    const room = manager.get(seat.roomId);
    if (room) manager.markDisconnected(room, seat.playerId);
  });
});

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function seatSocket(socket: GameSocket, room: Room, playerId: string, token: string): void {
  seats.set(socket.id, { roomId: room.id, playerId });
  socket.join(room.id);
  socket.emit('room:joined', { roomId: room.id, playerId, token });
  socket.emit('room:state', { state: room.state, hostId: room.hostId, roomName: room.name });
  for (const message of room.chat.slice(-30)) socket.emit('room:chat', message);
}

const NUMERIC_SETTINGS: (keyof GameSettings)[] = [
  'startingCash',
  'startSalary',
  'holdingFine',
  'houseSupply',
  'hotelSupply',
  'turnSeconds',
  'maxPlayers',
];

const BOOLEAN_SETTINGS: (keyof GameSettings)[] = [
  'doubleOnExactStart',
  'auctionsEnabled',
  'plazaPot',
  'noRentInHolding',
  'evenBuild',
  'doubleRentOnFullGroup',
];

/** Only known keys of the right type ever reach the engine. */
function sanitizeSettings(input: Partial<GameSettings> | undefined): Partial<GameSettings> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: Partial<GameSettings> = {};
  for (const key of NUMERIC_SETTINGS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  for (const key of BOOLEAN_SETTINGS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === 'boolean') (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

// ---------------------------------------------------------------------------
// Startup & address banner
// ---------------------------------------------------------------------------

interface Tunnel {
  url(): string | null;
  close(): Promise<void>;
}
let tunnel: Tunnel | null = null;

/** Non-internal IPv4 addresses, so people on the same Wi-Fi can join too. */
function lanAddresses(): string[] {
  const out: string[] = [];
  for (const iface of Object.values(networkInterfaces())) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

function banner(lines: string[]): void {
  const width = Math.max(...lines.map((line) => line.length));
  const rule = '─'.repeat(width + 2);
  console.log(`\n┌${rule}┐`);
  for (const line of lines) console.log(`│ ${line.padEnd(width)} │`);
  console.log(`└${rule}┘\n`);
}

function missingTokenHelp(): void {
  console.error('  No ngrok token found. The SDK only reads the NGROK_AUTHTOKEN');
  console.error('  environment variable — NOT `ngrok config add-authtoken`.');
  console.error('  Add this line to `.env` in the repo root:');
  console.error('      NGROK_AUTHTOKEN=<token from https://dashboard.ngrok.com>\n');
}

async function openTunnel(): Promise<void> {
  if (!config.ngrokAuthtoken) {
    console.error('\n  ngrok tunnel skipped.');
    missingTokenHelp();
    return;
  }
  console.log('  Opening ngrok tunnel…');
  try {
    const ngrok = await import('@ngrok/ngrok');
    const listener: Tunnel = await ngrok.forward({
      addr: config.port,
      authtoken: config.ngrokAuthtoken,
      ...(config.ngrokDomain ? { domain: config.ngrokDomain } : {}),
    });
    tunnel = listener;
    const url = listener.url();
    if (url) {
      banner(['Invite link — anyone can join from here:', '', `    ${url}`]);
    } else {
      console.log('  ngrok tunnel started but returned no URL.\n');
    }
  } catch (err) {
    const message = errorText(err);
    console.error(`\n  ngrok tunnel failed: ${message}`);
    if (/ERR_NGROK_4018|not authenticated|authtoken/i.test(message)) {
      missingTokenHelp();
    } else if (/ERR_NGROK_334|already online/i.test(message)) {
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
  banner(['Rentier server is running', '', ...urls.map((u) => `    ${u}`)]);
  if (config.share) {
    void openTunnel();
  } else if (!config.isProd) {
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
    } catch {
      /* ignore */
    }
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
