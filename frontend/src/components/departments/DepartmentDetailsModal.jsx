import { useEffect, useState } from 'react';
import { Pencil, Power } from 'lucide-react';

import Modal from '../common/Modal';
import Badge from '../common/Badge';
import LoadingSpinner from '../common/LoadingSpinner';
import departmentService from '../../services/departmentService';
import { formatDateTime } from '../../utils/userMeta';

export default function DepartmentDetailsModal({ departmentId, onClose, onEdit, onToggleStatus }) {
  const [state, setState] = useState({ status: 'loading', department: null, error: null });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', department: null, error: null });
    departmentService
      .get(departmentId)
      .then((response) => {
        if (active) setState({ status: 'ready', department: response.data.department, error: null });
      })
      .catch((error) => {
        if (active) setState({ status: 'error', department: null, error: error.message || 'Could not load department.' });
      });
    return () => {
      active = false;
    };
  }, [departmentId]);

  const department = state.department;

  return (
    <Modal
      title="Department details"
      subtitle={department ? `${department.code} — ${department.name}` : 'Loading…'}
      onClose={onClose}
      footer={
        department ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => onEdit(department)}>
              <Pencil size={16} /> Edit
            </button>
            <button
              type="button"
              className={`btn ${department.isActive ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => onToggleStatus(department)}
            >
              <Power size={16} /> {department.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </>
        ) : null
      }
    >
      {state.status === 'loading' ? <LoadingSpinner label="Loading department…" /> : null}

      {state.status === 'error' ? (
        <div className="notice notice-danger" role="alert">
          {state.error}
        </div>
      ) : null}

      {state.status === 'ready' && department ? (
        <dl className="detail-list">
          <dt>Code</dt>
          <dd className="mono">{department.code}</dd>
          <dt>Name</dt>
          <dd>{department.name}</dd>
          <dt>Description</dt>
          <dd>{department.description || '—'}</dd>
          <dt>Department head</dt>
          <dd>
            {department.head ? `${department.head.fullName} ${department.head.username ? `(@${department.head.username})` : ''}` : '—'}
          </dd>
          <dt>Status</dt>
          <dd>
            <Badge tone={department.isActive ? 'success' : 'danger'}>{department.isActive ? 'Active' : 'Inactive'}</Badge>
          </dd>
          <dt>Programs</dt>
          <dd>{department.programCount}</dd>
          <dt>Courses</dt>
          <dd>{department.courseCount}</dd>
          <dt>Created</dt>
          <dd>{formatDateTime(department.createdAt)}</dd>
          <dt>Updated</dt>
          <dd>{formatDateTime(department.updatedAt)}</dd>
        </dl>
      ) : null}
    </Modal>
  );
}
