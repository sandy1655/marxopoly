import { describe, expect, it } from 'vitest';
import { applyAction } from './engine.js';
import { addCard, createGame, makeCard, removeCard, renameTile } from './state.js';
import { getPlayer, netWorth, rentFor, tileLabel } from './selectors.js';
import { sanitizeCardInput } from '../data/cards.js';
import { rollDice } from '../rng.js';
import type { GameAction, GameState } from '../types.js';

const NOW = 1_700_000_000_000;

function newGame(overrides = {}): GameState {
  return createGame('test', [
    { id: 'a', name: 'Ada' },
    { id: 'b', name: 'Brix' },
    { id: 'c', name: 'Cleo' },
  ], { seed: 42, turnSeconds: 0, ...overrides });
}

function act(state: GameState, playerId: string, action: GameAction): GameState {
  const res = applyAction(state, { playerId, action, now: NOW });
  if (!res.ok) throw new Error(`action ${action.type} rejected: ${res.error}`);
  return res.state;
}

function expectReject(state: GameState, playerId: string, action: GameAction): string {
  const res = applyAction(state, { playerId, action, now: NOW });
  expect(res.ok).toBe(false);
  return res.ok ? '' : res.error;
}

/** Force a player onto a tile without going through the dice. */
function place(state: GameState, playerId: string, tileId: number): GameState {
  const next = structuredClone(state);
  getPlayer(next, playerId)!.position = tileId;
  return next;
}

/** Set the player up so their next `roll_dice` lands exactly on `tileId`. */
function primeRollTo(state: GameState, playerId: string, tileId: number): GameState {
  const next = structuredClone(state);
  const [d1, d2] = rollDice(next.rngState).value;
  const player = getPlayer(next, playerId)!;
  player.position = (((tileId - (d1 + d2)) % 40) + 40) % 40;
  next.turnSeat = player.seat;
  next.phase = 'pre_roll';
  next.hasRolled = false;
  next.doublesInARow = 0;
  return next;
}

describe('setup', () => {
  it('gives every player the starting cash and a seat', () => {
    const g = newGame();
    expect(g.players).toHaveLength(3);
    expect(g.players.every((p) => p.cash === 1500)).toBe(true);
    expect(g.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(g.phase).toBe('lobby');
  });

  it('only lets the host start, and only with two players', () => {
    const solo = createGame('solo', [{ id: 'a', name: 'Ada' }], { seed: 1 });
    expect(expectReject(solo, 'a', { type: 'start_game' })).toMatch(/two players/);
    const g = newGame();
    expect(expectReject(g, 'b', { type: 'start_game' })).toMatch(/host/);
    expect(act(g, 'a', { type: 'start_game' }).phase).toBe('pre_roll');
  });
});

describe('turn flow', () => {
  it('rolls, moves and offers the property', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g = act(g, 'a', { type: 'roll_dice' });
    expect(g.dice).not.toBeNull();
    const total = g.dice![0] + g.dice![1];
    expect(getPlayer(g, 'a')!.position).toBe(total);
  });

  it('refuses actions out of turn', () => {
    const g = act(newGame(), 'a', { type: 'start_game' });
    expect(expectReject(g, 'b', { type: 'roll_dice' })).toMatch(/not your turn/i);
  });

  it('passes the turn to the next seat', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g = act(g, 'a', { type: 'roll_dice' });
    if (g.phase === 'awaiting_buy') g = act(g, 'a', { type: 'decline_property' });
    // decline may open an auction; clear it
    while (g.phase === 'auction') {
      const bidder = g.auction!.activeIds[g.auction!.turnIndex]!;
      g = act(g, bidder, { type: 'pass_bid' });
    }
    if (g.phase === 'pre_roll') {
      // rolled doubles, roll again until the turn actually ends
      g = act(g, 'a', { type: 'roll_dice' });
      if (g.phase === 'awaiting_buy') g = act(g, 'a', { type: 'decline_property' });
      while (g.phase === 'auction') {
        const bidder = g.auction!.activeIds[g.auction!.turnIndex]!;
        g = act(g, bidder, { type: 'pass_bid' });
      }
    }
    if (g.phase === 'post_roll') {
      g = act(g, 'a', { type: 'end_turn' });
      expect(g.turnSeat).toBe(1);
    }
  });
});

