import { BarChart3 } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Reports & Analytics UI is not implemented yet. */
export default function Reports() {
  return (
    <ModulePlaceholder
      icon={BarChart3}
      title="Reports & Analytics"
      description="Insights and exports across the exam schedule."
      features={[
        'Exam load per department, course and level',
        'Room utilisation and capacity reports',
        'Conflict trends over time',
        'Invigilation fairness and workload reports',
        'Export reports to CSV / PDF',
      ]}
      note="recharts is already a project dependency, so charts can be added without new libraries. Reporting is scheduled for a later phase."
    />
  );
}
