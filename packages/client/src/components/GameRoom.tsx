import { useEffect, useRef, useState } from 'react';
import { leaveRoom, reportBankrupt, useStore } from '../net.js';
import Board from './Board.js';
import PlayerList from './PlayerList.js';
import Properties from './Properties.js';
import ActionBar from './ActionBar.js';
import LogPanel from './LogPanel.js';
import ManagePanel from './ManagePanel.js';
import TradePanel from './TradePanel.js';
import TradeInbox from './TradeInbox.js';
import AuctionPanel from './AuctionPanel.js';
import TileDetail from './TileDetail.js';
import GameOver from './GameOver.js';
import CardsPanel from './CardsPanel.js';
import MapPicker from './MapPicker.js';
import { useMapId } from '../maps/index.js';

/**
 * Keeps the action bar's notch exactly as wide as the board above it, so the
 * board's bottom edge (and whatever ring the map paints around it) drops into
 * the cut instead of sitting on top of the bar. Presentation only: it writes
 * one CSS variable that `.actionbar`'s mask reads.
 */
function useBoardNotch(ref: React.RefObject<HTMLElement>, mapId: string): void {
  useEffect(() => {
    const col = ref.current;
    const board = col?.querySelector<HTMLElement>('.board');
    if (!col || !board || typeof ResizeObserver === 'undefined') return;

    let last = -1;
    const measure = () => {
      const ring = parseFloat(getComputedStyle(board).getPropertyValue('--board-ring')) || 0;
      const half = Math.round(board.getBoundingClientRect().width / 2 + ring + 6);
      if (half === last) return;
      last = half;
      col.style.setProperty('--notch-w', `${half}px`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    observer.observe(col);
    return () => observer.disconnect();
  }, [ref, mapId]);
}

export default function GameRoom() {
  const state = useStore((s) => s.game)!;
  const spectating = useStore((s) => s.spectator);
  // A viewer has no seat: drop the id so every play affordance keys off "not me".
  const myId = useStore((s) => (s.spectator ? null : s.playerId));
  const roomId = useStore((s) => s.roomId);
  const [selected, setSelected] = useState<number | null>(null);
  const [managing, setManaging] = useState(false);
  const [tradeWith, setTradeWith] = useState<string | null>(null);
  const [showCards, setShowCards] = useState(false);
  const centreCol = useRef<HTMLElement>(null);
  useBoardNotch(centreCol, useMapId());

  const me = myId ? state.players.find((p) => p.id === myId) : undefined;
  const inProgress = state.phase !== 'lobby' && state.phase !== 'game_over';
  const canReportBankrupt = !!me && !me.bankrupt && inProgress;

  function onReportBankrupt() {
    if (
      window.confirm(
        'Report bankrupt? Your properties go back to the bank and your cash is wiped. ' +
          'You stay out for the rest of the game but can keep watching.',
      )
    ) {
      reportBankrupt();
    }
  }

  return (
    <div className="game">
      <header className="game-head">
        <div className="brand small">
          Marxopoly<span className="dot" />
        </div>
        <span className="code-chip">{roomId}</span>
        {spectating && <span className="tag you">Watching</span>}
        <MapPicker compact />
        <button className="btn ghost small" onClick={() => setShowCards(true)}>
          Cards
        </button>
        {canReportBankrupt && (
          <button className="btn ghost small danger" onClick={onReportBankrupt}>
            Report bankrupt
          </button>
        )}
        <button className="btn ghost small" onClick={leaveRoom}>
          {spectating ? 'Stop watching' : 'Leave table'}
        </button>
      </header>

      <main className="game-main">
        <aside className="col left">
          <PlayerList state={state} myId={myId} onTrade={(id) => setTradeWith(id)} />
          {myId && <TradeInbox state={state} myId={myId} />}
          <Properties state={state} myId={myId} />
        </aside>

        <section className="col centre" ref={centreCol}>
          <Board state={state} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
          <ActionBar state={state} myId={myId} onManage={() => setManaging(true)} />
        </section>

        <aside className="col right">
          {selected !== null && (
            <TileDetail state={state} tileId={selected} onClose={() => setSelected(null)} />
          )}
          <LogPanel state={state} />
        </aside>
      </main>

      {managing && myId && <ManagePanel state={state} myId={myId} onClose={() => setManaging(false)} />}
      {tradeWith && myId && (
        <TradePanel state={state} myId={myId} partnerId={tradeWith} onClose={() => setTradeWith(null)} />
      )}
      {state.phase === 'auction' && <AuctionPanel state={state} myId={myId} />}
      {state.phase === 'game_over' && <GameOver state={state} myId={myId} />}
      {showCards && <CardsPanel state={state} editable={false} onClose={() => setShowCards(false)} />}
    </div>
  );
}
