import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

import EmptyState from '../common/EmptyState';
import { mockConflicts } from '../../data/mockData';

function severityIcon(severity) {
  if (severity === 'critical' || severity === 'high') return ShieldAlert;
  if (severity === 'medium') return AlertTriangle;
  return Info;
}

/**
 * Conflict alerts panel. Renders PROTOTYPE data until the conflict-detection
 * engine (Phase 7) is implemented.
 */
export default function ConflictAlerts({ conflicts = mockConflicts }) {
  if (!conflicts.length) {
    return <EmptyState title="No conflicts detected" description="This schedule currently satisfies all hard constraints." />;
  }

  return (
    <div className="conflict-list">
      {conflicts.map((conflict) => {
        const Icon = severityIcon(conflict.severity);
        return (
          <div className={`conflict-item conflict-sev-${conflict.severity}`} key={conflict.id}>
            <span className="icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div className="conflict-body">
              <div className="title">{conflict.title}</div>
              <div className="desc">{conflict.description}</div>
              <div className="place">{conflict.type} · {conflict.place}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
