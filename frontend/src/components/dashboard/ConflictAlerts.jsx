
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

import EmptyState from '../common/EmptyState';

function severityIcon(severity) {
  if (severity === 'critical' || severity === 'high') return ShieldAlert;
  if (severity === 'medium') return AlertTriangle;
  return Info;
}

export default function ConflictAlerts({ conflicts = [], loading = false }) {
  if (loading) {
    return (
      <EmptyState
        title="Loading conflicts..."
        description="Checking recorded scheduling conflicts."
      />
    );
  }

  if (!conflicts.length) {
    return (
      <EmptyState
        title="No open conflicts"
        description="There are currently no unresolved conflict records in the database."
      />
    );
  }

  return (
    <div className="conflict-list">
      {conflicts.map((conflict) => {
        const Icon = severityIcon(conflict.severity);

        return (
          <div
            className={`conflict-item conflict-sev-${conflict.severity}`}
            key={conflict.id}
          >
            <span className="icon" aria-hidden="true">
              <Icon size={18} />
            </span>

            <div className="conflict-body">
              <div className="title">{conflict.title}</div>
              <div className="desc">
                {conflict.description || 'No additional description recorded.'}
              </div>
              <div className="place">
                {conflict.type}
                {conflict.place ? ` · ${conflict.place}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
