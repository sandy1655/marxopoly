import { ringLayout } from './layout.js';
import type { MapDefinition } from './types.js';

/**
 * The original Marxopoly look: a light board on a dark table, wide corner
 * tiles, soft rounded tiles. These values mirror the defaults in `index.css`,
 * spelled out here so the map reads as a complete, copyable template.
 */
export const STANDARD: MapDefinition = {
  id: 'standard',
  name: 'Standard',
  description: 'The classic Marxopoly board.',
  layout: ringLayout({ cornerFr: 1.5 }),
  vars: {
    '--board-face': '#ffffff',
    '--board-frame': '#b9c8de',
    '--board-gap': '3px',
    '--board-pad': '10px',
    '--board-radius': '18px',
    '--tile-ink': '#16202f',
    '--tile-price-ink': '#475569',
    '--tile-radius': '7px',
    '--tile-border': '1.5px solid var(--line-strong)',
    '--centre-bg': 'linear-gradient(150deg, #f8fbff, #eef4ff)',
    '--centre-ink': '#16202f',
    '--centre-muted': '#64748b',
  },
  special: {
    start: { bg: '#22c55e', glyph: '⬅', label: 'GO' },
    holding: { bg: '#f59e0b', glyph: '⏸', label: 'HOLD' },
    plaza: { bg: '#38bdf8', glyph: '★', label: 'PLAZA' },
    dispatch: { bg: '#ef4444', glyph: '⚑', label: 'GO TO HOLD' },
    fortune: { bg: '#fde68a', glyph: '?' },
    ledger: { bg: '#bfdbfe', glyph: '✎' },
    tax: { bg: '#e2e8f0', glyph: '⛃' },
  },
};
