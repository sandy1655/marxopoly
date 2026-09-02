import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

// Read .env from the server package (cwd) and, if present, the repo root — so a
// single .env at the workspace root works no matter where the script is run.
loadEnv();
for (let dir = dirname(fileURLToPath(import.meta.url)), i = 0; i < 6; i += 1, dir = dirname(dir)) {
  if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
    loadEnv({ path: resolve(dir, '.env') });
    break;
  }
}

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const flag = (value: string | undefined): boolean =>
  ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase());

/** Open a public ngrok tunnel on startup (so remote players can join). */
const shareEnabled =
  process.argv.includes('--share') || flag(process.env.SHARE) || flag(process.env.NGROK);

export const config = {
  port: int(process.env.PORT, 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  /** How long a disconnected player keeps their seat. */
  reconnectGraceMs: int(process.env.RECONNECT_GRACE_MS, 120_000),
  /** How long a reconnect token stays valid (refreshed on each use). */
  reconnectTokenTtlMs: int(process.env.RECONNECT_TOKEN_TTL_MS, 12 * 60 * 60_000),
  turnTimeoutSeconds: int(process.env.TURN_TIMEOUT_SECONDS, 90),
  /** Rooms with no connected players are swept after this long. */
  emptyRoomTtlMs: int(process.env.EMPTY_ROOM_TTL_MS, 15 * 60_000),
  botThinkMs: int(process.env.BOT_THINK_MS, 1200),
  isProd: process.env.NODE_ENV === 'production',

  /** ngrok tunnel — `pnpm share`, `--share`, or SHARE=1 / NGROK=1. */
  share: shareEnabled,
  /** Required for `pnpm share`. Put it in `.env`; the SDK ignores the ngrok CLI config. */
  ngrokAuthtoken: process.env.NGROK_AUTHTOKEN,
  /** Optional reserved domain, e.g. "my-game.ngrok.app". */
  ngrokDomain: process.env.NGROK_DOMAIN,
};
