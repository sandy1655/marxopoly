import { MAPS, setMapId, useMapId } from '../maps/index.js';

/**
 * Lets each player pick their own board skin. The choice is local (stored in
 * this browser) and never leaves the client, so different players at the same
 * table can use different maps.
 */
export default function MapPicker({ compact = false }: { compact?: boolean }) {
  const mapId = useMapId();
  const active = MAPS.find((m) => m.id === mapId);

  return (
    <label className={`map-picker${compact ? ' compact' : ''}`}>
      <span>Map</span>
      <select
        className="input"
        value={mapId}
        title={active?.description}
        onChange={(e) => setMapId(e.target.value)}
      >
        {MAPS.map((m) => (
          <option key={m.id} value={m.id} title={m.description}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}