describe('buying and rent', () => {
  it('buys a street and charges rent to the next visitor', () => {
    let g = act(newGame({ auctionsEnabled: false }), 'a', { type: 'start_game' });
    g = place(g, 'a', 1);
    g.phase = 'awaiting_buy';
    g = act(g, 'a', { type: 'buy_property' });
    expect(g.deeds[1]!.ownerId).toBe('a');
    expect(getPlayer(g, 'a')!.cash).toBe(1500 - 60);
    expect(rentFor(g, 1, 'b', 7)).toBe(2);
  });

  it('doubles base rent when one player holds the whole group', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g.deeds[3]!.ownerId = 'a';
    expect(rentFor(g, 1, 'b', 7)).toBe(4);
  });

  it('charges nothing on a mortgaged property', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g.deeds[1]!.mortgaged = true;
    expect(rentFor(g, 1, 'b', 7)).toBe(0);
  });

  it('scales depot tolls with the number of depots held', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[5]!.ownerId = 'a';
    expect(rentFor(g, 5, 'b', 7)).toBe(25);
    g.deeds[15]!.ownerId = 'a';
    expect(rentFor(g, 5, 'b', 7)).toBe(50);
    g.deeds[25]!.ownerId = 'a';
    g.deeds[35]!.ownerId = 'a';
    expect(rentFor(g, 5, 'b', 7)).toBe(200);
  });

  it('bills works off the dice total', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[12]!.ownerId = 'a';
    expect(rentFor(g, 12, 'b', 9)).toBe(36);
    g.deeds[28]!.ownerId = 'a';
    expect(rentFor(g, 12, 'b', 9)).toBe(90);
  });
});

describe('building', () => {
  it('requires the full group and builds evenly', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    expect(expectReject(g, 'a', { type: 'build', tileId: 1 })).toMatch(/whole colour group/);
    g.deeds[3]!.ownerId = 'a';
    g = act(g, 'a', { type: 'build', tileId: 1 });
    expect(g.deeds[1]!.houses).toBe(1);
    expect(expectReject(g, 'a', { type: 'build', tileId: 1 })).toMatch(/evenly/);
    g = act(g, 'a', { type: 'build', tileId: 3 });
    expect(getPlayer(g, 'a')!.cash).toBe(1500 - 100);
  });

  it('uses the improved rent ladder', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g.deeds[3]!.ownerId = 'a';
    g.deeds[1]!.houses = 3;
    expect(rentFor(g, 1, 'b', 7)).toBe(90);
    g.deeds[1]!.houses = 5;
    expect(rentFor(g, 1, 'b', 7)).toBe(250);
  });

  it('blocks mortgaging while the group has buildings', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g.deeds[3]!.ownerId = 'a';
    g.deeds[1]!.houses = 1;
    expect(expectReject(g, 'a', { type: 'mortgage', tileId: 3 })).toMatch(/buildings/);
  });

  it('refunds half on selling a building', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g.deeds[3]!.ownerId = 'a';
    g = act(g, 'a', { type: 'build', tileId: 1 });
    const before = getPlayer(g, 'a')!.cash;
    g = act(g, 'a', { type: 'sell_building', tileId: 1 });
    expect(getPlayer(g, 'a')!.cash).toBe(before + 25);
  });
});

describe('mortgages', () => {
  it('pays out half and costs 10% extra to lift', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[39]!.ownerId = 'a';
    g = act(g, 'a', { type: 'mortgage', tileId: 39 });
    expect(getPlayer(g, 'a')!.cash).toBe(1500 + 200);
    g = act(g, 'a', { type: 'unmortgage', tileId: 39 });
    expect(getPlayer(g, 'a')!.cash).toBe(1500 + 200 - 220);
    expect(g.deeds[39]!.mortgaged).toBe(false);
  });
});

