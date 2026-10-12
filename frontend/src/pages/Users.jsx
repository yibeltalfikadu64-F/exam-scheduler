import { useCallback, useEffect, useState } from 'react';
import { Eye, KeyRound, Pencil, Plus, Power, RefreshCw, Search, Users as UsersIcon } from 'lucide-react';

import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/users/ConfirmDialog';
import ResetPasswordModal from '../components/users/ResetPasswordModal';
import UserDetailsModal from '../components/users/UserDetailsModal';
import UserFormModal from '../components/users/UserFormModal';
import userService from '../services/userService';
import { ROLE_LABELS, roleTone, formatDateTime } from '../utils/userMeta';

const DEFAULT_QUERY = {
  page: 1,
  limit: 10,
  search: '',
  role: '',
  status: 'all',
  sort: 'created_at',
  order: 'desc',
};

/**
 * Users & Roles management page (Phase 2).
 *
 * Talks to the real /api/v1/users endpoints — no mock data. Backend
 * authorization (admin-only) is the real gate; this page is only reachable by
 * an administrator through RoleRoute.
 */
export default function Users() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [searchInput, setSearchInput] = useState('');
  const [list, setList] = useState({ status: 'loading', items: [], pagination: null, error: null });
  const [options, setOptions] = useState({ roles: [], departments: [] });
  const [banner, setBanner] = useState(null);
  const [formState, setFormState] = useState(null); // { mode: 'create' | 'edit', user }
  const [detailsId, setDetailsId] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [confirm, setConfirm] = useState(null); // { user, nextActive }
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Filter options (roles + departments) — loaded once.
  useEffect(() => {
    userService
      .options()
      .then((response) => setOptions(response.data))
      .catch(() => {
        /* filters silently fall back to text-only */
      });
  }, []);

  const loadUsers = useCallback(async () => {
    setList((previous) => ({ ...previous, status: 'loading', error: null }));
    try {
      const response = await userService.list(query);
      setList({ status: 'ready', items: response.data.items, pagination: response.data.pagination, error: null });
    } catch (error) {
      setList({
        status: 'error',
        items: [],
        pagination: null,
        error: error.message || 'Could not load users.',
      });
    }
  }, [query]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Debounce the search box into the query.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery((previous) => (previous.search === searchInput ? previous : { ...previous, search: searchInput, page: 1 }));
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const openCreate = () => setFormState({ mode: 'create', user: null });
  const openEdit = (user) => {
    setDetailsId(null);
    setFormState({ mode: 'edit', user });
  };

  const handleSaved = (message) => {
    setFormState(null);
    setBanner({ tone: 'success', message });
    loadUsers();
  };

  const handleResetDone = (message) => {
    setResetUser(null);
    setBanner({ tone: 'success', message });
  };

  const askToggleStatus = (user) => {
    setDetailsId(null);
    setConfirm({ user, nextActive: !user.isActive });
  };

  const confirmToggleStatus = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await userService.setStatus(confirm.user.id, confirm.nextActive);
      setBanner({
        tone: 'success',
        message: `User “${confirm.user.username}” ${confirm.nextActive ? 'activated' : 'deactivated'}.`,
      });
      setConfirm(null);
      loadUsers();
    } catch (error) {
      setBanner({ tone: 'danger', message: error.message || 'Could not change the account status.' });
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const pagination = list.pagination;
  const loading = list.status === 'loading';
  const showEmpty = list.status === 'ready' && list.items.length === 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Users &amp; Roles</h2>
          <p>Create accounts, assign roles, and control access.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> New user
        </button>
      </div>

      {banner ? (
        <div className={`notice notice-${banner.tone}`} role="status" style={{ marginBottom: 'var(--space-4)' }}>
          <span className="grow">{banner.message}</span>
          <button type="button" className="btn btn-subtle" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-header users-toolbar">
          <div className="users-toolbar-filters">
            <div className="users-search">
              <Search size={16} aria-hidden="true" />
              <label className="sr-only" htmlFor="users-search">
                Search users
              </label>
              <input
                id="users-search"
                className="input"
                type="search"
                placeholder="Search name, username, email…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <label className="sr-only" htmlFor="users-role-filter">
              Filter by role
            </label>
            <select
              id="users-role-filter"
              className="input users-select"
              value={query.role}
              onChange={(event) => setQuery((previous) => ({ ...previous, role: event.target.value, page: 1 }))}
            >
              <option value="">All roles</option>
              {options.roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role] || role}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="users-status-filter">
              Filter by status
            </label>
            <select
              id="users-status-filter"
              className="input users-select"
              value={query.status}
              onChange={(event) => setQuery((previous) => ({ ...previous, status: event.target.value, page: 1 }))}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={loadUsers}
              disabled={loading}
              title="Reload users"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading users…" />
        ) : list.status === 'error' ? (
          <div className="panel-body">
            <div className="notice notice-danger" role="alert">
              <span className="grow">{list.error}</span>
              <button type="button" className="btn btn-subtle" onClick={loadUsers}>
                Try again
              </button>
            </div>
          </div>
        ) : showEmpty ? (
          <EmptyState
            icon={UsersIcon}
            title="No users found"
            description="Adjust the search or filters, or create a new user."
            action={
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <Plus size={16} /> New user
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Department</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last login</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="users-cell">
                        <strong>{user.fullName}</strong>
                        <span className="text-xs text-muted mono">@{user.username}</span>
                      </span>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <Badge tone={roleTone(user.role)}>{ROLE_LABELS[user.role] || user.role}</Badge>
                    </td>
                    <td>{user.department ? user.department.code : '—'}</td>
                    <td>
                      <Badge tone={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="text-sm text-muted">{formatDateTime(user.lastLogin)}</td>
                    <td>
                      <span className="users-actions">
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => setDetailsId(user.id)}
                          aria-label={`View ${user.username}`}
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => openEdit(user)}
                          aria-label={`Edit ${user.username}`}
                          title="Edit user"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => askToggleStatus(user)}
                          aria-label={`${user.isActive ? 'Deactivate' : 'Activate'} ${user.username}`}
                          title={user.isActive ? 'Deactivate account' : 'Activate account'}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => setResetUser(user)}
                          aria-label={`Reset password for ${user.username}`}
                          title="Reset password"
                        >
                          <KeyRound size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {list.status === 'ready' && pagination ? (
          <div className="users-pagination">
            <span className="users-pagination-meta">
              {pagination.total} {pagination.total === 1 ? 'user' : 'users'} · page {pagination.page} of{' '}
              {pagination.totalPages}
            </span>
            <div className="users-pagination-controls">
              <label className="sr-only" htmlFor="users-page-size">
                Rows per page
              </label>
              <select
                id="users-page-size"
                className="input"
                value={query.limit}
                onChange={(event) =>
                  setQuery((previous) => ({ ...previous, limit: Number(event.target.value), page: 1 }))
                }
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page - 1 }))}
                disabled={!pagination.hasPrev || loading}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page + 1 }))}
                disabled={!pagination.hasNext || loading}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {formState ? (
        <UserFormModal
          mode={formState.mode}
          user={formState.user}
          options={options}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {detailsId ? (
        <UserDetailsModal
          userId={detailsId}
          onClose={() => setDetailsId(null)}
          onEdit={openEdit}
          onToggleStatus={askToggleStatus}
          onResetPassword={(user) => {
            setDetailsId(null);
            setResetUser(user);
          }}
        />
      ) : null}

      {resetUser ? (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onDone={handleResetDone} />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={confirm.nextActive ? 'Activate account' : 'Deactivate account'}
          tone={confirm.nextActive ? 'primary' : 'danger'}
          confirmLabel={confirm.nextActive ? 'Activate' : 'Deactivate'}
          busy={confirmBusy}
          message={
            confirm.nextActive
              ? `Reactivate “${confirm.user.fullName}”? They will be able to sign in again.`
              : `Deactivate “${confirm.user.fullName}”? They will be signed out and blocked from signing in until reactivated.`
          }
          onConfirm={confirmToggleStatus}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
