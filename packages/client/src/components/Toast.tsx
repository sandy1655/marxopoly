import { setError, useStore } from '../net.js';

export default function Toast() {
  const error = useStore((s) => s.error);
  if (!error) return null;
  return (
    <div className="toast" role="status" onClick={() => setError(null)}>
      {error}
    </div>
  );
}
