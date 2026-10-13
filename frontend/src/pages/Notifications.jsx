import { useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  CalendarDays,
  AlertTriangle,
  ClipboardList,
  Search,
  Trash2,
  Filter,
} from 'lucide-react';
import '../styles/notifications.css';

const initialNotifications = [
  {
    id: 1,
    title: 'Welcome to Exam Scheduler',
    message: 'Your notification centre is ready to preview.',
    type: 'system',
    date: new Date().toISOString(),
    read: false,
  },
  {
    id: 2,
    title: 'Exam schedule reminder',
    message: 'This sample notification demonstrates exam reminders.',
    type: 'exam',
    date: new Date(Date.now() - 3600000).toISOString(),
    read: false,
  },
  {
    id: 3,
    title: 'Schedule review',
    message: 'Review draft schedules before publishing them.',
    type: 'schedule',
    date: new Date(Date.now() - 86400000).toISOString(),
    read: true,
  },
];

const typeConfig = {
  system: { label: 'System', icon: Info },
  exam: { label: 'Exam', icon: CalendarDays },
  conflict: { label: 'Conflict', icon: AlertTriangle },
  schedule: { label: 'Schedule', icon: ClipboardList },
};

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function Notifications() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const unreadCount = notifications.filter((item) => !item.read).length;

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notifications.filter((item) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'unread' && !item.read) ||
        (filter === 'read' && item.read);

      const matchesSearch =
        !query ||
        `${item.title} ${item.message} ${item.type}`
          .toLowerCase()
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [notifications, filter, search]);

  function markAsRead(id) {
    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  }

  function markAllAsRead() {
    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true }))
    );
  }

  function removeNotification(id) {
    setNotifications((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  function clearAll() {
    setNotifications([]);
  }

  return (
    <main className="notifications-page">
      <header className="notifications-header">
        <div className="notifications-heading">
          <div className="notifications-heading-icon">
            <Bell size={26} />
            {unreadCount > 0 && (
              <span className="notifications-count">{unreadCount}</span>
            )}
          </div>

          <div>
            <h1>Notifications</h1>
            <p>View and manage sample alerts in your notification centre.</p>
          </div>
        </div>

        <div className="notifications-header-actions">
          <button
            type="button"
            className="notification-button notification-button-secondary"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={17} />
            Mark all as read
          </button>

          <button
            type="button"
            className="notification-button notification-button-danger"
            onClick={clearAll}
            disabled={notifications.length === 0}
          >
            <Trash2 size={17} />
            Clear all
          </button>
        </div>
      </header>

      <div className="notification-demo-notice" role="status">
        <Info size={19} />
        <div>
          <strong>Frontend demo mode</strong>
          <p>
            These are sample notifications stored in page memory only.
            Changes are not saved to a database and will reset when the page
            is reloaded. Email and SMS delivery are not enabled.
          </p>
        </div>
      </div>

      <section className="notification-stats">
        <article className="notification-stat-card">
          <span className="notification-stat-icon">
            <Bell size={21} />
          </span>
          <div>
            <p>Total notifications</p>
            <strong>{notifications.length}</strong>
          </div>
        </article>

        <article className="notification-stat-card">
          <span className="notification-stat-icon unread">
            <Info size={21} />
          </span>
          <div>
            <p>Unread</p>
            <strong>{unreadCount}</strong>
          </div>
        </article>

        <article className="notification-stat-card">
          <span className="notification-stat-icon read">
            <Check size={21} />
          </span>
          <div>
            <p>Read</p>
            <strong>{notifications.length - unreadCount}</strong>
          </div>
        </article>
      </section>

      <section className="notification-panel">
        <div className="notification-toolbar">
          <div className="notification-filter-heading">
            <Filter size={18} />
            <h2>Notification centre</h2>
          </div>

          <div className="notification-controls">
            <label className="notification-search">
              <Search size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notifications..."
                aria-label="Search notifications"
              />
            </label>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter notifications"
              className="notification-filter-select"
            >
              <option value="all">All notifications</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
        </div>

        <div className="notification-list">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((item) => {
              const config = typeConfig[item.type] || typeConfig.system;
              const TypeIcon = config.icon;

              return (
                <article
                  key={item.id}
                  className={`notification-item ${item.read ? 'is-read' : 'is-unread'}`}
                >
                  <div className={`notification-type-icon type-${item.type}`}>
                    <TypeIcon size={21} />
                  </div>

                  <div className="notification-item-content">
                    <div className="notification-item-title-row">
                      <h3>{item.title}</h3>
                      {!item.read && (
                        <span className="notification-unread-label">
                          Unread
                        </span>
                      )}
                    </div>

                    <p>{item.message}</p>

                    <div className="notification-item-meta">
                      <span>{config.label}</span>
                      <span aria-hidden="true">•</span>
                      <time dateTime={item.date}>{formatDate(item.date)}</time>
                    </div>
                  </div>

                  <div className="notification-item-actions">
                    {!item.read && (
                      <button
                        type="button"
                        className="notification-icon-button"
                        onClick={() => markAsRead(item.id)}
                        aria-label={`Mark ${item.title} as read`}
                        title="Mark as read"
                      >
                        <Check size={18} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="notification-icon-button delete"
                      onClick={() => removeNotification(item.id)}
                      aria-label={`Delete ${item.title}`}
                      title="Remove notification"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="notification-empty-state">
              <Bell size={34} />
              <h3>No notifications found</h3>
              <p>
                {notifications.length === 0
                  ? 'Your sample notification list is empty.'
                  : 'Try another filter or search term.'}
              </p>

              {notifications.length === 0 && (
                <button
                  type="button"
                  className="notification-button notification-button-secondary"
                  onClick={() => {
                    setNotifications(initialNotifications);
                    setFilter('all');
                    setSearch('');
                  }}
                >
                  Restore sample notifications
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <p className="notification-footer-note">
        Planned for a future phase: real user notifications, database
        persistence, notification preferences, and email/SMS delivery.
      </p>
    </main>
  );
}