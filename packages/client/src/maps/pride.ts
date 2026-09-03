import { ringLayout } from './layout.js';
import type { MapDefinition } from './types.js';

/**
 * "Pride" — a calm, warm-white board that carries the rainbow lightly: a soft
 * spectrum glow around the frame, a faint arc across the centre panel and
 * muted flag colours on the special tiles (see `.map-pride` in
 * `styles/index.css`). Deliberately restrained — accents, not confetti.
 *
 * Drawn entirely with CSS gradients plus one unicode flag glyph, so there is
 * nothing to license, and no tile name is part of the artwork.
 */
export const PRIDE: MapDefinition = {
  id: 'pride',
  name: 'Pride',
  description: 'Warm white board with a soft rainbow frame and muted flag colours.',
  layout: ringLayout({ cornerFr: 1.5 }),
  vars: {
    '--board-face': '#fffdf9',
    '--board-frame': 'transparent',
    '--board-gap': '3px',
    '--board-pad': '11px',
    '--board-radius': '20px',
    '--board-ring': '8px',
    '--tile-ink': '#2c2733',
    '--tile-price-ink': '#6d6478',
    '--tile-radius': '8px',
    '--tile-border': '1.5px solid #e8dced',
    '--centre-bg': 'linear-gradient(160deg, #fffaf4, #fdf6fb)',
    '--centre-ink': '#2c2733',
    '--centre-muted': '#7c7288',
  },
  wrapClass: 'map-pride',
  special: {
    start: { bg: '#77b58a', glyph: '⬅', label: 'GO' },
    holding: { bg: '#efa863', glyph: '⏸', label: 'HOLD' },
    plaza: { bg: '#6a9ad0', glyph: '🏳️‍🌈', label: 'PLAZA' },
    dispatch: { bg: '#e07a6f', glyph: '⚑', label: 'GO TO HOLD' },
    fortune: { bg: '#efd06a', glyph: '?' },
    ledger: { bg: '#a98cc8', glyph: '✎' },
    tax: { bg: '#e5dcea', glyph: '⛃' },
  },
};
