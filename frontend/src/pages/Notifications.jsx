import { Bell } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Notifications UI is not implemented yet. */
export default function Notifications() {
  return (
    <ModulePlaceholder
      icon={Bell}
      title="Notifications"
      description="System alerts and delivery preferences."
      features={[
        'In-app notification centre with read / unread state',
        'Email and SMS delivery for schedule changes',
        'Per-user notification preferences',
        'Alerts for conflicts, publications and duty changes',
        'Notification history and audit trail',
      ]}
      note="The Topbar bell stays disabled until this module is implemented. The backend exposes /api/v1/notifications."
    />
  );
}
