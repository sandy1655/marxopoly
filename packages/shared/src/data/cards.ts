import type { Card } from '../types.js';

/**
 * Two decks of 16. All copy is original to Rentier; the effects are the
 * classic set of movement, cash and assessment outcomes.
 */

export const FORTUNE_CARDS: readonly Card[] = [
  { id: 'f01', deck: 'fortune', text: 'The district awards you a civic grant. Collect 150.', effect: { kind: 'cash', amount: 150 } },
  { id: 'f02', deck: 'fortune', text: 'Return to Start and draw your salary.', effect: { kind: 'move_to', tile: 0, collectStart: true } },
  { id: 'f03', deck: 'fortune', text: 'A surveying error works in your favour. Advance to Vanguard Boulevard.', effect: { kind: 'move_to', tile: 39, collectStart: true } },
  { id: 'f04', deck: 'fortune', text: 'Take the express line to the nearest depot and pay the owner double the usual toll.', effect: { kind: 'advance_nearest', target: 'depot', multiplier: 2 } },
  { id: 'f05', deck: 'fortune', text: 'An inspector walks you to the nearest works. If it is owned, pay ten times your roll.', effect: { kind: 'advance_nearest', target: 'works', multiplier: 10 } },
  { id: 'f06', deck: 'fortune', text: 'Roadworks reroute you three tiles back.', effect: { kind: 'move_by', steps: -3 } },
  { id: 'f07', deck: 'fortune', text: 'A zoning dispute goes badly. Report to the holding yard.', effect: { kind: 'goto_holding' } },
  { id: 'f08', deck: 'fortune', text: 'Building inspection. Pay 25 per house and 100 per hotel you own.', effect: { kind: 'assessment', perHouse: 25, perHotel: 100 } },
  { id: 'f09', deck: 'fortune', text: 'You win the district raffle. Every other player pays you 50.', effect: { kind: 'collect_each', amount: 50 } },
  { id: 'f10', deck: 'fortune', text: 'Your bond matures. Collect 100.', effect: { kind: 'cash', amount: 100 } },
  { id: 'f11', deck: 'fortune', text: 'Legal fees on a boundary claim. Pay 75.', effect: { kind: 'cash', amount: -75 } },
  { id: 'f12', deck: 'fortune', text: 'Advance to Kingfisher Close.', effect: { kind: 'move_to', tile: 19, collectStart: true } },
  { id: 'f13', deck: 'fortune', text: 'Advance to Hawthorn Hill. If you pass Start, draw your salary.', effect: { kind: 'move_to', tile: 14, collectStart: true } },
  { id: 'f14', deck: 'fortune', text: 'A reprieve is granted. Keep this card until you need it.', effect: { kind: 'reprieve' } },
  { id: 'f15', deck: 'fortune', text: 'You host the district gala. Pay every other player 40.', effect: { kind: 'pay_each', amount: 40 } },
  { id: 'f16', deck: 'fortune', text: 'Dividend from your holdings. Collect 60.', effect: { kind: 'cash', amount: 60 } },
];

export const LEDGER_CARDS: readonly Card[] = [
  { id: 'l01', deck: 'ledger', text: 'The quarterly audit closes in your favour. Collect 200.', effect: { kind: 'cash', amount: 200 } },
  { id: 'l02', deck: 'ledger', text: 'Return to Start and draw your salary.', effect: { kind: 'move_to', tile: 0, collectStart: true } },
  { id: 'l03', deck: 'ledger', text: 'Clinic levy. Pay 100.', effect: { kind: 'cash', amount: -100 } },
  { id: 'l04', deck: 'ledger', text: 'Your insurance premium is refunded. Collect 45.', effect: { kind: 'cash', amount: 45 } },
  { id: 'l05', deck: 'ledger', text: 'A distant relation leaves you a small estate. Collect 250.', effect: { kind: 'cash', amount: 250 } },
  { id: 'l06', deck: 'ledger', text: 'A clearing error resolves your way. Collect 175.', effect: { kind: 'cash', amount: 175 } },
  { id: 'l07', deck: 'ledger', text: 'Report to the holding yard. Do not pass Start.', effect: { kind: 'goto_holding' } },
  { id: 'l08', deck: 'ledger', text: 'Street repairs are assessed. Pay 40 per house and 115 per hotel.', effect: { kind: 'assessment', perHouse: 40, perHotel: 115 } },
  { id: 'l09', deck: 'ledger', text: 'It is your founding day. Collect 20 from every other player.', effect: { kind: 'collect_each', amount: 20 } },
  { id: 'l10', deck: 'ledger', text: 'A consultancy fee lands. Collect 25.', effect: { kind: 'cash', amount: 25 } },
  { id: 'l11', deck: 'ledger', text: 'School tax assessment. Pay 150.', effect: { kind: 'cash', amount: -150 } },
  { id: 'l12', deck: 'ledger', text: 'A reprieve is granted. Keep this card until you need it.', effect: { kind: 'reprieve' } },
  { id: 'l13', deck: 'ledger', text: 'You clear out surplus stock. Collect 50.', effect: { kind: 'cash', amount: 50 } },
  { id: 'l14', deck: 'ledger', text: 'A late delivery fine catches up with you. Pay 50.', effect: { kind: 'cash', amount: -50 } },
  { id: 'l15', deck: 'ledger', text: 'Advance to Cedar Street. If you pass Start, draw your salary.', effect: { kind: 'move_to', tile: 6, collectStart: true } },
  { id: 'l16', deck: 'ledger', text: 'Go back three tiles.', effect: { kind: 'move_by', steps: -3 } },
];

export const ALL_CARDS: readonly Card[] = [...FORTUNE_CARDS, ...LEDGER_CARDS];

const CARD_INDEX = new Map(ALL_CARDS.map((c) => [c.id, c]));

export function cardById(id: string): Card {
  const card = CARD_INDEX.get(id);
  if (!card) throw new Error(`Unknown card ${id}`);
  return card;
}
