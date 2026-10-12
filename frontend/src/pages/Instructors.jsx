import { Users } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Instructors & Duties UI is not implemented yet. */
export default function Instructors() {
  return (
    <ModulePlaceholder
      icon={Users}
      title="Instructors & Duties"
      description="Teaching staff, their departments and exam duties."
      features={[
        'Maintain instructor profiles and department affiliation',
        'Record teaching load per instructor and term',
        'Assign and review exam invigilation duties',
        'Capture availability and blackout periods',
        'Balance workload fairly across the department',
      ]}
      note="The backend exposes /api/v1/instructors and /api/v1/invigilators; the frontend UI is scheduled for a later phase."
    />
  );
}
