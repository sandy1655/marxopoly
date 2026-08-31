# Rentier

A real-time, multiplayer property-trading board game for the browser. Create a table, share the
five-character code, and play with two to eight people — or fill the empty seats with bots.

Rentier is an original game with its own board, its own card decks and its own rules engine. It is
not affiliated with, endorsed by, or derived from any commercial board game or its publisher.

---

## What's in the box

| Package | What it is |
| --- | --- |
| `packages/shared` | The pure TypeScript game engine — board data, card decks, seeded RNG, and a single `applyAction(state, action)` reducer. No I/O, fully unit-tested. |
| `packages/server` | Express + Socket.IO. Owns the authoritative state, room lifecycle, reconnects, turn timers and bot scheduling. |
| `packages/client` | Vite + React + TypeScript. Board, panels, trading, auctions, chat. |

The engine is deliberately isolated: the server never trusts a client, and the client renders
whatever state the server broadcasts. Every rule lives in one place.

## Features

- **Live multiplayer rooms** — public lobby listing or private code-only tables, 2–8 players.
- **Full ruleset** — buying, rent, colour-group bonuses, houses and hotels with even-build,
  mortgages (and the 10% fee to lift them), the holding yard with three ways out, doubles and the
  three-doubles penalty, salary at Start, taxes, two card decks.
- **Auctions** — declining a property opens a turn-based auction with bid validation.
- **Trading** — multi-asset offers (cash, deeds, reprieve cards) with an inbox, re-validated at the
  moment of acceptance so a stale offer can never execute.
- **Debt instead of instant death** — falling short opens a debt you must settle by selling
  buildings, mortgaging or trading. Bankruptcy is only allowed when you genuinely cannot pay.
- **Reconnect** — your seat is held for two minutes; refreshing the tab drops you straight back in,
  and a second tab joins as a separate player instead of stealing your seat.
- **Bright, readable board** — full-colour property headers, short board labels, large tokens with
  player initials, and an owner bar on each tile's outer edge.
- **Turn timers** — configurable, with sensible auto-resolution when they expire.
- **Bots** — heuristic opponents that buy, build, bid and answer trades.
- **Deterministic** — the whole game runs off one seed, so a game replays identically.

## Quick start

```bash
pnpm install
pnpm --filter @rentier/shared build   # the client and server consume its dist output
pnpm dev                              # server on :3001, client on :5173
```

Open http://localhost:5173, create a table, and open the same URL in a **second browser tab** (or
send the five-character code to a friend) to join.

Each tab is its own player. The seat token is kept in `sessionStorage`, which is per-tab, so
refreshing a tab keeps your seat while a new tab starts fresh and can join as somebody else. If a
second tab ever reclaims a seat, the older tab is told it was replaced rather than silently going
dead.

### Production

```bash
pnpm build
pnpm start        # serves the built client and the socket server on one port (default 3001)
```

### Docker

```bash
docker compose up --build
```

## Configuration

Copy `.env.example` to `.env` in the repo root (the server reads it at startup).

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | HTTP + WebSocket port. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin(s), comma-separated, or `*`. |
| `RECONNECT_GRACE_MS` | `120000` | How long a disconnected player keeps their seat. |
| `TURN_TIMEOUT_SECONDS` | `90` | Default turn timer for new rooms (`0` disables). |
| `EMPTY_ROOM_TTL_MS` | `900000` | Idle empty rooms are swept after this. |
| `BOT_THINK_MS` | `1200` | Bot delay, so humans can follow what happened. |

The client can point at a different backend with `VITE_SERVER_URL`.

Per-table house rules (starting cash, salary, auctions on/off, even build, double rent on full sets,
plaza pot, turn timer, max players) are set by the host in the lobby.

## The board

Forty tiles: twenty-two streets in eight colour groups, four depots, two works, two taxes, four
corners, and seven card tiles.

- **Streets** pay a base rent that doubles when one player holds the whole colour group unimproved,
  then follow a five-step ladder through four houses to a hotel.
- **Depots** pay 25 / 50 / 100 / 200 depending on how many of the four you hold.
- **Works** pay 4x or 10x the dice roll depending on whether you hold one or both.
- **Fortune** and **Ledger** are the two sixteen-card decks.
- The **Holding Yard** detains you: roll doubles, pay the fine, or spend a reprieve card. After
  three failed attempts you pay and move.

## How the engine works

```ts
import { applyAction, createGame } from '@rentier/shared';

let state = createGame('room-1', [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Brix' }]);
const result = applyAction(state, { playerId: 'a', action: { type: 'start_game' }, now: Date.now() });
if (result.ok) state = result.state;
```

`applyAction` deep-clones, mutates the clone, and returns either `{ ok: true, state }` or
`{ ok: false, error }`. A rejected action never touches the original state, so the server can hand
an error straight back to the offending client and keep going. All randomness comes from
`state.rngState`, so identical inputs give identical games.

The phases are `lobby -> pre_roll -> (awaiting_buy | auction | debt) -> post_roll -> ... -> game_over`,
and every action asserts the phase it is legal in.

## Testing

```bash
pnpm test          # engine unit tests (vitest)
pnpm typecheck     # all three packages
```

The engine suite covers rent maths for all three property types, even-build enforcement, mortgage
round-trips, auction resolution, trade validation, debt and bankruptcy transfer, the holding yard,
and seed determinism.

## Project layout

```
packages/
  shared/src/
    types.ts             domain types + socket event contracts
    rng.ts               seeded mulberry32, dice, shuffle
    data/board.ts        the 40 tiles
    data/cards.ts        the two decks
    engine/state.ts      game factory, settings, lobby mutations
    engine/selectors.ts  rent, net worth, build/mortgage legality
    engine/engine.ts     the reducer
  server/src/
    index.ts             express + socket.io wiring
    rooms.ts             room lifecycle, reconnect, timers
    bot.ts               heuristic bot policy
  client/src/
    net.ts               socket client + store
    lib.ts               formatting and board geometry
    components/          board, panels, modals
```

## License

MIT — see [LICENSE](LICENSE).
