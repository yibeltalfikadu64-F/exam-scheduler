import { DoorOpen } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Buildings & Rooms CRUD UI is not implemented yet. */
export default function Rooms() {
  return (
    <ModulePlaceholder
      icon={DoorOpen}
      title="Buildings & Rooms"
      description="Campuses, buildings and the rooms available for exams."
      features={[
        'Create and edit buildings and their rooms',
        'Record seating capacity and layout per room',
        'Tag room type and features (lab, projector, accessible)',
        'Define availability windows for scheduling',
        'Mark rooms closed for maintenance or events',
      ]}
      note="The backend exposes /api/v1/buildings and /api/v1/rooms; the frontend CRUD screens are scheduled for a later phase."
    />
  );
}
