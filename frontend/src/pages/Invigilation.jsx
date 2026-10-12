import { ClipboardCheck } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Invigilation UI is not implemented yet. */
export default function Invigilation() {
  return (
    <ModulePlaceholder
      icon={ClipboardCheck}
      title="Invigilation"
      description="Assignment of invigilators to exams and duty rosters."
      features={[
        'Auto-assign invigilators to each exam',
        'Balance duties fairly across staff',
        'Avoid clashes with teaching and leave',
        'Track attendance and arrange replacements',
        'Export invigilation duty rosters',
      ]}
      note="The backend exposes /api/v1/invigilation and /api/v1/invigilators; the frontend UI is scheduled for a later phase."
    />
  );
}
