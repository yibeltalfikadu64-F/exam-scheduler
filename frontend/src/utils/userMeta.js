/**
 * Shared helpers for presenting user records consistently across the page.
 */

export const ROLE_LABELS = {
  admin: 'Admin',
  registrar: 'Registrar',
  department_head: 'Department Head',
  instructor: 'Instructor',
  student: 'Student',
};

const ROLE_TONES = {
  admin: 'primary',
  registrar: 'info',
  department_head: 'success',
  instructor: 'neutral',
  student: 'neutral',
};

export function roleTone(role) {
  return ROLE_TONES[role] || 'neutral';
}

/** Formats an ISO/SQL datetime for display, or an em dash when absent. */
export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
