import { useEffect, useRef, useState } from 'react';

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

const ROLL_MS = 640;
const rnd = () => 1 + Math.floor(Math.random() * 6);

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`die${rolling ? ' rolling' : ''}`} aria-label={`die showing ${value}`}>
      <rect x="4" y="4" width="92" height="92" rx="18" />
      {(PIPS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" className="pip" />
      ))}
    </svg>
  );
}

export default function Dice({ dice }: Props) {
  const [display, setDisplay] = useState<[number, number] | null>(dice);
  const [rolling, setRolling] = useState(false);
  const lastRoll = useRef(dice ? dice.join(',') : '');

  useEffect(() => {
    if (!dice) {
      lastRoll.current = '';
      setRolling(false);
      setDisplay(null);
      return;
    }
    const key = dice.join(',');
    if (key === lastRoll.current) {
      setDisplay(dice);
      return;
    }
    lastRoll.current = key;
    setRolling(true);

    const spin = window.setInterval(() => setDisplay([rnd(), rnd()]), 80);
    const settle = window.setTimeout(() => {
      window.clearInterval(spin);
      setDisplay(dice);
      setRolling(false);
    }, ROLL_MS);

    return () => {
      window.clearInterval(spin);
      window.clearTimeout(settle);
    };
  }, [dice]);

  if (!display) return <div className="dice empty">🎲</div>;

  return (
    <div className={`dice${rolling ? ' rolling' : ''}`}>
      <Die value={display[0]} rolling={rolling} />
      <Die value={display[1]} rolling={rolling} />
    </div>
  );
}
