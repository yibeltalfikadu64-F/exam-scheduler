import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  CalendarDays,
  AlertTriangle,
  ClipboardList,
  Search,
  RefreshCw,
  LoaderCircle,
  Send,
  Inbox,
  ShieldAlert,
} from 'lucide-react';

import notificationService from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import '../styles/notifications.css';

/**
 * Notifications (Phase 6/7).
 *
 * The inbox is the caller's own, database-backed notification rows. The
 * delivery queue (masked recipient metadata) is shown to administrators and
 * registrars only. Nothing here is simulated.
 */

const PAGE_SIZE = 8;

const typeConfig = {
  system: { label: 'System', icon: Info },
  exam: { label: 'Exam', icon: CalendarDays },
  conflict: { label: 'Conflict', icon: AlertTriangle },
  schedule: { label: 'Schedule', icon: ClipboardList },
};

function normalizeType(type) {
  const value = String(type || 'info').toLowerCase();
  if (value.includes('exam')) return 'exam';
  if (value.includes('conflict') || value.includes('warn') || value.includes('error')) return 'conflict';
  if (value.includes('schedule') || value.includes('success')) return 'schedule';
  return 'system';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getPayload(response) {
  return response?.data ?? response;
}

function errorText(error) {
  if (error?.status === 403) return 'You do not have permission to perform this action.';
  if (error?.status === 0) return 'Cannot reach the server. Check your connection and try again.';
  return error?.message || 'The request failed. Please try again.';
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canSeeQueue = user?.role === 'admin' || user?.role === 'registrar';
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await notificationService.unreadCount();
      const data = getPayload(response);
      setUnreadCount(Number(data?.count) || 0);
    } catch (countError) {
      // Non-fatal; the badge simply stays stale.
    }
  }, []);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = { page, limit: PAGE_SIZE, channel: 'in_app' };
      if (filter === 'unread') params.unread = true;

      const response = await notificationService.inbox(params);
      const data = getPayload(response);

      setItems(Array.isArray(data?.items) ? data.items : []);
      if (data?.pagination) setPagination(data.pagination);
    } catch (loadError) {
      setError(errorText(loadError));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  const loadQueue = useCallback(async () => {
    if (!canSeeQueue) return;
    setQueueLoading(true);
    setQueueError('');

    try {
      const response = await notificationService.queue({ page: 1, limit: 20 });
      const data = getPayload(response);
      setQueue(Array.isArray(data?.items) ? data.items : []);
    } catch (loadError) {
      setQueueError(errorText(loadError));
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, [canSeeQueue]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(query)
    );
  }, [items, search]);

  async function markAsRead(item) {
    if (item.isRead) return;
    setBusy(true);
    setError('');

    try {
      await notificationService.markRead(item.id);
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, isRead: true } : row))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (markError) {
      setError(errorText(markError));
    } finally {
      setBusy(false);
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0) return;
    setBusy(true);
    setError('');

    try {
      await notificationService.markAllRead();
      setNotice('All notifications marked as read.');
      setUnreadCount(0);
      await loadInbox();
    } catch (markError) {
      setError(errorText(markError));
    } finally {
      setBusy(false);
    }
  }

  function openNotification(item) {
    if (!item.isRead) markAsRead(item);
    if (item.link) {
      if (String(item.link).startsWith('/')) navigate(item.link);
      else window.open(item.link, '_blank', 'noopener');
    }
  }

  async function dispatchQueue() {
    setBusy(true);
    setQueueError('');

    try {
      const response = await notificationService.dispatch();
      const data = getPayload(response);
      setNotice(
        `Dispatch run: ${data?.attempted ?? 0} attempted, ${data?.delivered ?? 0} delivered, ` +
          `${data?.retried ?? 0} retried, ${data?.failed ?? 0} failed.`
      );
      await loadQueue();
    } catch (dispatchError) {
      setQueueError(errorText(dispatchError));
    } finally {
      setBusy(false);
    }
  }

  const readCount = Math.max(0, (Number(pagination.total) || 0) - unreadCount);

  return (
    <main className="notifications-page">
      <header className="notifications-header">
        <div className="notifications-heading">
          <div className="notifications-heading-icon">
            <Bell size={26} />
            {unreadCount > 0 && <span className="notifications-count">{unreadCount}</span>}
          </div>

          <div>
            <h1>Notifications</h1>
            <p>Your in-app alerts, stored and delivered by the system.</p>
          </div>
        </div>

        <div className="notifications-header-actions">
          <button
            type="button"
            className="notification-button notification-button-secondary"
            onClick={() => {
              loadInbox();
              loadUnreadCount();
            }}
            disabled={loading || busy}
          >
            <RefreshCw size={17} className={loading ? 'notification-spinning' : ''} />
            Refresh
          </button>

          <button
            type="button"
            className="notification-button notification-button-secondary"
            onClick={markAllAsRead}
            disabled={busy || unreadCount === 0}
          >
            <CheckCheck size={17} />
            Mark all as read
          </button>
        </div>
      </header>

      <div className="notification-demo-notice" role="status">
        <Info size={19} />
        <div>
          <strong>Live notification centre</strong>
          <p>
            These alerts are loaded from your account&apos;s real notifications.
            Email and SMS delivery depend on the server&apos;s mail configuration.
          </p>
        </div>
      </div>

      {error && (
        <div className="notification-alert notification-alert-error" role="alert">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="notification-alert notification-alert-success" role="status">
          <Check size={18} />
          <span>{notice}</span>
        </div>
      )}

      <section className="notification-stats">
        <article className="notification-stat-card">
          <span className="notification-stat-icon">
            <Bell size={21} />
          </span>
          <div>
            <p>Total notifications</p>
            <strong>{loading ? '—' : pagination.total}</strong>
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
            <strong>{readCount}</strong>
          </div>
        </article>
      </section>

      <section className="notification-panel">
        <div className="notification-toolbar">
          <div className="notification-filter-heading">
            <Inbox size={18} />
            <h2>Notification centre</h2>
          </div>

          <div className="notification-controls">
            <label className="notification-search">
              <Search size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search this page..."
                aria-label="Search notifications"
              />
            </label>

            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter notifications"
              className="notification-filter-select"
            >
              <option value="all">All notifications</option>
              <option value="unread">Unread only</option>
            </select>
          </div>
        </div>

        <div className="notification-list">
          {loading ? (
            <div className="notification-empty-state">
              <LoaderCircle className="notification-spinner" size={34} />
              <h3>Loading notifications</h3>
              <p>Retrieving your alerts from the database…</p>
            </div>
          ) : visibleItems.length > 0 ? (
            visibleItems.map((item) => {
              const key = normalizeType(item.type);
              const config = typeConfig[key];
              const TypeIcon = config.icon;

              return (
                <article
                  key={item.id}
                  className={`notification-item ${item.isRead ? 'is-read' : 'is-unread'}`}
                >
                  <div className={`notification-type-icon type-${key}`}>
                    <TypeIcon size={21} />
                  </div>

                  <div className="notification-item-content">
                    <div className="notification-item-title-row">
                      <h3>{item.title}</h3>
                      {!item.isRead && <span className="notification-unread-label">Unread</span>}
                      {item.priority && item.priority !== 'normal' && (
                        <span className={`notification-priority priority-${String(item.priority).toLowerCase()}`}>
                          {item.priority}
                        </span>
                      )}
                    </div>

                    <p>{item.message}</p>

                    <div className="notification-item-meta">
                      <span>{config.label}</span>
                      <span aria-hidden="true">•</span>
                      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                    </div>
                  </div>

                  <div className="notification-item-actions">
                    {!item.isRead && (
                      <button
                        type="button"
                        className="notification-icon-button"
                        onClick={() => markAsRead(item)}
                        disabled={busy}
                        aria-label={`Mark ${item.title} as read`}
                        title="Mark as read"
                      >
                        <Check size={18} />
                      </button>
                    )}

                    {item.link && (
                      <button
                        type="button"
                        className="notification-icon-button"
                        onClick={() => openNotification(item)}
                        aria-label={`Open ${item.title}`}
                        title="Open"
                      >
                        →
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="notification-empty-state">
              <Bell size={34} />
              <h3>No notifications found</h3>
              <p>
                {filter === 'unread'
                  ? 'You have no unread notifications.'
                  : search
                    ? 'No notifications on this page match your search.'
                    : 'Your notification list is empty.'}
              </p>
            </div>
          )}
        </div>

        {(pagination.totalPages || 1) > 1 && (
          <footer className="notification-pagination">
            <button
              type="button"
              className="notification-pagination-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
            >
              Previous
            </button>
            <span className="notification-pagination-info">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              className="notification-pagination-button"
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || page >= (pagination.totalPages || 1)}
            >
              Next
            </button>
          </footer>
        )}
      </section>

      {canSeeQueue && (
        <section className="notification-queue">
          <div className="notification-queue-heading">
            <div className="notification-filter-heading">
              <Send size={18} />
              <h2>Email delivery queue</h2>
            </div>

            <div className="notifications-header-actions">
              <button
                type="button"
                className="notification-button notification-button-secondary"
                onClick={loadQueue}
                disabled={queueLoading}
              >
                <RefreshCw size={16} className={queueLoading ? 'notification-spinning' : ''} />
                Refresh
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className="notification-button notification-button-primary"
                  onClick={dispatchQueue}
                  disabled={busy || queueLoading}
                >
                  <Send size={16} />
                  Dispatch pending
                </button>
              )}
            </div>
          </div>

          {queueError && (
            <div className="notification-alert notification-alert-error" role="alert">
              <ShieldAlert size={18} />
              <span>{queueError}</span>
            </div>
          )}

          {queueLoading ? (
            <p className="notification-queue-empty">Loading the delivery queue…</p>
          ) : queue.length === 0 ? (
            <p className="notification-queue-empty">
              The delivery queue is empty. Queued email notifications appear here.
            </p>
          ) : (
            <div className="notification-queue-scroll">
              <table className="notification-queue-table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Retries</th>
                    <th>Created</th>
                    <th>Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr key={row.id}>
                      <td>{row.recipient || '—'}</td>
                      <td>{row.channel}</td>
                      <td>
                        <span className={`notification-status status-${String(row.status).toLowerCase()}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>{row.retryCount}</td>
                      <td>{formatDate(row.createdAt)}</td>
                      <td className="notification-queue-error">{row.lastError || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <p className="notification-footer-note">
        Notifications are generated by schedule and exam events. Delivery
        preferences are configured in System Settings.
      </p>
    </main>
  );
}
