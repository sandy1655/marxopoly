interface Props {
  dice: [number, number] | null;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

function Die({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 100 100" className="die" aria-label={`die showing ${value}`}>
      <rect x="4" y="4" width="92" height="92" rx="18" />
      {(PIPS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" className="pip" />
      ))}
    </svg>
  );
}

export default function Dice({ dice }: Props) {
  if (!dice) return <div className="dice empty">—</div>;
  return (
    <div className="dice">
      <Die value={dice[0]} />
      <Die value={dice[1]} />
    </div>
  );
}
