import { ringLayout } from './layout.js';
import type { MapDefinition } from './types.js';

/**
 * "Poker Table" — cream card faces with gold edges laid on green baize, inside
 * a mahogany rail. The centre is the felt itself, with the betting line drawn
 * as an inset gold ellipse (see `.map-poker` in `styles/index.css`).
 *
 * The two card decks pick up the suit colours: Fortune is a red suit, Ledger a
 * black one. Only CSS gradients and unicode suit glyphs are used — no imagery
 * to license, and no tile name is drawn into the skin.
 */
export const POKER: MapDefinition = {
  id: 'poker',
  name: 'Poker Table',
  description: 'Green baize, a mahogany rail and gold-edged cards.',
  layout: ringLayout({ cornerFr: 1.5 }),
  vars: {
    '--board-face':
      'radial-gradient(120% 100% at 50% 35%, #1c7a4c 0%, #12613b 45%, #0a4227 100%)',
    '--board-frame': '#6b4423',
    '--board-gap': '4px',
    '--board-pad': '14px',
    '--board-radius': '30px',
    '--board-ring': '17px',
    '--tile-ink': '#1d1a14',
    '--tile-price-ink': '#7a6534',
    '--tile-radius': '6px',
    '--tile-border': '1.5px solid #c8a24a',
    '--centre-bg':
      'radial-gradient(120% 100% at 50% 35%, #1c7a4c 0%, #12613b 45%, #0a4227 100%)',
    '--centre-ink': '#f7f1e1',
    '--centre-muted': '#cbb98a',
  },
  wrapClass: 'map-poker',
  special: {
    start: { bg: '#146c43', glyph: '⬅', label: 'GO' },
    holding: { bg: '#3a2f2a', glyph: '⏸', label: 'HOLD' },
    plaza: { bg: '#8a6d1f', glyph: '★', label: 'PLAZA' },
    dispatch: { bg: '#8b1a1a', glyph: '⚑', label: 'GO TO HOLD' },
    fortune: { bg: '#a11d33', glyph: '♥' },
    ledger: { bg: '#23272b', glyph: '♠' },
    tax: { bg: '#5b4a1e', glyph: '⛃' },
  },
};
