# Marxopoly

A real-time, multiplayer property-trading board game for the browser. Create a table, share the
five-character code, and play with two to eight people — or fill the empty seats with bots.

Marxopoly is an original game with its own board, its own card decks and its own rules engine. It is
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
- **Report bankrupt** — give up at any time: your properties go back to the bank (no houses),
  your cash is wiped, and the game ends if you were the second-to-last player. You keep your
  seat and can watch the rest of the game — unlike *Leave table*, which drops you out entirely.
- **Reconnect** — your seat is held for two minutes; refreshing the tab drops you straight back in,
  and a second tab joins as a separate player instead of stealing your seat.
- **Watch a game in progress** — a table that has already started still shows in the list; joining it
  (or a folded player staying on) puts you in view-only mode with no board actions. Finished games
  drop off the list entirely.
- **Bright, readable board** — full-colour property headers, short board labels, large tokens with
  player initials, and an owner bar on each tile's outer edge.
- **Turn timers** — configurable, with sensible auto-resolution when they expire.
- **Bots** — heuristic opponents that buy, build, bid and answer trades.
- **Deterministic** — the whole game runs off one seed, so a game replays identically.

## Quick start

```bash
pnpm install
pnpm --filter @marxopoly/shared build   # the client and server consume its dist output
pnpm dev                              # server on :3001, client on :5173
```

Open http://localhost:5173, create a table, and open the same URL in a **second browser tab** (or
send the five-character code to a friend) to join.

Each tab is its own player. The seat token is kept in `sessionStorage`, which is per-tab, so
refreshing a tab keeps your seat while a new tab starts fresh and can join as somebody else. If a
second tab ever reclaims a seat, the older tab is told it was replaced rather than silently going
dead.

### Play with remote friends (ngrok)

```bash
pnpm share        # builds the client, starts the server, opens a public ngrok tunnel
```

On startup the terminal prints a banner with the local, LAN, and public URLs — send the
`https://…ngrok…` link to your friends and they can join straight from the browser (free ngrok
shows a one-click "visit site" warning first). Everything (page + WebSocket) goes through that one
tunnel, so no extra setup on the client.

One-time ngrok setup: create a free account, grab your token from
<https://dashboard.ngrok.com/get-started/your-authtoken>, and add it to `.env` in the repo root:

```
NGROK_AUTHTOKEN=<your token>
```

That env var is the only thing the bundled ngrok SDK reads — `ngrok config add-authtoken`
(the CLI config file) is **not** used. `.env` (not `.env.example`) is what the server loads.

`--share` / `SHARE=1` also turn the tunnel on for `pnpm dev`-style runs.

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
| `SHARE` | `0` | `1` opens an ngrok tunnel on startup (same as `pnpm share` / `--share`). |
| `NGROK_AUTHTOKEN` | – | ngrok token, if not already in the ngrok CLI config. |
| `NGROK_DOMAIN` | – | Optional reserved ngrok domain for a stable link. |

The client can point at a different backend with `VITE_SERVER_URL`.

Per-table house rules (starting cash, salary, auctions on/off, even build, double rent on full sets,
plaza pot, turn timer, max players) are set by the host in the lobby.

The host can also **Customise** the table from the lobby: rename any street/depot/works tile, and
view, delete or create Fortune / Ledger cards. New cards are built from a small form (deck, text,
and one of the nine effect types with its parameters) and validated on the server. Everything is
locked once the game starts; `packages/shared/src/data/cards.ts` and `board.ts` still hold the
defaults every game seeds from.

## The board

Forty tiles: twenty-two streets in eight colour groups, four depots, two works, two taxes, four
corners, and seven card tiles.

- **Streets** pay a base rent that doubles when one player holds the whole colour group unimproved,
  then follow a five-step ladder through four houses to a hotel.
- **Depots** pay 25 / 50 / 100 / 200 depending on how many of the four you hold.
- **Works** pay 4x or 10x the dice roll depending on whether you hold one or both.
- **Fortune** and **Ledger** are the two card decks (sixteen each by default; host-editable).
- The **Holding Yard** detains you: roll doubles, pay the fine, or spend a reprieve card. After
  three failed attempts you pay and move.

## Maps (board skins)

Every player picks a **map** for themselves from the dropdown in the lobby and the game header.
It is a purely visual choice — tile geometry, colours and the centre panel — stored in that
browser only and never sent to the server, so players at one table can each use a different map.
The shared tile data (names, prices, rent, cards) is the same for everyone regardless of map.

Bundled maps:

| Map | Look |
| --- | --- |
| **Standard** | The classic board: light tiles on a dark table. |
| **Cyber** | A four-shade LCD panel in the spirit of an old handheld: pixel edges, monospaced type, scanlines. |
| **Poker Table** | Cream, gold-edged cards on green baize inside a mahogany rail; the card decks take the suit colours. |
| **Pride** | Warm white board: spectrum frame, flag stripes on the four corners, a soft rainbow over the centre. |
| **Dummy** | A deliberately ugly test skin. |

Maps live in `packages/client/src/maps/`. To add one, drop a file that exports a `MapDefinition`
(`id`, `name`, a `layout` — usually `ringLayout(...)` — a set of CSS-variable overrides, and the
special-tile styles) and list it in the `MAPS` array in `index.ts`. `standard.ts` is a fully
spelled-out template; `dummy.ts` is a deliberately ugly test skin. A map that needs more than the
CSS variables can set `wrapClass` and add rules under that class in `styles/index.css`.

If a skin paints outside the board's border box — a bezel, a table rail, a glow — declare how far
in `--board-ring`. The board shrinks by that much so the ring stays inside the layout, and the
action bar's notch (measured from the board in `GameRoom.tsx`) is cut wide enough to clear it.

Every skin is drawn with CSS gradients and unicode glyphs only — no bundled images or fonts, so
there is nothing to license. Keep it that way, and never draw tile names into a skin: they are
host-editable at runtime and always come from the shared tile data.

## How the engine works

```ts
import { applyAction, createGame } from '@marxopoly/shared';

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
    lib.ts               formatting and board helpers
    maps/                board skins (layout + colours), one file per map
    components/          board, panels, modals
```

## License

MIT — see [LICENSE](LICENSE).
