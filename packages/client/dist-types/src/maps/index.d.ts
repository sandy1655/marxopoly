import type { MapDefinition } from './types.js';
export type { MapDefinition, SpecialTileStyle } from './types.js';
export type { BoardLayout, Edge } from './layout.js';
export { ringLayout, tokenSpot } from './layout.js';
/**
 * Every board skin the player can choose from. Add a new map by dropping a
 * file next to this one and listing its export here — nothing else needs to
 * change.
 */
export declare const MAPS: readonly MapDefinition[];
export declare const DEFAULT_MAP_ID: string;
export declare function getMap(id: string | null | undefined): MapDefinition;
export declare function getMapId(): string;
export declare function setMapId(id: string): void;
/** The id of the map this player has chosen. */
export declare function useMapId(): string;
/** The map this player has chosen. */
export declare function useMap(): MapDefinition;
//# sourceMappingURL=index.d.ts.map