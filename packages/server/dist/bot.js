import { BOARD, GROUP_TILES, canBuild, canMortgage, canSellBuilding, countOwnedInGroup, currentPlayer, getPlayer, liquidValue, ownableTile, ownedTileIds, ownsWholeGroup, } from '@rentier/shared';
/**
 * A deliberately simple heuristic opponent. It is not trying to be strong —
 * it is trying to keep a table moving when seats are empty.
 */
export function decideBotAction(state, playerId) {
    const me = getPlayer(state, playerId);
    if (!me || me.bankrupt)
        return null;
    // Answer any trade offers pointed at us first.
    const offer = state.trades.find((t) => t.toId === playerId);
    if (offer) {
        return valueTrade(state, playerId) ? { type: 'accept_trade', tradeId: offer.id } : { type: 'decline_trade', tradeId: offer.id };
    }
    if (state.phase === 'debt' && state.debt?.debtorId === playerId) {
        const owned = ownedTileIds(state, playerId);
        const sellable = owned.find((id) => canSellBuilding(state, playerId, id).ok);
        if (sellable !== undefined)
            return { type: 'sell_building', tileId: sellable };
        const mortgageable = owned
            .filter((id) => canMortgage(state, playerId, id).ok)
            .sort((a, b) => tilePrice(a) - tilePrice(b))[0];
        if (mortgageable !== undefined)
            return { type: 'mortgage', tileId: mortgageable };
        if (liquidValue(state, playerId) < state.debt.amount)
            return { type: 'declare_bankruptcy' };
        return null;
    }
    if (state.phase === 'auction' && state.auction) {
        const auction = state.auction;
        if (auction.activeIds[auction.turnIndex] !== playerId)
            return null;
        const tile = ownableTile(auction.tileId);
        if (!tile)
            return { type: 'pass_bid' };
        const ceiling = Math.min(Math.floor(tile.price * (completesGroup(state, playerId, auction.tileId) ? 1.4 : 0.75)), Math.floor(me.cash * 0.6));
        const next = auction.highBid + Math.max(10, Math.round(tile.price * 0.05));
        if (next <= ceiling)
            return { type: 'bid', amount: next };
        return { type: 'pass_bid' };
    }
    const current = currentPlayer(state);
    if (!current || current.id !== playerId)
        return null;
    if (state.phase === 'awaiting_buy') {
        const tile = ownableTile(me.position);
        if (!tile)
            return { type: 'decline_property' };
        const wants = completesGroup(state, playerId, tile.id) || me.cash - tile.price >= 250;
        return wants ? { type: 'buy_property' } : { type: 'decline_property' };
    }
    if (state.phase === 'pre_roll') {
        if (me.inHolding) {
            if (me.reprieveCards > 0)
                return { type: 'use_reprieve' };
            if (me.holdingTurns >= 2 && me.cash > state.settings.holdingFine + 200) {
                return { type: 'pay_holding_fine' };
            }
            return { type: 'roll_dice' };
        }
        const build = pickBuild(state, playerId);
        if (build !== null)
            return { type: 'build', tileId: build };
        return { type: 'roll_dice' };
    }
    if (state.phase === 'post_roll') {
        const build = pickBuild(state, playerId);
        if (build !== null)
            return { type: 'build', tileId: build };
        return { type: 'end_turn' };
    }
    return null;
}
function tilePrice(tileId) {
    return ownableTile(tileId)?.price ?? 0;
}
function completesGroup(state, playerId, tileId) {
    const tile = ownableTile(tileId);
    if (!tile)
        return false;
    const group = tile.kind === 'street' ? tile.group : tile.kind === 'depot' ? 'depot' : 'works';
    const ids = GROUP_TILES[group] ?? [];
    const mine = countOwnedInGroup(state, playerId, group);
    return mine + 1 >= ids.length || mine >= 1;
}
/** Build only with a healthy cash buffer, cheapest complete group first. */
function pickBuild(state, playerId) {
    const me = getPlayer(state, playerId);
    if (!me || me.cash < 400)
        return null;
    const candidates = BOARD.filter((t) => t.kind === 'street')
        .map((t) => t.id)
        .filter((id) => {
        const tile = ownableTile(id);
        if (!tile || tile.kind !== 'street')
            return false;
        if (!ownsWholeGroup(state, playerId, tile.group))
            return false;
        return canBuild(state, playerId, id).ok;
    })
        .sort((a, b) => (ownableTile(a)?.price ?? 0) - (ownableTile(b)?.price ?? 0));
    const choice = candidates[0];
    if (choice === undefined)
        return null;
    const cost = ownableTile(choice)?.kind === 'street' ? ownableTile(choice).buildCost : 0;
    return me.cash - cost >= 300 ? choice : null;
}
/** Accept a trade only when the incoming side is worth clearly more. */
function valueTrade(state, playerId) {
    const offer = state.trades.find((t) => t.toId === playerId);
    if (!offer)
        return false;
    const incoming = offer.give.cash + offer.give.tileIds.reduce((s, id) => s + tilePrice(id), 0);
    const outgoing = offer.receive.cash + offer.receive.tileIds.reduce((s, id) => s + tilePrice(id), 0);
    const me = getPlayer(state, playerId);
    if (!me || me.cash < offer.receive.cash)
        return false;
    return incoming >= outgoing * 1.2;
}
//# sourceMappingURL=bot.js.map