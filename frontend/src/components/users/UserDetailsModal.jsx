import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Power } from 'lucide-react';

import Modal from '../common/Modal';
import Badge from '../common/Badge';
import LoadingSpinner from '../common/LoadingSpinner';
import userService from '../../services/userService';
import { ROLE_LABELS, roleTone, formatDateTime } from '../../utils/userMeta';

/**
 * Read-only user details dialog. Fetches the freshest record from the API
 * (GET /users/:id) so it demonstrates the "view individual user details" path.
 */
export default function UserDetailsModal({ userId, onClose, onEdit, onToggleStatus, onResetPassword }) {
  const [state, setState] = useState({ status: 'loading', user: null, error: null });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', user: null, error: null });
    userService
      .get(userId)
      .then((response) => {
        if (active) setState({ status: 'ready', user: response.data.user, error: null });
      })
      .catch((error) => {
        if (active) setState({ status: 'error', user: null, error: error.message || 'Could not load the user.' });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const user = state.user;

  return (
    <Modal
      title="User details"
      subtitle={user ? `@${user.username}` : 'Loading…'}
      onClose={onClose}
      footer={
        user ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => onResetPassword(user)}>
              <KeyRound size={16} /> Reset password
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onEdit(user)}>
              <Pencil size={16} /> Edit
            </button>
            <button
              type="button"
              className={`btn ${user.isActive ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => onToggleStatus(user)}
            >
              <Power size={16} /> {user.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </>
        ) : null
      }
    >
      {state.status === 'loading' ? <LoadingSpinner label="Loading user…" /> : null}

      {state.status === 'error' ? (
        <div className="notice notice-danger" role="alert">
          {state.error}
        </div>
      ) : null}

      {state.status === 'ready' && user ? (
        <dl className="detail-list">
          <dt>Full name</dt>
          <dd>{user.fullName}</dd>
          <dt>Username</dt>
          <dd className="mono">{user.username}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>
            <Badge tone={roleTone(user.role)}>{ROLE_LABELS[user.role] || user.role}</Badge>
          </dd>
          <dt>Department</dt>
          <dd>{user.department ? `${user.department.name} (${user.department.code})` : '—'}</dd>
          <dt>Phone</dt>
          <dd>{user.phone || '—'}</dd>
          <dt>Status</dt>
          <dd>
            <Badge tone={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
            {user.isVerified ? <span className="text-xs text-muted" style={{ marginLeft: 8 }}>Verified</span> : null}
          </dd>
          <dt>Last login</dt>
          <dd>{formatDateTime(user.lastLogin)}</dd>
          <dt>Created</dt>
          <dd>{formatDateTime(user.createdAt)}</dd>
          <dt>Updated</dt>
          <dd>{formatDateTime(user.updatedAt)}</dd>
        </dl>
      ) : null}
    </Modal>
  );
}
