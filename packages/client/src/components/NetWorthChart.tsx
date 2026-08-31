import type { NetWorthSnapshot, Player } from '@marxopoly/shared';
import { compactMoney, money } from '../lib.js';

interface Props {
  history: NetWorthSnapshot[];
  players: Player[];
}

const W = 520;
const H = 220;
const PAD = { top: 10, right: 12, bottom: 22, left: 46 };

export default function NetWorthChart({ history, players }: Props) {
  if (history.length < 2) {
    return <p className="muted small">Not enough turns played for a chart.</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = history.length;

  let max = 1;
  for (const snap of history) {
    for (const p of players) max = Math.max(max, snap.worth[p.id] ?? 0);
  }
  max = niceCeil(max);

  const x = (i: number) => PAD.left + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, k) => (max / ticks) * k);
  const xLabelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <div className="nw-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Each player's net worth over the game">
        {yTicks.map((v) => (
          <g key={v}>
            <line className="nw-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="nw-axis" x={PAD.left - 6} y={y(v) + 3} textAnchor="end">
              {compactMoney(v)}
            </text>
          </g>
        ))}

        {history.map((snap, i) =>
          i % xLabelEvery === 0 || i === n - 1 ? (
            <text key={snap.turn} className="nw-axis" x={x(i)} y={H - 7} textAnchor="middle">
              {snap.turn}
            </text>
          ) : null,
        )}

        {players.map((p) => (
          <polyline
            key={p.id}
            className="nw-line"
            style={{ stroke: p.color }}
            points={history.map((snap, i) => `${x(i)},${y(snap.worth[p.id] ?? 0)}`).join(' ')}
          />
        ))}
      </svg>

      <div className="nw-legend">
        {players.map((p) => (
          <span key={p.id} className="nw-legend-item">
            <span className="nw-swatch" style={{ background: p.color }} />
            {p.name}
            <span className="muted"> · {money(history[n - 1]!.worth[p.id] ?? 0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Round a max value up to a clean 1/2/5 × 10ⁿ boundary for the axis. */
function niceCeil(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(v));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}
