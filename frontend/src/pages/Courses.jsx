import { BookOpen } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Courses & Sections CRUD UI is not implemented yet. */
export default function Courses() {
  return (
    <ModulePlaceholder
      icon={BookOpen}
      title="Courses & Sections"
      description="Course catalogue and the sections offered each term."
      features={[
        'Create and edit courses (code, title, credit units, level)',
        'Define sections per course and academic term',
        'Assign an instructor to each section',
        'Track expected enrolment per section',
        'Link courses to their program and department',
      ]}
      note="The backend exposes /api/v1/courses and /api/v1/sections; the frontend CRUD screens are scheduled for a later phase."
    />
  );
}
