import { GraduationCap } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Students & Enrollments UI is not implemented yet. */
export default function Students() {
  return (
    <ModulePlaceholder
      icon={GraduationCap}
      title="Students & Enrollments"
      description="Student records and their enrolment in course sections."
      features={[
        'Register individual students and import cohorts',
        'Enrol students in course sections',
        'View enrolment counts per section and course',
        'Adjust program, level and academic standing',
        'Withdraw or transfer students between sections',
      ]}
      note="The backend exposes /api/v1/students and section enrolment endpoints; the frontend UI is scheduled for a later phase."
    />
  );
}
