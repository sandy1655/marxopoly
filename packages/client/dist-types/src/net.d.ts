import { type Socket } from 'socket.io-client';
import type { CardInput, ChatMessage, ClientToServerEvents, GameAction, GameSettings, GameState, RoomSummary, ServerToClientEvents } from '@marxopoly/shared';
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
    /** True when this tab joined a game in progress as a watch-only viewer. */
    spectator: boolean;
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
/**
 * Give up while staying in the room. Runs the same engine forfeit as leaving
 * the table (properties back to the bank, cash to zero, game ends if one player
 * is left), but the socket stays put so you can watch the rest of the game.
 */
export declare function reportBankrupt(): void;
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