import { Building2 } from 'lucide-react';

import ModulePlaceholder from '../components/common/ModulePlaceholder';

/** Placeholder — the Departments & Programs CRUD UI is not implemented yet. */
export default function Departments() {
  return (
    <ModulePlaceholder
      icon={Building2}
      title="Departments & Programs"
      description="Faculties, departments and the degree programs they offer."
      features={[
        'Create and edit departments (code, name, faculty)',
        'Manage programs and link each to its department',
        'Assign a department head',
        'Activate or deactivate departments and programs',
        'Review dependencies before deactivation',
      ]}
      note="The backend exposes /api/v1/departments and /api/v1/programs; the frontend CRUD screens are scheduled for a later phase."
    />
  );
}
