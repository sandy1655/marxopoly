import { ringLayout } from './layout.js';
import type { MapDefinition } from './types.js';

/**
 * A deliberately ugly test skin. It exists to prove the map system works —
 * equal-sized tracks, hard edges, loud colours, monospace text. Not meant
 * to look good.
 */
export const DUMMY: MapDefinition = {
  id: 'dummy',
  name: 'Dummy',
  description: 'A plain test board — not pretty on purpose.',
  layout: ringLayout({ cornerFr: 1 }),
  vars: {
    '--board-face': '#1e1e1e',
    '--board-frame': '#ff00ff',
    '--board-gap': '5px',
    '--board-pad': '5px',
    '--board-radius': '0px',
    '--tile-ink': '#00ff00',
    '--tile-price-ink': '#ffd000',
    '--tile-radius': '0px',
    '--tile-border': '2px dashed #ff00ff',
    '--centre-bg':
      'repeating-linear-gradient(45deg, #ff00ff 0 14px, #00ffff 14px 28px)',
    '--centre-ink': '#000000',
    '--centre-muted': '#222222',
  },
  wrapClass: 'map-dummy',
  special: {
    start: { bg: '#00ff00', glyph: '<', label: 'GO' },
    holding: { bg: '#ff8800', glyph: 'X', label: 'HOLD' },
    plaza: { bg: '#00ffff', glyph: '*', label: 'PLAZA' },
    dispatch: { bg: '#ff0000', glyph: '!', label: 'GO TO HOLD' },
    fortune: { bg: '#ffff00', glyph: '?' },
    ledger: { bg: '#00aaff', glyph: '#' },
    tax: { bg: '#cccccc', glyph: '$' },
  },
};
