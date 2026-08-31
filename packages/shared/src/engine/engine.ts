import {
  BOARD_SIZE,
  GROUP_TILES,
  HOLDING_TILE,
  tileAt,
} from '../data/board.js';
import { rollDice, shuffle } from '../rng.js';
import type {
  ActionEnvelope,
  ApplyResult,
  Card,
  GameAction,
  GameState,
  LogEntry,
  Player,
  TradeOffer,
  TradeSide,
} from '../types.js';
import { isOwnable } from '../types.js';
import {
  activePlayers,
  canBuild,
  canMortgage,
  canSellBuilding,
  currentPlayer,
  getPlayer,
  groupOf,
  liquidValue,
  mortgageValue,
  netWorth,
  nextTileOfKind,
  ownableTile,
  ownedTileIds,
  rentFor,
  unmortgageCost,
} from './selectors.js';

const MAX_LOG = 400;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * The only way game state changes. Pure: clones, mutates the clone, returns it.
 * Any rejected action leaves the original state untouched.
 */
export function applyAction(state: GameState, envelope: ActionEnvelope): ApplyResult {
  const g: GameState = structuredClone(state);
  const { playerId, action, now } = envelope;

  try {
    const error = dispatch(g, playerId, action, now);
    if (error) return { ok: false, error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unexpected engine error' };
  }

  g.version += 1;
  if (g.log.length > MAX_LOG) g.log = g.log.slice(-MAX_LOG);
  return { ok: true, state: g };
}

function dispatch(g: GameState, playerId: string, action: GameAction, now: number): string | null {
  switch (action.type) {
    case 'set_connected':
      return setConnected(g, action.playerId, action.connected);
    case 'start_game':
      return startGame(g, playerId, now);
    case 'roll_dice':
      return doRoll(g, playerId, now);
    case 'buy_property':
      return doBuy(g, playerId, now);
    case 'decline_property':
      return doDecline(g, playerId, now);
    case 'bid':
      return doBid(g, playerId, action.amount, now);
    case 'pass_bid':
      return doPassBid(g, playerId, now);
    case 'build':
      return doBuild(g, playerId, action.tileId, now);
    case 'sell_building':
      return doSellBuilding(g, playerId, action.tileId, now);
    case 'mortgage':
      return doMortgage(g, playerId, action.tileId, now);
    case 'unmortgage':
      return doUnmortgage(g, playerId, action.tileId, now);
    case 'pay_holding_fine':
      return doPayFine(g, playerId, now);
    case 'use_reprieve':
      return doUseReprieve(g, playerId, now);
    case 'end_turn':
      return doEndTurn(g, playerId, now);
    case 'propose_trade':
      return doProposeTrade(g, playerId, action, now);
    case 'accept_trade':
      return doAcceptTrade(g, playerId, action.tradeId, now);
    case 'decline_trade':
    case 'cancel_trade':
      return doDropTrade(g, playerId, action.tradeId, now);
    case 'declare_bankruptcy':
      return doDeclareBankruptcy(g, playerId, now);
    case 'resign':
      return doResign(g, playerId, now, action.reason ?? 'left');
    case 'timeout':
      return doTimeout(g, now);
    default:
      return 'Unknown action.';
  }
}

// ---------------------------------------------------------------------------
// Logging & money
// ---------------------------------------------------------------------------

function log(g: GameState, kind: LogEntry['kind'], text: string, playerId?: string): void {
  g.logSeq += 1;
  const entry: LogEntry = { id: g.logSeq, at: Date.now(), text, kind };
  if (playerId) entry.playerId = playerId;
  g.log.push(entry);
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** A tile's display name, honouring the host's rename overrides. */
function tname(g: GameState, tileId: number): string {
  return g.tileNames[tileId] ?? tileAt(tileId).name;
}

function credit(g: GameState, player: Player, amount: number): void {
  player.cash += amount;
}

/**
 * Take `amount` from `player`. If they cannot cover it, the shortfall becomes a
 * debt they must settle by liquidating or by going bankrupt.
 * Returns true when the payment cleared immediately.
 */
function charge(
  g: GameState,
  player: Player,
  amount: number,
  creditorId: string | null,
  reason: string,
): boolean {
  if (amount <= 0) return true;
  if (player.cash >= amount) {
    player.cash -= amount;
    payOut(g, creditorId, amount);
    return true;
  }
  g.debt = { debtorId: player.id, creditorId, amount, reason };
  g.phase = 'debt';
  log(g, 'money', `${player.name} owes ${money(amount)} — ${reason}.`, player.id);
  return false;
}

function payOut(g: GameState, creditorId: string | null, amount: number): void {
  if (creditorId) {
    const creditor = getPlayer(g, creditorId);
    if (creditor) creditor.cash += amount;
    return;
  }
  if (g.settings.plazaPot) g.plazaPot += amount;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

function setConnected(g: GameState, playerId: string, connected: boolean): string | null {
  const player = getPlayer(g, playerId);
  if (!player) return 'Unknown player.';
  if (player.connected === connected) return null;
  player.connected = connected;
  log(g, 'system', `${player.name} ${connected ? 'reconnected' : 'disconnected'}.`, playerId);
  return null;
}

function startGame(g: GameState, playerId: string, now: number): string | null {
  if (g.phase !== 'lobby') return 'The game has already started.';
  if (g.players.length < 2) return 'You need at least two players.';
  const host = g.players[0];
  if (!host || host.id !== playerId) return 'Only the host can start the game.';

  g.phase = 'pre_roll';
  g.turnSeat = 0;
  g.startedAt = now;
  setDeadline(g, now);
  recordNetWorth(g);
  log(g, 'system', `Game started with ${g.players.length} players.`);
  const first = currentPlayer(g);
  if (first) log(g, 'system', `${first.name} goes first.`, first.id);
  return null;
}

/** Snapshot every player's net worth for the end-of-game chart. */
function recordNetWorth(g: GameState): void {
  const worth: Record<string, number> = {};
  for (const p of g.players) worth[p.id] = p.bankrupt ? 0 : netWorth(g, p.id);
  const history = g.stats.netWorthHistory;
  const turn = history.length ? history[history.length - 1]!.turn + 1 : 0;
  history.push({ turn, worth });
  // Keep marathon games from growing the state unbounded; trim the oldest.
  if (history.length > 400) history.shift();
}

function setDeadline(g: GameState, now: number): void {
  g.turnDeadline = g.settings.turnSeconds > 0 ? now + g.settings.turnSeconds * 1000 : null;
}

// ---------------------------------------------------------------------------
// Rolling and movement
// ---------------------------------------------------------------------------

function doRoll(g: GameState, playerId: string, now: number): string | null {
  if (g.phase !== 'pre_roll') return 'You cannot roll right now.';
  const player = currentPlayer(g);
  if (!player || player.id !== playerId) return 'It is not your turn.';

  const draw = rollDice(g.rngState);
  g.rngState = draw.state;
  const [a, b] = draw.value;
  g.dice = [a, b];
  const total = a + b;
  const isDouble = a === b;
  g.hasRolled = true;
  g.drawnCard = null;

  log(g, 'roll', `${player.name} rolled ${a} and ${b}.`, player.id);

  if (player.inHolding) {
    if (isDouble) {
      player.inHolding = false;
      player.holdingTurns = 0;
      log(g, 'system', `${player.name} rolled doubles and left the holding yard.`, player.id);
      g.doublesInARow = 0; // a release roll does not grant another turn
      movePlayerBy(g, player, total, now);
      settleTurn(g, now);
      return null;
    }
    player.holdingTurns += 1;
    if (player.holdingTurns >= 3) {
      log(g, 'system', `${player.name} paid the ${money(g.settings.holdingFine)} fine after three tries.`, player.id);
      const cleared = charge(g, player, g.settings.holdingFine, null, 'holding yard fine');
      player.inHolding = false;
      player.holdingTurns = 0;
      if (!cleared) return null;
      movePlayerBy(g, player, total, now);
      settleTurn(g, now);
      return null;
    }
    log(g, 'system', `${player.name} stays in the holding yard.`, player.id);
    g.phase = 'post_roll';
    setDeadline(g, now);
    return null;
  }

  if (isDouble) {
    g.doublesInARow += 1;
    if (g.doublesInARow >= 3) {
      log(g, 'system', `${player.name} rolled a third double and was sent to the holding yard.`, player.id);
      sendToHolding(g, player);
      g.doublesInARow = 0;
      g.phase = 'post_roll';
      setDeadline(g, now);
      return null;
    }
  } else {
    g.doublesInARow = 0;
  }

  movePlayerBy(g, player, total, now);
  settleTurn(g, now);
  return null;
}

function movePlayerBy(g: GameState, player: Player, steps: number, now: number): void {
  const target = ((player.position + steps) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
  const passedStart = steps > 0 && player.position + steps >= BOARD_SIZE;
  moveTo(g, player, target, passedStart, now, steps);
}

function moveTo(
  g: GameState,
  player: Player,
  target: number,
  collectStart: boolean,
  now: number,
  diceTotalOverride?: number,
): void {
  player.position = target;
  const tile = tileAt(target);
  if (collectStart) {
    credit(g, player, g.settings.startSalary);
    log(g, 'money', `${player.name} passed Start and drew ${money(g.settings.startSalary)}.`, player.id);
  }
  log(g, 'move', `${player.name} landed on ${tname(g, tile.id)}.`, player.id);
  resolveLanding(g, player, diceTotalOverride ?? diceTotal(g), now, 1);
}

function diceTotal(g: GameState): number {
  return g.dice ? g.dice[0] + g.dice[1] : 0;
}

function sendToHolding(g: GameState, player: Player): void {
  player.position = HOLDING_TILE;
  player.inHolding = true;
  player.holdingTurns = 0;
  g.stats.holdingVisits[player.id] = (g.stats.holdingVisits[player.id] ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Landing resolution
// ---------------------------------------------------------------------------

function resolveLanding(
  g: GameState,
  player: Player,
  total: number,
  now: number,
  rentMultiplier: number,
): void {
  const tile = tileAt(player.position);

  if (isOwnable(tile)) {
    const deed = g.deeds[tile.id]!;
    if (!deed.ownerId) {
      if (player.cash >= tile.price) {
        g.phase = 'awaiting_buy';
        setDeadline(g, now);
      } else if (g.settings.auctionsEnabled) {
        log(g, 'system', `${player.name} cannot afford ${tname(g, tile.id)}. It goes to auction.`, player.id);
        beginAuction(g, tile.id, player.id, now);
      }
      return;
    }
    if (deed.ownerId === player.id) return;
    if (deed.mortgaged) {
      log(g, 'system', `${tname(g, tile.id)} is mortgaged — no rent is due.`, player.id);
      return;
    }
    const owner = getPlayer(g, deed.ownerId)!;
    const base = rentFor(g, tile.id, player.id, total);
    const rent = base * rentMultiplier;
    if (rent <= 0) return;
    log(g, 'money', `${player.name} owes ${owner.name} ${money(rent)} for ${tname(g, tile.id)}.`, player.id);
    charge(g, player, rent, owner.id, `rent on ${tname(g, tile.id)}`);
    return;
  }

  switch (tile.kind) {
    case 'tax': {
      log(g, 'money', `${player.name} pays ${money(tile.amount)} — ${tname(g, tile.id)}.`, player.id);
      charge(g, player, tile.amount, null, tname(g, tile.id).toLowerCase());
      return;
    }
    case 'dispatch': {
      log(g, 'system', `${player.name} was dispatched to the holding yard.`, player.id);
      sendToHolding(g, player);
      return;
    }
    case 'plaza': {
      if (g.settings.plazaPot && g.plazaPot > 0) {
        g.stats.plazaTake[player.id] = (g.stats.plazaTake[player.id] ?? 0) + g.plazaPot;
        credit(g, player, g.plazaPot);
        log(g, 'money', `${player.name} swept the plaza pot of ${money(g.plazaPot)}.`, player.id);
        g.plazaPot = 0;
      }
      return;
    }
    case 'fortune':
    case 'ledger': {
      drawCard(g, player, tile.kind, now);
      return;
    }
    case 'start': {
      if (g.settings.doubleOnExactStart) {
        credit(g, player, g.settings.startSalary);
        log(g, 'money', `${player.name} landed exactly on Start — bonus ${money(g.settings.startSalary)}.`, player.id);
      }
      return;
    }
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function drawCard(g: GameState, player: Player, deck: 'fortune' | 'ledger', now: number): void {
  const pile = deck === 'fortune' ? g.fortuneDeck : g.ledgerDeck;
  const deckCards = g.cards.filter((c) => c.deck === deck);
  if (deckCards.length === 0) {
    log(g, 'system', `The ${deck === 'fortune' ? 'Fortune' : 'Ledger'} deck is empty.`, player.id);
    return;
  }
  if (pile.length === 0) {
    const reshuffled = shuffle(deckCards.map((c) => c.id), g.rngState);
    g.rngState = reshuffled.state;
    pile.push(...reshuffled.value);
  }
  const cardId = pile.shift()!;
  const card = g.cards.find((c) => c.id === cardId);
  if (!card) return;
  g.drawnCard = { deck, cardId };
  log(g, 'card', `${player.name} drew: “${card.text}”`, player.id);
  // Reprieve cards leave the deck until they are spent.
  if (card.effect.kind !== 'reprieve') pile.push(cardId);
  applyCard(g, player, card, now);
}

function applyCard(g: GameState, player: Player, card: Card, now: number): void {
  const effect = card.effect;
  switch (effect.kind) {
    case 'cash': {
      if (effect.amount >= 0) credit(g, player, effect.amount);
      else charge(g, player, -effect.amount, null, 'a fortune card');
      return;
    }
    case 'collect_each': {
      for (const other of activePlayers(g)) {
        if (other.id === player.id) continue;
        charge(g, other, effect.amount, player.id, `owed to ${player.name}`);
      }
      return;
    }
    case 'pay_each': {
      const others = activePlayers(g).filter((p) => p.id !== player.id);
      charge(g, player, effect.amount * others.length, null, 'a payout to the table');
      if (!g.debt) for (const other of others) credit(g, other, effect.amount);
      return;
    }
    case 'move_to': {
      const passed = effect.collectStart && effect.tile <= player.position && effect.tile !== player.position;
      moveTo(g, player, effect.tile, passed, now);
      return;
    }
    case 'move_by': {
      movePlayerBy(g, player, effect.steps, now);
      return;
    }
    case 'advance_nearest': {
      const target = nextTileOfKind(player.position, effect.target);
      const passed = target < player.position;
      player.position = target;
      if (passed) {
        credit(g, player, g.settings.startSalary);
        log(g, 'money', `${player.name} passed Start and drew ${money(g.settings.startSalary)}.`, player.id);
      }
      const tile = tileAt(target);
      log(g, 'move', `${player.name} advanced to ${tname(g, tile.id)}.`, player.id);
      const deed = g.deeds[target]!;
      if (!deed.ownerId) {
        resolveLanding(g, player, diceTotal(g), now, 1);
        return;
      }
      if (deed.ownerId === player.id || deed.mortgaged) return;
      const owner = getPlayer(g, deed.ownerId)!;
      const base =
        effect.target === 'works'
          ? effect.multiplier * diceTotal(g)
          : rentFor(g, target, player.id, diceTotal(g)) * effect.multiplier;
      if (base <= 0) return;
      log(g, 'money', `${player.name} owes ${owner.name} ${money(base)} for ${tname(g, tile.id)}.`, player.id);
      charge(g, player, base, owner.id, `rent on ${tname(g, tile.id)}`);
      return;
    }
    case 'goto_holding': {
      sendToHolding(g, player);
      g.doublesInARow = 0;
      return;
    }
    case 'reprieve': {
      player.reprieveCards += 1;
      return;
    }
    case 'assessment': {
      let houses = 0;
      let hotels = 0;
      for (const id of ownedTileIds(g, player.id)) {
        const deed = g.deeds[id]!;
        if (deed.houses === 5) hotels += 1;
        else houses += deed.houses;
      }
      const amount = houses * effect.perHouse + hotels * effect.perHotel;
      if (amount <= 0) {
        log(g, 'card', `${player.name} has nothing to assess.`, player.id);
        return;
      }
      log(g, 'money', `${player.name} is assessed ${money(amount)} for buildings.`, player.id);
      charge(g, player, amount, null, 'a building assessment');
      return;
    }
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Buying and auctions
// ---------------------------------------------------------------------------

function doBuy(g: GameState, playerId: string, now: number): string | null {
  if (g.phase !== 'awaiting_buy') return 'There is nothing to buy.';
  const player = currentPlayer(g);
  if (!player || player.id !== playerId) return 'It is not your turn.';
  const tile = ownableTile(player.position);
  if (!tile) return 'This tile cannot be bought.';
  const deed = g.deeds[tile.id]!;
  if (deed.ownerId) return 'Already owned.';
  if (player.cash < tile.price) return 'Not enough cash.';

  player.cash -= tile.price;
  deed.ownerId = player.id;
  log(g, 'money', `${player.name} bought ${tname(g, tile.id)} for ${money(tile.price)}.`, player.id);
  g.phase = 'post_roll';
  settleTurn(g, now);
  return null;
}

function doDecline(g: GameState, playerId: string, now: number): string | null {
  if (g.phase !== 'awaiting_buy') return 'There is nothing to decline.';
  const player = currentPlayer(g);
  if (!player || player.id !== playerId) return 'It is not your turn.';
  const tile = ownableTile(player.position);
  if (!tile) return 'Nothing here.';

  if (!g.settings.auctionsEnabled) {
    log(g, 'system', `${player.name} passed on ${tname(g, tile.id)}.`, player.id);
    g.phase = 'post_roll';
    settleTurn(g, now);
    return null;
  }
  log(g, 'system', `${player.name} sent ${tname(g, tile.id)} to auction.`, player.id);
  beginAuction(g, tile.id, player.id, now);
  return null;
}

function beginAuction(g: GameState, tileId: number, starterId: string, now: number): void {
  const eligible = activePlayers(g);
  if (eligible.length === 0) {
    settleTurn(g, now);
    return;
  }
  const startSeat = getPlayer(g, starterId)?.seat ?? 0;
  const ordered = [...eligible].sort(
    (a, b) => ((a.seat - startSeat + 8) % 8) - ((b.seat - startSeat + 8) % 8),
  );
  g.auction = {
    tileId,
    highBid: 0,
    highBidderId: null,
    activeIds: ordered.map((p) => p.id),
    turnIndex: 0,
    deadline: g.settings.turnSeconds > 0 ? now + Math.max(15, g.settings.turnSeconds / 3) * 1000 : null,
  };
  g.phase = 'auction';
  log(g, 'system', `Auction open for ${tname(g, tileId)}.`);
}

function doBid(g: GameState, playerId: string, amount: number, now: number): string | null {
  const auction = g.auction;
  if (g.phase !== 'auction' || !auction) return 'No auction is running.';
  if (auction.activeIds[auction.turnIndex] !== playerId) return 'It is not your bid.';
  const player = getPlayer(g, playerId);
  if (!player) return 'Unknown player.';
  const bid = Math.round(amount);
  if (!Number.isFinite(bid) || bid <= auction.highBid) return 'Bid must beat the current bid.';
  if (bid > player.cash) return 'You cannot bid more cash than you hold.';

  auction.highBid = bid;
  auction.highBidderId = playerId;
  log(g, 'money', `${player.name} bid ${money(bid)}.`, playerId);
  advanceAuction(g, now);
  return null;
}

function doPassBid(g: GameState, playerId: string, now: number): string | null {
  const auction = g.auction;
  if (g.phase !== 'auction' || !auction) return 'No auction is running.';
  if (auction.activeIds[auction.turnIndex] !== playerId) return 'It is not your bid.';
  const player = getPlayer(g, playerId);
  auction.activeIds.splice(auction.turnIndex, 1);
  if (auction.turnIndex >= auction.activeIds.length) auction.turnIndex = 0;
  if (player) log(g, 'system', `${player.name} passed.`, playerId);
  advanceAuction(g, now, true);
  return null;
}

function advanceAuction(g: GameState, now: number, afterPass = false): void {
  const auction = g.auction!;
  const done =
    auction.activeIds.length === 0 ||
    (auction.activeIds.length === 1 && auction.activeIds[0] === auction.highBidderId);

  if (done) {
    finishAuction(g, now);
    return;
  }
  if (!afterPass) auction.turnIndex = (auction.turnIndex + 1) % auction.activeIds.length;
  auction.deadline =
    g.settings.turnSeconds > 0 ? now + Math.max(15, g.settings.turnSeconds / 3) * 1000 : null;
}

function finishAuction(g: GameState, now: number): void {
  const auction = g.auction!;
  const tile = tileAt(auction.tileId);
  if (auction.highBidderId && auction.highBid > 0) {
    const winner = getPlayer(g, auction.highBidderId)!;
    winner.cash -= auction.highBid;
    g.deeds[auction.tileId]!.ownerId = winner.id;
    log(g, 'money', `${winner.name} won ${tname(g, tile.id)} at auction for ${money(auction.highBid)}.`, winner.id);
  } else {
    log(g, 'system', `${tname(g, tile.id)} drew no bids and stays with the bank.`);
  }
  g.auction = null;
  g.phase = 'post_roll';
  settleTurn(g, now);
}

// ---------------------------------------------------------------------------
// Property management
// ---------------------------------------------------------------------------

function managementAllowed(g: GameState): boolean {
  return g.phase === 'pre_roll' || g.phase === 'post_roll' || g.phase === 'debt' || g.phase === 'awaiting_buy';
}

function doBuild(g: GameState, playerId: string, tileId: number, now: number): string | null {
  if (!managementAllowed(g)) return 'You cannot build right now.';
  if (g.phase === 'debt' && g.debt?.debtorId !== playerId) return 'Settle the outstanding debt first.';
  const check = canBuild(g, playerId, tileId);
  if (!check.ok) return check.reason ?? 'Cannot build here.';
  const player = getPlayer(g, playerId)!;
  const deed = g.deeds[tileId]!;
  player.cash -= check.cost!;
  deed.houses += 1;
  const tile = tileAt(tileId);
  log(
    g,
    'build',
    deed.houses === 5
      ? `${player.name} opened a hotel on ${tname(g, tile.id)}.`
      : `${player.name} built a house on ${tname(g, tile.id)} (${deed.houses}).`,
    playerId,
  );
  return null;
}

function doSellBuilding(g: GameState, playerId: string, tileId: number, now: number): string | null {
  if (!managementAllowed(g)) return 'You cannot sell right now.';
  const check = canSellBuilding(g, playerId, tileId);
  if (!check.ok) return check.reason ?? 'Cannot sell here.';
  const player = getPlayer(g, playerId)!;
  const deed = g.deeds[tileId]!;
  deed.houses -= 1;
  player.cash += check.cost!;
  log(g, 'build', `${player.name} sold a building on ${tname(g, tileId)} for ${money(check.cost!)}.`, playerId);
  maybeSettleDebt(g, now);
  return null;
}

function doMortgage(g: GameState, playerId: string, tileId: number, now: number): string | null {
  if (!managementAllowed(g)) return 'You cannot mortgage right now.';
  const check = canMortgage(g, playerId, tileId);
  if (!check.ok) return check.reason ?? 'Cannot mortgage.';
  const player = getPlayer(g, playerId)!;
  g.deeds[tileId]!.mortgaged = true;
  player.cash += check.cost!;
  log(g, 'money', `${player.name} mortgaged ${tname(g, tileId)} for ${money(check.cost!)}.`, playerId);
  maybeSettleDebt(g, now);
  return null;
}

function doUnmortgage(g: GameState, playerId: string, tileId: number, now: number): string | null {
  if (!managementAllowed(g)) return 'You cannot lift a mortgage right now.';
  const tile = ownableTile(tileId);
  if (!tile) return 'Not a property.';
  const deed = g.deeds[tileId];
  if (!deed || deed.ownerId !== playerId) return 'You do not own this property.';
  if (!deed.mortgaged) return 'This property is not mortgaged.';
  const cost = unmortgageCost(tile);
  const player = getPlayer(g, playerId)!;
  if (player.cash < cost) return 'Not enough cash.';
  player.cash -= cost;
  deed.mortgaged = false;
  log(g, 'money', `${player.name} lifted the mortgage on ${tname(g, tile.id)} for ${money(cost)}.`, playerId);
  return null;
}

// ---------------------------------------------------------------------------
// Holding yard
// ---------------------------------------------------------------------------

function doPayFine(g: GameState, playerId: string, now: number): string | null {
  if (g.phase !== 'pre_roll') return 'You can only do this at the start of your turn.';
  const player = currentPlayer(g);
  if (!player || player.id !== playerId) return 'It is not your turn.';
  if (!player.inHolding) return 'You are not in the holding yard.';
  if (player.cash < g.settings.holdingFine) return 'Not enough cash for the fine.';
  player.cash -= g.settings.holdingFine;
  payOut(g, null, g.settings.holdingFine);
  player.inHolding = false;
  player.holdingTurns = 0;
  log(g, 'money', `${player.name} paid the ${money(g.settings.holdingFine)} fine and walked free.`, playerId);
  return null;
}

function doUseReprieve(g: GameState, playerId: string, now: number): string | null {
  if (g.phase !== 'pre_roll') return 'You can only do this at the start of your turn.';
  const player = currentPlayer(g);
  if (!player || player.id !== playerId) return 'It is not your turn.';
  if (!player.inHolding) return 'You are not in the holding yard.';
  if (player.reprieveCards <= 0) return 'You have no reprieve card.';
  player.reprieveCards -= 1;
  player.inHolding = false;
  player.holdingTurns = 0;
  log(g, 'card', `${player.name} used a reprieve card.`, playerId);
  return null;
}

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------

function sanitizeSide(side: TradeSide): TradeSide {
  return {
    cash: Math.max(0, Math.round(side?.cash ?? 0)),
    tileIds: Array.from(new Set((side?.tileIds ?? []).filter((id) => Number.isInteger(id) && !!ownableTile(id)))),
    reprieveCards: Math.max(0, Math.round(side?.reprieveCards ?? 0)),
  };
}

function validateSide(g: GameState, ownerId: string, side: TradeSide): string | null {
  const owner = getPlayer(g, ownerId);
  if (!owner) return 'Unknown player.';
  if (owner.cash < side.cash) return `${owner.name} does not have that much cash.`;
  if (owner.reprieveCards < side.reprieveCards) return `${owner.name} does not have that many reprieve cards.`;
  for (const id of side.tileIds) {
    const deed = g.deeds[id];
    if (!deed || deed.ownerId !== ownerId) return `${owner.name} does not own ${tname(g, id)}.`;
    if (deed.houses > 0) return `Sell the buildings on ${tname(g, id)} before trading it.`;
    const group = groupOf(tileAt(id));
    if (group && (GROUP_TILES[group] ?? []).some((gid) => (g.deeds[gid]?.houses ?? 0) > 0)) {
      return `Clear the buildings in the ${group} group before trading it.`;
    }
  }
  return null;
}

function doProposeTrade(
  g: GameState,
  playerId: string,
  action: Extract<GameAction, { type: 'propose_trade' }>,
  now: number,
): string | null {
  if (g.phase === 'lobby' || g.phase === 'game_over') return 'Trading is closed.';
  if (playerId === action.toId) return 'You cannot trade with yourself.';
  const from = getPlayer(g, playerId);
  const to = getPlayer(g, action.toId);
  if (!from || !to) return 'Unknown player.';
  if (from.bankrupt || to.bankrupt) return 'That player is out of the game.';
  if (g.trades.filter((t) => t.fromId === playerId).length >= 5) return 'Too many open offers.';

  const give = sanitizeSide(action.give);
  const receive = sanitizeSide(action.receive);
  if (
    give.cash === 0 && give.tileIds.length === 0 && give.reprieveCards === 0 &&
    receive.cash === 0 && receive.tileIds.length === 0 && receive.reprieveCards === 0
  ) {
    return 'An offer needs something on at least one side.';
  }
  const giveError = validateSide(g, playerId, give);
  if (giveError) return giveError;
  const receiveError = validateSide(g, action.toId, receive);
  if (receiveError) return receiveError;

  const offer: TradeOffer = {
    id: `t${g.version}_${g.trades.length}_${Math.abs(g.rngState % 100000)}`,
    fromId: playerId,
    toId: action.toId,
    give,
    receive,
    createdAt: now,
  };
  if (action.message) offer.message = action.message.slice(0, 200);
  g.trades.push(offer);
  log(g, 'trade', `${from.name} sent ${to.name} a trade offer.`, playerId);
  return null;
}

function doAcceptTrade(g: GameState, playerId: string, tradeId: string, now: number): string | null {
  const index = g.trades.findIndex((t) => t.id === tradeId);
  if (index === -1) return 'That offer is gone.';
  const offer = g.trades[index]!;
  if (offer.toId !== playerId) return 'This offer is not addressed to you.';

  const giveError = validateSide(g, offer.fromId, offer.give);
  if (giveError) {
    g.trades.splice(index, 1);
    return `Offer no longer valid: ${giveError}`;
  }
  const receiveError = validateSide(g, offer.toId, offer.receive);
  if (receiveError) {
    g.trades.splice(index, 1);
    return `Offer no longer valid: ${receiveError}`;
  }

  const from = getPlayer(g, offer.fromId)!;
  const to = getPlayer(g, offer.toId)!;

  from.cash -= offer.give.cash;
  to.cash += offer.give.cash;
  to.cash -= offer.receive.cash;
  from.cash += offer.receive.cash;

  from.reprieveCards -= offer.give.reprieveCards;
  to.reprieveCards += offer.give.reprieveCards;
  to.reprieveCards -= offer.receive.reprieveCards;
  from.reprieveCards += offer.receive.reprieveCards;

  for (const id of offer.give.tileIds) g.deeds[id]!.ownerId = to.id;
  for (const id of offer.receive.tileIds) g.deeds[id]!.ownerId = from.id;

  g.trades.splice(index, 1);
  // Any other open offer touching these assets is now suspect; drop them.
  const touched = new Set([...offer.give.tileIds, ...offer.receive.tileIds]);
  g.trades = g.trades.filter(
    (t) => ![...t.give.tileIds, ...t.receive.tileIds].some((id) => touched.has(id)),
  );

  log(g, 'trade', `${from.name} and ${to.name} agreed a trade.`, playerId);
  maybeSettleDebt(g, now);
  return null;
}

function doDropTrade(g: GameState, playerId: string, tradeId: string, _now: number): string | null {
  const index = g.trades.findIndex((t) => t.id === tradeId);
  if (index === -1) return 'That offer is gone.';
  const offer = g.trades[index]!;
  if (offer.fromId !== playerId && offer.toId !== playerId) return 'Not your offer.';
  g.trades.splice(index, 1);
  const actor = getPlayer(g, playerId);
  if (actor) log(g, 'trade', `${actor.name} ${offer.fromId === playerId ? 'withdrew' : 'declined'} a trade offer.`, playerId);
  return null;
}

// ---------------------------------------------------------------------------
// Debt, bankruptcy, turn flow
// ---------------------------------------------------------------------------

function maybeSettleDebt(g: GameState, now: number): void {
  const debt = g.debt;
  if (!debt) return;
  const debtor = getPlayer(g, debt.debtorId);
  if (!debtor) return;
  if (debtor.cash < debt.amount) return;

  debtor.cash -= debt.amount;
  payOut(g, debt.creditorId, debt.amount);
  const creditor = debt.creditorId ? getPlayer(g, debt.creditorId) : null;
  log(
    g,
    'money',
    `${debtor.name} settled ${money(debt.amount)}${creditor ? ` with ${creditor.name}` : ' with the bank'}.`,
    debtor.id,
  );
  g.debt = null;
  settleTurn(g, now);
}

function doDeclareBankruptcy(g: GameState, playerId: string, now: number): string | null {
  if (g.phase !== 'debt' || !g.debt) return 'You have no outstanding debt.';
  if (g.debt.debtorId !== playerId) return 'You are not the debtor.';
  if (liquidValue(g, playerId) >= g.debt.amount) {
    return 'You can still raise the money — sell buildings or mortgage properties.';
  }
  bankrupt(g, playerId, g.debt.creditorId, now);
  return null;
}

/**
 * Voluntary exit. `reason` only changes the log line — either way the player
 * forfeits everything to the bank and the game ends if one player is left. A
 * player who reports bankrupt keeps their seat and can watch to the end; the
 * server is what decides whether the socket also leaves the room.
 */
function doResign(
  g: GameState,
  playerId: string,
  now: number,
  reason: 'left' | 'bankrupt',
): string | null {
  const player = getPlayer(g, playerId);
  if (!player || player.bankrupt) return 'You are already out.';
  if (g.phase === 'lobby' || g.phase === 'game_over') return 'Nothing to resign from.';
  log(
    g,
    'system',
    reason === 'bankrupt'
      ? `${player.name} reported bankrupt and is out of the game.`
      : `${player.name} left the table.`,
    playerId,
  );
  bankrupt(g, playerId, null, now);
  return null;
}

function bankrupt(g: GameState, debtorId: string, creditorId: string | null, now: number): void {
  const debtor = getPlayer(g, debtorId);
  if (!debtor || debtor.bankrupt) return;
  const creditor = creditorId ? getPlayer(g, creditorId) : null;

  const tiles = ownedTileIds(g, debtorId);
  if (creditor) {
    creditor.cash += debtor.cash;
    creditor.reprieveCards += debtor.reprieveCards;
    for (const id of tiles) {
      const deed = g.deeds[id]!;
      deed.ownerId = creditor.id;
      deed.houses = 0;
    }
    log(
      g,
      'system',
      `${debtor.name} went bankrupt. ${creditor.name} takes everything they had.`,
      debtorId,
    );
  } else {
    for (const id of tiles) {
      g.deeds[id] = { tileId: id, ownerId: null, houses: 0, mortgaged: false };
    }
    log(g, 'system', `${debtor.name} went bankrupt. Their holdings return to the bank.`, debtorId);
  }

  debtor.cash = 0;
  debtor.reprieveCards = 0;
  debtor.bankrupt = true;
  debtor.finishedRank = g.players.filter((p) => p.bankrupt).length;

  g.trades = g.trades.filter((t) => t.fromId !== debtorId && t.toId !== debtorId);
  if (g.debt?.debtorId === debtorId) g.debt = null;
  if (g.auction) {
    g.auction.activeIds = g.auction.activeIds.filter((id) => id !== debtorId);
    if (g.auction.turnIndex >= g.auction.activeIds.length) g.auction.turnIndex = 0;
  }

  const remaining = activePlayers(g);
  if (remaining.length <= 1) {
    g.phase = 'game_over';
    g.endedAt = now;
    g.winnerId = remaining[0]?.id ?? null;
    g.turnDeadline = null;
    recordNetWorth(g);
    if (remaining[0]) log(g, 'system', `${remaining[0].name} wins with ${money(netWorth(g, remaining[0].id))} in assets.`);
    return;
  }

  if (g.auction) {
    advanceAuction(g, now, true);
    return;
  }

  const isCurrent = currentPlayer(g) === undefined || debtor.seat === g.turnSeat;
  if (isCurrent) advanceTurn(g, now);
  else settleTurn(g, now);
}

/**
 * Called after every resolved event to decide what the current player may do
 * next: keep an outstanding decision open, roll again on doubles, or wrap up.
 */
function settleTurn(g: GameState, now: number): void {
  if (g.phase === 'game_over' || g.phase === 'lobby') return;
  if (g.debt) {
    g.phase = 'debt';
    return;
  }
  if (g.auction) {
    g.phase = 'auction';
    return;
  }
  if (g.phase === 'awaiting_buy') return;

  const player = currentPlayer(g);
  if (!player) {
    advanceTurn(g, now);
    return;
  }
  const rolledDoubles = !!g.dice && g.dice[0] === g.dice[1];
  if (g.hasRolled && rolledDoubles && g.doublesInARow > 0 && !player.inHolding) {
    g.phase = 'pre_roll';
    g.hasRolled = false;
    log(g, 'system', `${player.name} rolled doubles and goes again.`, player.id);
  } else {
    g.phase = 'post_roll';
  }
  setDeadline(g, now);
}

function doEndTurn(g: GameState, playerId: string, now: number): string | null {
  if (g.phase !== 'post_roll') {
    if (g.phase === 'pre_roll') return 'Roll the dice first.';
    return 'You cannot end your turn right now.';
  }
  const player = currentPlayer(g);
  if (!player || player.id !== playerId) return 'It is not your turn.';
  advanceTurn(g, now);
  return null;
}

function advanceTurn(g: GameState, now: number): void {
  if (g.phase === 'game_over') return;
  recordNetWorth(g);
  const remaining = activePlayers(g);
  if (remaining.length <= 1) {
    g.phase = 'game_over';
    g.endedAt = now;
    g.winnerId = remaining[0]?.id ?? null;
    g.turnDeadline = null;
    return;
  }

  g.dice = null;
  g.doublesInARow = 0;
  g.hasRolled = false;
  g.drawnCard = null;

  const seats = remaining.map((p) => p.seat).sort((a, b) => a - b);
  const next = seats.find((s) => s > g.turnSeat) ?? seats[0]!;
  g.turnSeat = next;
  g.phase = 'pre_roll';
  setDeadline(g, now);
  const player = currentPlayer(g);
  if (player) log(g, 'system', `It is ${player.name}'s turn.`, player.id);
}

// ---------------------------------------------------------------------------
// Timeouts (server-driven)
// ---------------------------------------------------------------------------

function doTimeout(g: GameState, now: number): string | null {
  switch (g.phase) {
    case 'pre_roll': {
      const player = currentPlayer(g);
      if (!player) return null;
      log(g, 'system', `${player.name} ran out of time and rolls automatically.`, player.id);
      return doRoll(g, player.id, now);
    }
    case 'awaiting_buy': {
      const player = currentPlayer(g);
      if (!player) return null;
      log(g, 'system', `${player.name} ran out of time.`, player.id);
      return doDecline(g, player.id, now);
    }
    case 'auction': {
      const bidderId = g.auction?.activeIds[g.auction.turnIndex];
      if (!bidderId) return null;
      return doPassBid(g, bidderId, now);
    }
    case 'post_roll': {
      const player = currentPlayer(g);
      if (!player) return null;
      advanceTurn(g, now);
      return null;
    }
    case 'debt': {
      const debt = g.debt;
      if (!debt) return null;
      autoLiquidate(g, debt.debtorId, now);
      if (g.debt) bankrupt(g, debt.debtorId, debt.creditorId, now);
      return null;
    }
    default:
      return null;
  }
}

/** Sell buildings, then mortgage, until the debt is covered or nothing is left. */
export function autoLiquidate(g: GameState, playerId: string, now: number): void {
  const debt = g.debt;
  if (!debt || debt.debtorId !== playerId) return;
  const player = getPlayer(g, playerId);
  if (!player) return;

  const owned = () => ownedTileIds(g, playerId);
  let guard = 0;
  while (g.debt && player.cash < g.debt.amount && guard++ < 200) {
    const sellable = owned().find((id) => canSellBuilding(g, playerId, id).ok);
    if (sellable !== undefined) {
      doSellBuilding(g, playerId, sellable, now);
      continue;
    }
    const mortgageable = owned().find((id) => canMortgage(g, playerId, id).ok);
    if (mortgageable !== undefined) {
      doMortgage(g, playerId, mortgageable, now);
      continue;
    }
    break;
  }
  maybeSettleDebt(g, now);
}

export { money as formatMoney };
