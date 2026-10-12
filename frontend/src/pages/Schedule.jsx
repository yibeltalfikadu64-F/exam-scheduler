import { CalendarDays } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Schedule Calendar UI is not implemented yet. */
export default function Schedule() {
  return (
    <ModulePlaceholder
      icon={CalendarDays}
      title="Schedule Calendar"
      description="The exam timetable across periods, rooms and cohorts."
      features={[
        'Calendar view (day / week / month) of scheduled exams',
        'Manually place or drag exams onto slots and rooms',
        'Filter by department, course, room or cohort',
        'Save, validate and publish scheduling drafts',
        'Export the timetable to PDF / ICS',
      ]}
      note="react-big-calendar is already a project dependency, so the calendar view can be added without introducing new libraries. The scheduling engine (Phase 7) and this UI land in a later phase."
    />
  );
}