describe('auctions', () => {
  it('awards the property to the last bidder standing', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g = place(g, 'a', 1);
    g.phase = 'awaiting_buy';
    g = act(g, 'a', { type: 'decline_property' });
    expect(g.phase).toBe('auction');
    g = act(g, 'a', { type: 'bid', amount: 30 });
    g = act(g, 'b', { type: 'bid', amount: 50 });
    g = act(g, 'c', { type: 'pass_bid' });
    g = act(g, 'a', { type: 'pass_bid' });
    expect(g.deeds[1]!.ownerId).toBe('b');
    expect(getPlayer(g, 'b')!.cash).toBe(1450);
    expect(g.phase).not.toBe('auction');
  });

  it('rejects a bid above the bidder’s cash and out-of-order bids', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g = place(g, 'a', 1);
    g.phase = 'awaiting_buy';
    g = act(g, 'a', { type: 'decline_property' });
    expect(expectReject(g, 'b', { type: 'bid', amount: 10 })).toMatch(/not your bid/);
    expect(expectReject(g, 'a', { type: 'bid', amount: 5000 })).toMatch(/more cash/);
  });

  it('leaves the property with the bank when nobody bids', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g = place(g, 'a', 1);
    g.phase = 'awaiting_buy';
    g = act(g, 'a', { type: 'decline_property' });
    g = act(g, 'a', { type: 'pass_bid' });
    g = act(g, 'b', { type: 'pass_bid' });
    g = act(g, 'c', { type: 'pass_bid' });
    expect(g.deeds[1]!.ownerId).toBeNull();
  });
});

describe('trading', () => {
  it('swaps cash and deeds on acceptance', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g.deeds[6]!.ownerId = 'b';
    g = act(g, 'a', {
      type: 'propose_trade',
      toId: 'b',
      give: { cash: 100, tileIds: [1], reprieveCards: 0 },
      receive: { cash: 0, tileIds: [6], reprieveCards: 0 },
    });
    expect(g.trades).toHaveLength(1);
    g = act(g, 'b', { type: 'accept_trade', tradeId: g.trades[0]!.id });
    expect(g.deeds[1]!.ownerId).toBe('b');
    expect(g.deeds[6]!.ownerId).toBe('a');
    expect(getPlayer(g, 'a')!.cash).toBe(1400);
    expect(getPlayer(g, 'b')!.cash).toBe(1600);
  });

  it('refuses to trade a property that carries buildings', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g.deeds[3]!.ownerId = 'a';
    g.deeds[1]!.houses = 2;
    expect(
      expectReject(g, 'a', {
        type: 'propose_trade',
        toId: 'b',
        give: { cash: 0, tileIds: [1], reprieveCards: 0 },
        receive: { cash: 10, tileIds: [], reprieveCards: 0 },
      }),
    ).toMatch(/buildings/i);
  });

  it('only lets the recipient accept', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g = act(g, 'a', {
      type: 'propose_trade',
      toId: 'b',
      give: { cash: 0, tileIds: [1], reprieveCards: 0 },
      receive: { cash: 50, tileIds: [], reprieveCards: 0 },
    });
    expect(expectReject(g, 'c', { type: 'accept_trade', tradeId: g.trades[0]!.id })).toMatch(/not addressed/);
  });

  it('charges the receiver 10% interest when a mortgaged deed changes hands', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[39]!.ownerId = 'a';
    g.deeds[39]!.mortgaged = true;
    const bBefore = getPlayer(g, 'b')!.cash;
    g = act(g, 'a', {
      type: 'propose_trade',
      toId: 'b',
      give: { cash: 0, tileIds: [39], reprieveCards: 0 },
      receive: { cash: 0, tileIds: [], reprieveCards: 0 },
    });
    g = act(g, 'b', { type: 'accept_trade', tradeId: g.trades[0]!.id });
    expect(g.deeds[39]!.ownerId).toBe('b');
    expect(g.deeds[39]!.mortgaged).toBe(true);
    // Bern price 400 -> mortgage value 200 -> 10% = 20.
    expect(getPlayer(g, 'b')!.cash).toBe(bBefore - 20);
  });

  it('refuses trades once the game is over', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g = act(g, 'a', {
      type: 'propose_trade',
      toId: 'b',
      give: { cash: 0, tileIds: [1], reprieveCards: 0 },
      receive: { cash: 50, tileIds: [], reprieveCards: 0 },
    });
    const tradeId = g.trades[0]!.id;
    g = act(g, 'b', { type: 'resign' });
    g = act(g, 'c', { type: 'resign' });
    expect(g.phase).toBe('game_over');
    expect(expectReject(g, 'b', { type: 'accept_trade', tradeId })).toMatch(/closed/i);
  });
});

