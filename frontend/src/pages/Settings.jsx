import { Settings } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the System Settings UI is not implemented yet. */
export default function SystemSettings() {
  return (
    <ModulePlaceholder
      icon={Settings}
      title="System Settings"
      description="University-wide configuration and scheduling defaults."
      features={[
        'Academic year and term configuration',
        'Default scheduling constraints',
        'Notification and delivery defaults',
        'Institution branding and theme preferences',
        'Overview of role permissions',
      ]}
      note="Settings that affect scheduling will be wired up alongside the scheduling engine in a later phase."
    />
  );
}
