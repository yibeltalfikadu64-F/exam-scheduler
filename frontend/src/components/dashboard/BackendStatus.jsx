import { RefreshCw, Server } from 'lucide-react';

/**
 * Live backend/database status widget.
 *
 * This is REAL integration: it calls GET /api/v1/health through the Axios
 * service layer, so it reflects the actual Express + MySQL state.
 */
export default function BackendStatus({ state, payload, error, onRefresh, apiBaseUrl }) {
  const dotClass =
    state === 'online' ? 'online' : state === 'offline' ? 'offline' : 'unknown';

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title row gap-2">
          <Server size={16} /> Backend status
        </span>
        <button
          type="button"
          className="btn btn-subtle"
          onClick={onRefresh}
          disabled={state === 'loading'}
          aria-label="Refresh backend status"
        >
          <RefreshCw size={14} className={state === 'loading' ? 'spin' : ''} /> Refresh
        </button>
      </div>
      <div className="card-body stack gap-3">
        <div className="backend-status">
          <span className={`status-dot ${dotClass}`} aria-hidden="true" />
          <div className="stack">
            <strong style={{ fontSize: 'var(--fs-sm)' }}>
              {state === 'loading' && 'Checking…'}
              {state === 'online' && 'API and database are reachable'}
              {state === 'offline' && 'API is not reachable'}
            </strong>
            <span className="text-xs text-muted mono">{apiBaseUrl}</span>
          </div>
        </div>

        {state === 'online' && payload ? (
          <dl className="stack gap-2 text-sm">
            <div className="row-between">
              <dt className="text-muted">Application</dt>
              <dd className="mono">
                {payload.application.name} v{payload.application.version}
              </dd>
            </div>
            <div className="row-between">
              <dt className="text-muted">Environment</dt>
              <dd className="mono">{payload.application.environment}</dd>
            </div>
            <div className="row-between">
              <dt className="text-muted">Database</dt>
              <dd className="mono">
                {payload.database.connected ? `${payload.database.name} (${payload.database.version})` : 'unavailable'}
              </dd>
            </div>
            <div className="row-between">
              <dt className="text-muted">DB latency</dt>
              <dd className="mono">{payload.database.latencyMs} ms</dd>
            </div>
          </dl>
        ) : null}

        {state === 'offline' ? (
          <div className="notice notice-warning">
            {error || 'Start the backend with "npm run dev:backend" and reload.'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
