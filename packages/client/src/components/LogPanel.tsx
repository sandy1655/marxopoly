import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@marxopoly/shared';
import { sendChat, useStore } from '../net.js';

interface Props {
  state: GameState;
}

export default function LogPanel({ state }: Props) {
  const [tab, setTab] = useState<'log' | 'chat'>('log');
  const chat = useStore((s) => s.chat);
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [state.log.length, chat.length, tab]);

  return (
    <div className="panel log">
      <div className="tabs">
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>
          Game log
        </button>
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
          Chat
        </button>
      </div>

      <div className="log-scroll" ref={scroller}>
        {tab === 'log'
          ? state.log.slice(-120).map((entry) => {
              const player = state.players.find((p) => p.id === entry.playerId);
              return (
                <div key={entry.id} className={`log-line ${entry.kind}`}>
                  {player && <span className="chip xs" style={{ background: player.color }} />}
                  <span>{entry.text}</span>
                </div>
              );
            })
          : chat.map((m) => (
              <div key={m.id} className="chat-line">
                <span className="chip xs" style={{ background: m.color }} />
                <strong>{m.name}</strong>
                <span>{m.text}</span>
              </div>
            ))}
      </div>

      {tab === 'chat' && (
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            sendChat(draft.trim());
            setDraft('');
          }}
        >
          <input
            className="input"
            value={draft}
            maxLength={300}
            placeholder="Say something…"
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn small" type="submit">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
