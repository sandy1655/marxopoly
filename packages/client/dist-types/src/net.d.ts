import { type Socket } from 'socket.io-client';
import type { CardInput, ChatMessage, ClientToServerEvents, GameAction, GameSettings, GameState, RoomSummary, ServerToClientEvents } from '@rentier/shared';
export interface StoredSession {
    roomId: string;
    token: string;
    playerName: string;
}
export interface ClientStore {
    connected: boolean;
    roomId: string | null;
    roomName: string;
    playerId: string | null;
    hostId: string | null;
    game: GameState | null;
    rooms: RoomSummary[];
    chat: ChatMessage[];
    error: string | null;
    playerName: string;
    joining: boolean;
}
export declare function useStore<T>(select: (s: ClientStore) => T): T;
export declare function getState(): ClientStore;
export declare const socket: Socket<ServerToClientEvents, ClientToServerEvents>;
export declare function setPlayerName(name: string): void;
export declare function setError(message: string | null): void;
export declare function createRoom(roomName: string, isPrivate: boolean, settings?: Partial<GameSettings>): void;
export declare function joinRoom(roomId: string): void;
export declare function leaveRoom(): void;
export declare function send(action: GameAction): void;
export declare function sendChat(text: string): void;
export declare function updateSettings(settings: Partial<GameSettings>): void;
export declare function addBot(): void;
export declare function kickPlayer(playerId: string): void;
export declare function renameTile(tileId: number, name: string): void;
export declare function addCard(card: CardInput): void;
export declare function removeCard(cardId: string): void;
export declare function refreshRooms(): void;
//# sourceMappingURL=net.d.ts.map