import { CalendarClock } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Time Slots & Periods CRUD UI is not implemented yet. */
export default function TimeSlots() {
  return (
    <ModulePlaceholder
      icon={CalendarClock}
      title="Time Slots & Periods"
      description="Exam periods and the daily sessions exams can be placed in."
      features={[
        'Define academic years and exam periods',
        'Create daily time slots and their durations',
        'Mark restricted or unavailable slots',
        'Set default slot length per period',
        'Reorder and retire obsolete slots',
      ]}
      note="The backend exposes /api/v1/time-slots and /api/v1/academic-years; the frontend CRUD screens are scheduled for a later phase."
    />
  );
}
