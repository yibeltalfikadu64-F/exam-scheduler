import { AlertTriangle } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';
import ConflictAlerts from '../components/dashboard/ConflictAlerts';

/**
 * Placeholder — conflict detection is not implemented yet.
 *
 * The sample list reuses the dashboard's <ConflictAlerts /> component and is
 * clearly labelled as sample data; it is not produced by a real constraint
 * checker.
 */
export default function Conflicts() {
  return (
    <ModulePlaceholder
      icon={AlertTriangle}
      title="Conflicts"
      description="Constraint violations detected in the exam schedule."
      features={[
        'Detect hard conflicts (room / cohort / invigilator clashes)',
        'Flag soft conflicts (capacity, fairness, spread)',
        'Rank conflicts by severity',
        'Resolve a conflict directly or reschedule the exam',
        'Acknowledge and re-validate after edits',
      ]}
      note="The conflict-detection engine arrives with the scheduling engine in a later phase."
    >
      <section className="panel">
        <div className="panel-header">
          <h3>Sample conflicts</h3>
          <span className="badge badge-neutral">Sample data</span>
        </div>
        <div className="panel-body">
          <ConflictAlerts />
        </div>
      </section>
    </ModulePlaceholder>
  );
}
