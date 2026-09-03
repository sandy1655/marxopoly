import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@marxopoly/shared';
import { playerIcon } from '../lib.js';
import { tokenSpot, type BoardLayout } from '../maps/index.js';

interface Props {
  state: GameState;
  layout: BoardLayout;
}

const RING = 40;
const STEP_MS = 90;
/** Keep in sync with the dice tumble in Dice.tsx (ROLL_MS) plus a beat to let it settle. */
const ROLL_SETTLE_MS = 720;

/**
 * Player pieces drawn on a layer over the board so they can walk tile by tile
 * when a player's position changes, instead of jumping. A move that follows a
 * dice roll waits for the dice animation to finish before the piece sets off.
 */
export default function TokenLayer({ state, layout }: Props) {
  const active = state.players.filter((p) => !p.bankrupt);
  const turnPlayerId = state.players.find((p) => p.seat === state.turnSeat)?.id;

  // The tile each piece is currently drawn on (lags the real position while walking).
  const [shown, setShown] = useState<Record<string, number>>(() =>
    Object.fromEntries(active.map((p) => [p.id, p.position])),
  );
  // Pieces that are actually mid-walk (not merely waiting on the dice animation).
  const [walkingIds, setWalkingIds] = useState<Record<string, true>>({});
  const timers = useRef<Record<string, number>>({});
  const starts = useRef<Record<string, number>>({});
  const lastDice = useRef<string>(state.dice ? state.dice.join(',') : '');

  const targetKey = state.players.map((p) => `${p.id}:${p.position}:${p.bankrupt}`).join('|');

  useEffect(() => {
    const diceKey = state.dice ? state.dice.join(',') : '';
    const rolledNow = diceKey !== '' && diceKey !== lastDice.current;
    lastDice.current = diceKey;
    const startDelay = rolledNow ? ROLL_SETTLE_MS : 0;

    for (const p of state.players) {
      const from = shown[p.id];
      if (from === undefined) {
        setShown((m) => ({ ...m, [p.id]: p.position }));
        continue;
      }
      if (from === p.position) {
        if (timers.current[p.id]) {
          window.clearInterval(timers.current[p.id]);
          delete timers.current[p.id];
        }
        if (starts.current[p.id]) {
          window.clearTimeout(starts.current[p.id]);
          delete starts.current[p.id];
        }
        continue;
      }

      const forward = (p.position - from + RING) % RING;
      const dir = forward === 0 ? 0 : forward <= RING / 2 ? 1 : -1;

      // Restart the walk so a fresh target/direction wins if the piece was
      // still mid-move (e.g. a second roll after doubles).
      if (timers.current[p.id]) window.clearInterval(timers.current[p.id]);
      if (starts.current[p.id]) window.clearTimeout(starts.current[p.id]);

      const begin = () => {
        delete starts.current[p.id];
        setWalkingIds((w) => ({ ...w, [p.id]: true }));
        timers.current[p.id] = window.setInterval(() => {
          setShown((m) => {
            const cur = m[p.id];
            if (cur === undefined || cur === p.position) {
              window.clearInterval(timers.current[p.id]);
              delete timers.current[p.id];
              setWalkingIds((w) => {
                if (!w[p.id]) return w;
                const rest = { ...w };
                delete rest[p.id];
                return rest;
              });
              return m;
            }
            return { ...m, [p.id]: (cur + dir + RING) % RING };
          });
        }, STEP_MS);
      };

      if (startDelay > 0) starts.current[p.id] = window.setTimeout(begin, startDelay);
      else begin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  useEffect(
    () => () => {
      for (const id of Object.keys(timers.current)) window.clearInterval(timers.current[id]);
      for (const id of Object.keys(starts.current)) window.clearTimeout(starts.current[id]);
      timers.current = {};
      starts.current = {};
    },
    [],
  );

  // Fan out pieces that share a tile so they do not overlap.
  const stack: Record<number, string[]> = {};
  for (const p of active) {
    const tile = shown[p.id] ?? p.position;
    (stack[tile] ??= []).push(p.id);
  }

  return (
    <div className="token-layer" aria-hidden="true">
      {active.map((p) => {
        const tile = shown[p.id] ?? p.position;
        const { x, y } = tokenSpot(layout, tile);
        const group = stack[tile] ?? [p.id];
        const offset = (group.indexOf(p.id) - (group.length - 1) / 2) * 14;
        const walking = !!walkingIds[p.id];
        return (
          <span
            key={p.id}
            className={`board-token${turnPlayerId === p.id ? ' active' : ''}${walking ? ' moving' : ''}`}
            style={{ left: `calc(${x}% + ${offset}px)`, top: `${y}%`, background: p.color }}
            title={p.name}
          >
            {playerIcon(p)}
          </span>
        );
      })}
    </div>
  );
}
