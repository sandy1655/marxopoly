import { tileIdByName } from './board.js';
import type { Card, CardEffect } from '../types.js';

/**
 * The two card decks — Fortune and Ledger.
 *
 * WHAT A CARD IS
 *   text   – the sentence the player reads when the card is drawn.
 *   effect – what the game actually does. Built from the small helpers below,
 *            so every card reads like a sentence too.
 *
 * TO ADD OR CHANGE A CARD
 *   Edit the FORTUNE_CARDS / LEDGER_CARDS lists at the bottom. Each row is:
 *
 *       card('<id>', '<player-facing text>', <effect>)
 *
 *   Keep ids unique and in the `f##` / `l##` style. The decks may hold any
 *   number of cards (they reshuffle from these lists when a pile runs out).
 *
 * REFERRING TO A STREET
 *   advanceTo() takes the tile's name exactly as it appears on the board, e.g.
 *   advanceTo('Tel Aviv'). Or use one of the aliases below — add a line there
 *   for any new street a card should send players to. Either way a name that is
 *   not on the board throws at startup, so cards never drift out of sync with
 *   data/board.ts.
 */

// ---------------------------------------------------------------------------
// Effect helpers — one per kind of thing a card can do. Money is in game cash.
// ---------------------------------------------------------------------------

/** Receive `amount` from the bank. */
const collect = (amount: number): CardEffect => ({ kind: 'cash', amount });

/** Pay `amount` to the bank. */
const pay = (amount: number): CardEffect => ({ kind: 'cash', amount: -amount });

/** Every other player pays you `amount`. */
const collectFromEveryone = (amount: number): CardEffect => ({ kind: 'collect_each', amount });

/** You pay every other player `amount`. */
const payEveryone = (amount: number): CardEffect => ({ kind: 'pay_each', amount });

/** Jump straight to a tile, named as it appears on the board ('Tel Aviv') or by
 *  index. You still draw salary if you pass Start unless `collectStart: false`
 *  is passed (a "go to jail" style move). An unknown name throws at load. */
const advanceTo = (
  tile: string | number,
  opts: { collectStart?: boolean } = {},
): CardEffect => ({
  kind: 'move_to',
  tile: typeof tile === 'number' ? tile : tileIdByName(tile),
  collectStart: opts.collectStart ?? true,
});

/** Step forward (positive) or back (negative) along the board. */
const moveBy = (steps: number): CardEffect => ({ kind: 'move_by', steps });

/** Advance to the next depot/works and pay the owner `multiplier`× the usual toll. */
const advanceToNearest = (target: 'depot' | 'works', multiplier: number): CardEffect => ({
  kind: 'advance_nearest',
  target,
  multiplier,
});

/** Go to the holding yard immediately, without collecting salary. */
const goToHoldingYard = (): CardEffect => ({ kind: 'goto_holding' });

/** A keep-until-needed card that buys the holder out of the holding yard later. */
const reprieveCard = (): CardEffect => ({ kind: 'reprieve' });

/** Pay a repair bill scaled by what you have built. */
const repairBill = (perHouse: number, perHotel: number): CardEffect => ({
  kind: 'assessment',
  perHouse,
  perHotel,
});

// ---------------------------------------------------------------------------
// Street aliases — looked up in data/board.ts by name, so a card and the board
// can never disagree. Add a line for any new street a card points at (or pass
// the name straight to advanceTo, e.g. advanceTo('Tel Aviv')). A name that is
// not on the board throws the moment the game loads.
// ---------------------------------------------------------------------------

const START = tileIdByName('Start');
const TEL_AVIV = tileIdByName('Tel Aviv');

// ---------------------------------------------------------------------------
// Deck assembly
// ---------------------------------------------------------------------------

interface CardRow {
  id: string;
  text: string;
  effect: CardEffect;
}

const card = (id: string, text: string, effect: CardEffect): CardRow => ({ id, text, effect });

