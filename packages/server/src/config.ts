import 'dotenv/config';

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: int(process.env.PORT, 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  /** How long a disconnected player keeps their seat. */
  reconnectGraceMs: int(process.env.RECONNECT_GRACE_MS, 120_000),
  turnTimeoutSeconds: int(process.env.TURN_TIMEOUT_SECONDS, 90),
  /** Rooms with no connected players are swept after this long. */
  emptyRoomTtlMs: int(process.env.EMPTY_ROOM_TTL_MS, 15 * 60_000),
  botThinkMs: int(process.env.BOT_THINK_MS, 1200),
  isProd: process.env.NODE_ENV === 'production',
};