describe('debt and bankruptcy', () => {
  it('opens a debt when rent exceeds cash', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[39]!.ownerId = 'b';
    g.deeds[37]!.ownerId = 'b';
    g.deeds[39]!.houses = 5; // hotel: 2000 rent
    getPlayer(g, 'a')!.cash = 50;
    g = place(g, 'a', 37);
    g.dice = [1, 1];
    g.hasRolled = true;
    g.phase = 'pre_roll';
    // land on 39 by walking two tiles
    const res = applyAction(g, { playerId: 'a', action: { type: 'roll_dice' }, now: NOW });
    expect(res.ok).toBe(true);

    // deterministic check of the debt path itself
    let k = act(newGame(), 'a', { type: 'start_game' });
    k.deeds[1]!.ownerId = 'a';
    getPlayer(k, 'a')!.cash = 50;
    k.debt = { debtorId: 'a', creditorId: 'b', amount: 2000, reason: 'rent' };
    k.phase = 'debt';
    expect(expectReject(k, 'a', { type: 'end_turn' })).toBeTruthy();
    const after = act(k, 'a', { type: 'declare_bankruptcy' });
    expect(getPlayer(after, 'a')!.bankrupt).toBe(true);
    expect(after.deeds[1]!.ownerId).toBe('b');
    expect(getPlayer(after, 'b')!.cash).toBe(1550);
  });

  it('settles a debt automatically once the debtor raises the cash', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[39]!.ownerId = 'a';
    getPlayer(g, 'a')!.cash = 0;
    g.debt = { debtorId: 'a', creditorId: 'b', amount: 150, reason: 'rent' };
    g.phase = 'debt';
    g = act(g, 'a', { type: 'mortgage', tileId: 39 });
    expect(g.debt).toBeNull();
    expect(getPlayer(g, 'a')!.cash).toBe(50);
    expect(getPlayer(g, 'b')!.cash).toBe(1650);
  });

  it('will not let a solvent debtor declare bankruptcy', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[39]!.ownerId = 'a';
    getPlayer(g, 'a')!.cash = 0;
    g.debt = { debtorId: 'a', creditorId: 'b', amount: 100, reason: 'rent' };
    g.phase = 'debt';
    expect(expectReject(g, 'a', { type: 'declare_bankruptcy' })).toMatch(/raise the money/);
  });

  it('ends the game when one player remains', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g = act(g, 'b', { type: 'resign' });
    g = act(g, 'c', { type: 'resign' });
    expect(g.phase).toBe('game_over');
    expect(g.winnerId).toBe('a');
  });

  it('reporting bankrupt forfeits everything and runs the same win check as leaving', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'b';
    g.deeds[3]!.ownerId = 'b';
    g.deeds[1]!.houses = 3;
    getPlayer(g, 'b')!.cash = 900;

    g = act(g, 'b', { type: 'resign', reason: 'bankrupt' });
    const b = getPlayer(g, 'b')!;
    expect(b.bankrupt).toBe(true);
    expect(b.cash).toBe(0);
    expect(g.deeds[1]!.ownerId).toBeNull();
    expect(g.deeds[1]!.houses).toBe(0);
    expect(g.deeds[3]!.ownerId).toBeNull();
    // still in the players list so they can spectate
    expect(g.players.some((p) => p.id === 'b')).toBe(true);

    g = act(g, 'c', { type: 'resign', reason: 'bankrupt' });
    expect(g.phase).toBe('game_over');
    expect(g.winnerId).toBe('a');
  });
});