const buildDeck = (deck: 'fortune' | 'ledger', rows: CardRow[]): readonly Card[] =>
  rows.map((row) => ({ ...row, deck }));

// ---------------------------------------------------------------------------
// The cards
// ---------------------------------------------------------------------------

export const FORTUNE_CARDS: readonly Card[] = buildDeck('fortune', [
  card('f01', 'The district awards you a civic grant. Collect 150.',                         collect(150)),
  card('f02', 'Return to Start and draw your salary.',                                       advanceTo(START)),
  card('f06', 'Roadworks reroute you three tiles back.',                                     moveBy(-3)),
  card('f08', 'Building inspection. Pay 25 per house and 100 per hotel you own.',            repairBill(25, 100)),
  card('f09', 'You win the district raffle. Every other player pays you 50.',               collectFromEveryone(50)),
  card('f10', 'Your bond matures. Collect 100.',                                            collect(100)),
  card('f11', 'Legal fees on a boundary claim. Pay 75.',                                    pay(75)),
  card('f14', 'A reprieve is granted. Keep this card until you need it.',                    reprieveCard()),
  card('f15', 'You host the district gala. Pay every other player 40.',                      payEveryone(40)),
  card('f16', 'Dividend from your holdings. Collect 60.',                                    collect(60)),
  card('f17', 'Netanyahu needs Money. Donate 80.',                                          pay(80)),
  card('f18', 'You mobilize the IDF to steal 50 from everyone.',                             collectFromEveryone(50)),
  card('f19', 'You have been summoned by the big Yahu. You travel to Tel Aviv.',             advanceTo(TEL_AVIV)),
]);

export const LEDGER_CARDS: readonly Card[] = buildDeck('ledger', [
  card('l01', 'The quarterly audit closes in your favour. Collect 200.',                     collect(200)),
  card('l02', 'Return to Start and draw your salary.',                                       advanceTo(START)),
  card('l03', 'Clinic levy. Pay 100.',                                                       pay(100)),
  card('l04', 'Your insurance premium is refunded. Collect 45.',                             collect(45)),
  card('l05', 'A distant relation leaves you a small estate. Collect 250.',                  collect(250)),
  card('l06', 'A clearing error resolves your way. Collect 175.',                            collect(175)),
  card('l07', 'Report to the holding yard. Do not pass Start.',                              goToHoldingYard()),
  card('l08', 'Street repairs are assessed. Pay 40 per house and 115 per hotel.',            repairBill(40, 115)),
  card('l09', 'It is your founding day. Collect 20 from every other player.',                collectFromEveryone(20)),
  card('l10', 'A consultancy fee lands. Collect 25.',                                        collect(25)),
  card('l11', 'School tax assessment. Pay 150.',                                             pay(150)),
  card('l12', 'A reprieve is granted. Keep this card until you need it.',                    reprieveCard()),
  card('l13', 'You clear out surplus stock. Collect 50.',                                    collect(50)),
  card('l14', 'A late delivery fine catches up with you. Pay 50.',                           pay(50)),
  card('l15', 'Advance to Tel Aviv. If you pass Start, draw your salary.',                    advanceTo(TEL_AVIV)),
  card('l16', 'Go back three tiles.',                                                        moveBy(-3)),
]);

export const ALL_CARDS: readonly Card[] = [...FORTUNE_CARDS, ...LEDGER_CARDS];

// Fail fast on a copy-paste slip rather than silently dropping a card.
assertUniqueIds(ALL_CARDS);

function assertUniqueIds(cards: readonly Card[]): void {
  const seen = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.id)) throw new Error(`cards.ts: duplicate card id "${c.id}" — ids must be unique`);
    seen.add(c.id);
  }
}

const CARD_INDEX = new Map(ALL_CARDS.map((c) => [c.id, c]));

export function cardById(id: string): Card {
  const found = CARD_INDEX.get(id);
  if (!found) throw new Error(`Unknown card ${id}`);
  return found;
}
