import { useEffect } from 'react';
import { refreshRooms, useStore } from './net.js';
import Home from './components/Home.js';
import Lobby from './components/Lobby.js';
import GameRoom from './components/GameRoom.js';
import Toast from './components/Toast.js';

export default function App() {
  const game = useStore((s) => s.game);
  const roomId = useStore((s) => s.roomId);
  const connected = useStore((s) => s.connected);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!roomId) refreshRooms();
    }, 8000);
    return () => window.clearInterval(id);
  }, [roomId]);

  return (
    <div className="app">
      {!connected && <div className="banner">Reconnecting to the server…</div>}
      {!roomId || !game ? <Home /> : game.phase === 'lobby' ? <Lobby /> : <GameRoom />}
      <Toast />
    </div>
  );
}
