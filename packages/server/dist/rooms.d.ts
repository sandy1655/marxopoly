import { type ChatMessage, type GameAction, type GameSettings, type GameState, type RoomSummary } from '@marxopoly/shared';
export interface Room {
    id: string;
    name: string;
    hostId: string;
    isPrivate: boolean;
    createdAt: number;
    state: GameState;
    /** playerId -> reconnect token. */
    tokens: Map<string, string>;
    /** playerId -> epoch ms after which the reconnect token is refused. */
    tokenExpiry: Map<string, number>;
    /** playerId -> socket id, only for connected players. */
    sockets: Map<string, string>;
    chat: ChatMessage[];
    /** Socket ids currently watching without a seat. */
    spectatorSockets: Set<string>;
    /** playerId -> timer that forfeits the seat if they never come back. */
    dropTimers: Map<string, NodeJS.Timeout>;
    botTimer: NodeJS.Timeout | null;
    lastActivity: number;
}
export type RoomListener = (room: Room) => void;
export declare class RoomManager {
    private rooms;
    private onChange;
    private onChat;
    private ticker;
    bind(onChange: RoomListener, onChat: (room: Room, message: ChatMessage) => void): void;
    start(): void;
    stop(): void;
    get(roomId: string): Room | undefined;
    list(): RoomSummary[];
    create(opts: {
        roomName: string;
        playerName: string;
        isPrivate: boolean;
        settings?: Partial<GameSettings>;
    }): {
        room: Room;
        playerId: string;
        token: string;
    };
    join(roomId: string, playerName: string, token: string | undefined, socketId: string): {
        ok: true;
        room: Room;
        playerId: string;
        token: string;
        displacedSocketId?: string;
    } | {
        ok: true;
        room: Room;
        spectator: true;
    } | {
        ok: false;
        error: string;
    };
    addBot(room: Room, requesterId: string): string | null;
    kick(room: Room, requesterId: string, targetId: string): string | null;
    updateSettings(room: Room, requesterId: string, settings: Partial<GameSettings>): string | null;
    renameTile(room: Room, requesterId: string, tileId: number, name: string): string | null;
    addCard(room: Room, requesterId: string, input: unknown): string | null;
    removeCard(room: Room, requesterId: string, cardId: string): string | null;
    leave(room: Room, playerId: string): void;
    /** A viewer closed the tab or left; drop them from the watch set. */
    leaveSpectator(room: Room, socketId: string): void;
    /** Called when a socket drops; the seat is held open for the grace period. */
    markDisconnected(room: Room, playerId: string): void;
    dispatch(room: Room, playerId: string, action: GameAction, spectator?: boolean): string | null;
    private dispatchInternal;
    chat(room: Room, playerId: string, text: string): void;
    private tick;
    /** Bots act on a short delay so a human can follow what happened. */
    private scheduleBot;
    destroy(roomId: string): void;
    private emit;
}
//# sourceMappingURL=rooms.d.ts.map