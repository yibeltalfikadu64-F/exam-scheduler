import { Inbox } from 'lucide-react';

/**
 * Consistent empty-state block used by tables and panels.
 */
export default function EmptyState({ title = 'Nothing here yet', description, icon: Icon = Inbox, action = null }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon size={24} strokeWidth={1.8} />
      </span>
      <span className="empty-state-title">{title}</span>
      {description ? <span className="text-sm">{description}</span> : null}
      {action}
    </div>
  );
}
