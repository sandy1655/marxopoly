import { io, type Socket } from 'socket.io-client';
import { useSyncExternalStore } from 'react';
import type {
  ChatMessage,
  ClientToServerEvents,
  GameAction,
  GameSettings,
  GameState,
  RoomSummary,
  ServerToClientEvents,
} from '@rentier/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';
const STORAGE_KEY = 'rentier.session.v1';

export interface StoredSession {
  roomId: string;
  token: string;
  playerName: string;
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage may be unavailable; the app still works, just without reconnect */
  }
}

export interface ClientStore {
  connected: boolean;
  roomId: string | null;
  roomName: string;
  playerId: string | null;
  hostId: string | null;
  game: GameState | null;
  rooms: RoomSummary[];
  chat: ChatMessage[];
  error: string | null;
  playerName: string;
  joining: boolean;
}

let state: ClientStore = {
  connected: false,
  roomId: null,
  roomName: '',
  playerId: null,
  hostId: null,
  game: null,
  rooms: [],
  chat: [],
  error: null,
  playerName: readSession()?.playerName ?? '',
  joining: false,
};

const listeners = new Set<() => void>();

function set(patch: Partial<ClientStore>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function useStore<T>(select: (s: ClientStore) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => select(state),
    () => select(state),
  );
}

export function getState(): ClientStore {
  return state;
}

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  set({ connected: true });
  socket.emit('lobby:list');
  // Try to walk straight back into whatever table we were sitting at.
  const session = readSession();
  if (session?.roomId && session.token) {
    socket.emit(
      'room:join',
      { roomId: session.roomId, playerName: session.playerName, token: session.token },
      (res) => {
        if (!res.ok) writeSession(null);
      },
    );
  }
});

socket.on('disconnect', () => set({ connected: false }));

socket.on('room:list', (rooms) => set({ rooms }));

socket.on('room:joined', ({ roomId, playerId, token }) => {
  writeSession({ roomId, token, playerName: state.playerName });
  set({ roomId, playerId, error: null, joining: false });
});

socket.on('room:state', ({ state: game, hostId, roomName }) => {
  set({ game, hostId, roomName });
});

socket.on('room:chat', (message) => {
  const chat = [...state.chat.filter((m) => m.id !== message.id), message].slice(-200);
  set({ chat });
});

socket.on('room:error', ({ message }) => {
  set({ error: message });
  window.setTimeout(() => {
    if (state.error === message) set({ error: null });
  }, 4000);
});

socket.on('room:left', () => {
  writeSession(null);
  set({ roomId: null, playerId: null, game: null, chat: [], hostId: null });
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export function setPlayerName(name: string): void {
  set({ playerName: name });
  const session = readSession();
  if (session) writeSession({ ...session, playerName: name });
}

export function setError(message: string | null): void {
  set({ error: message });
}

export function createRoom(roomName: string, isPrivate: boolean, settings?: Partial<GameSettings>): void {
  set({ joining: true, error: null });
  socket.emit(
    'room:create',
    { name: roomName, playerName: state.playerName || 'Player', isPrivate, settings },
    (res) => {
      if (!res.ok) set({ error: res.error ?? 'Could not create the room.', joining: false });
    },
  );
}

export function joinRoom(roomId: string): void {
  set({ joining: true, error: null });
  socket.emit('room:join', { roomId: roomId.trim().toUpperCase(), playerName: state.playerName || 'Player' }, (res) => {
    if (!res.ok) set({ error: res.error ?? 'Could not join.', joining: false });
  });
}

export function leaveRoom(): void {
  socket.emit('room:leave');
  writeSession(null);
  set({ roomId: null, playerId: null, game: null, chat: [], hostId: null });
}

export function send(action: GameAction): void {
  socket.emit('room:action', action, (res) => {
    if (!res.ok && res.error) setError(res.error);
  });
}

export function sendChat(text: string): void {
  socket.emit('room:chat', text);
}

export function updateSettings(settings: Partial<GameSettings>): void {
  socket.emit('room:settings', settings);
}

export function addBot(): void {
  socket.emit('room:add_bot');
}

export function kickPlayer(playerId: string): void {
  socket.emit('room:kick', playerId);
}

export function refreshRooms(): void {
  socket.emit('lobby:list');
}
