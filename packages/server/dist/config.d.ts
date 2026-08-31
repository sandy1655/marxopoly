export declare const config: {
    port: number;
    clientOrigin: string;
    /** How long a disconnected player keeps their seat. */
    reconnectGraceMs: number;
    turnTimeoutSeconds: number;
    /** Rooms with no connected players are swept after this long. */
    emptyRoomTtlMs: number;
    botThinkMs: number;
    isProd: boolean;
    /** ngrok tunnel — `pnpm share`, `--share`, or SHARE=1 / NGROK=1. */
    share: boolean;
    /** Required for `pnpm share`. Put it in `.env`; the SDK ignores the ngrok CLI config. */
    ngrokAuthtoken: string | undefined;
    /** Optional reserved domain, e.g. "my-game.ngrok.app". */
    ngrokDomain: string | undefined;
};
//# sourceMappingURL=config.d.ts.map