describe('holding yard', () => {
  it('lets a player buy their way out', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    const p = getPlayer(g, 'a')!;
    p.inHolding = true;
    p.position = 10;
    g = act(g, 'a', { type: 'pay_holding_fine' });
    expect(getPlayer(g, 'a')!.inHolding).toBe(false);
    expect(getPlayer(g, 'a')!.cash).toBe(1450);
  });

  it('spends a reprieve card', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    const p = getPlayer(g, 'a')!;
    p.inHolding = true;
    p.reprieveCards = 1;
    g = act(g, 'a', { type: 'use_reprieve' });
    expect(getPlayer(g, 'a')!.inHolding).toBe(false);
    expect(getPlayer(g, 'a')!.reprieveCards).toBe(0);
  });
});

describe('determinism', () => {
  it('produces identical games from the same seed', () => {
    const run = () => {
      let g = act(createGame('d', [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ], { seed: 7, turnSeconds: 0 }), 'a', { type: 'start_game' });
      for (let i = 0; i < 12; i++) {
        const cur = g.players.find((p) => p.seat === g.turnSeat && !p.bankrupt);
        if (!cur || g.phase === 'game_over') break;
        if (g.phase === 'pre_roll') g = act(g, cur.id, { type: 'roll_dice' });
        else if (g.phase === 'awaiting_buy') g = act(g, cur.id, { type: 'buy_property' });
        else if (g.phase === 'auction') {
          const bidder = g.auction!.activeIds[g.auction!.turnIndex]!;
          g = act(g, bidder, { type: 'pass_bid' });
        } else if (g.phase === 'post_roll') g = act(g, cur.id, { type: 'end_turn' });
        else break;
      }
      return g;
    };
    const one = run();
    const two = run();
    expect(one.players.map((p) => [p.position, p.cash])).toEqual(
      two.players.map((p) => [p.position, p.cash]),
    );
  });
});

describe('host customisation', () => {
  it('renames a tile and clears it with an empty name', () => {
    let g = newGame();
    g = renameTile(g, 6, 'Tel Aviv');
    expect(tileLabel(g, 6)).toBe('Tel Aviv');
    g = renameTile(g, 6, '  ');
    expect(g.tileNames[6]).toBeUndefined();
  });

  it('rejects renames once the game has started', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g = renameTile(g, 6, 'Nope');
    expect(g.tileNames[6]).toBeUndefined();
  });

  it('adds and removes special cards, rebuilding the deck', () => {
    let g = newGame();
    const before = g.cards.filter((c) => c.deck === 'fortune').length;
    const input = sanitizeCardInput({ deck: 'fortune', text: 'Bonus round. Collect 500.', effect: { kind: 'cash', amount: 500 } });
    expect(typeof input).not.toBe('string');
    g = addCard(g, makeCard(input as Exclude<typeof input, string>, 'x1'));
    expect(g.cards.filter((c) => c.deck === 'fortune')).toHaveLength(before + 1);
    expect(g.fortuneDeck).toContain('x1');
    g = removeCard(g, 'x1');
    expect(g.cards.some((c) => c.id === 'x1')).toBe(false);
    expect(g.fortuneDeck).not.toContain('x1');
  });

  it('validates card input', () => {
    expect(sanitizeCardInput({ deck: 'fortune', text: '', effect: { kind: 'cash', amount: 1 } })).toMatch(/text/i);
    expect(sanitizeCardInput({ deck: 'x', text: 'hi', effect: { kind: 'cash', amount: 1 } })).toMatch(/deck/i);
    expect(sanitizeCardInput({ deck: 'ledger', text: 'go', effect: { kind: 'move_to', tile: 99 } })).toMatch(/tile/i);
    expect(sanitizeCardInput({ deck: 'ledger', text: 'ok', effect: { kind: 'reprieve' } })).toMatchObject({ deck: 'ledger' });
  });
});

describe('net worth', () => {
  it('counts cash, deeds and buildings', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g.deeds[1]!.ownerId = 'a';
    g.deeds[3]!.ownerId = 'a';
    g.deeds[1]!.houses = 2;
    expect(netWorth(g, 'a')).toBe(1500 + 60 + 60 + 100);
  });
});

describe('end-of-game stats', () => {
  it('seeds a net-worth snapshot at the start and captures the finish', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    expect(g.stats.netWorthHistory).toHaveLength(1);
    expect(g.stats.netWorthHistory[0]!.worth.a).toBe(1500);

    g = act(g, 'b', { type: 'resign' });
    g = act(g, 'c', { type: 'resign' });
    expect(g.phase).toBe('game_over');
    const last = g.stats.netWorthHistory.at(-1)!;
    expect(last.worth.a).toBeGreaterThan(0);
    expect(last.worth.b).toBe(0);
  });

  it('counts holding-yard visits', () => {
    let g = act(newGame(), 'a', { type: 'start_game' });
    g = primeRollTo(g, 'a', 30); // Dispatch -> holding yard
    g = act(g, 'a', { type: 'roll_dice' });
    expect(getPlayer(g, 'a')!.inHolding).toBe(true);
    expect(g.stats.holdingVisits.a).toBe(1);
  });

  it('tracks how much each player swept from the plaza', () => {
    let g = act(newGame({ plazaPot: true }), 'a', { type: 'start_game' });
    g.plazaPot = 300;
    g = primeRollTo(g, 'a', 20); // Plaza
    g = act(g, 'a', { type: 'roll_dice' });
    expect(g.stats.plazaTake.a).toBe(300);
    expect(g.plazaPot).toBe(0);
  });
});

describe('SonToes easter egg', () => {
  function sonToesGame(): GameState {
    const g = createGame('sontoes', [
      { id: 'a', name: 'SonToes' },
      { id: 'b', name: 'Brix' },
    ], { seed: 7, turnSeconds: 0, auctionsEnabled: false });
    return act(g, 'a', { type: 'start_game' });
  }

  interface Turn {
    from: number;
    to: number;
    dice: [number, number];
  }

  /** Take `turns` solo turns for 'a', recording each move. */
  function walk(start: GameState, turns: number): { history: Turn[]; end: GameState } {
    let g = start;
    const history: Turn[] = [];
    for (let i = 0; i < turns; i++) {
      g = structuredClone(g);
      const p = getPlayer(g, 'a')!;
      g.turnSeat = p.seat;
      g.phase = 'pre_roll';
      g.hasRolled = false;
      g.dice = null;
      g.doublesInARow = 0;
      p.inHolding = false;
      const from = p.position;
      g = act(g, 'a', { type: 'roll_dice' });
      if (g.phase === 'awaiting_buy') g = act(g, 'a', { type: 'decline_property' });
      history.push({ from, to: getPlayer(g, 'a')!.position, dice: g.dice as [number, number] });
    }
    return { history, end: g };
  }

  it('rigs the dice so SonToes lands on Zuerich then Bern before finishing lap one', () => {
    const { history, end } = walk(sonToesGame(), 10);
    const stops = history.map((t) => t.to);
    const zuerich = stops.indexOf(37);
    const bern = stops.indexOf(39);
    expect(zuerich).toBeGreaterThanOrEqual(0);
    expect(bern).toBe(zuerich + 1);
    // Nothing before Zuerich wraps past Start.
    expect(stops.slice(0, zuerich).every((pos) => pos < 37)).toBe(true);
    expect(getPlayer(end, 'a')!.sonToesLap).toBe(2);

    // The pips shown must add up to the distance actually travelled — no jump.
    for (const t of history) {
      const [d1, d2] = t.dice;
      expect(d1).toBeGreaterThanOrEqual(1);
      expect(d2).toBeLessThanOrEqual(6);
      const travelled = ((t.to - t.from) % 40 + 40) % 40;
      expect(d1 + d2).toBe(travelled);
    }
  });

  it('leaves everyone else on ordinary dice', () => {
    expect(getPlayer(sonToesGame(), 'b')!.sonToesLap).toBeUndefined();
  });
});
