import { useEffect, useState } from 'react';
import { Pencil, Power } from 'lucide-react';

import Modal from '../common/Modal';
import Badge from '../common/Badge';
import LoadingSpinner from '../common/LoadingSpinner';
import programService from '../../services/programService';
import { formatDateTime } from '../../utils/userMeta';

export default function ProgramDetailsModal({ programId, onClose, onEdit, onToggleStatus }) {
  const [state, setState] = useState({ status: 'loading', program: null, error: null });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', program: null, error: null });
    programService
      .get(programId)
      .then((response) => {
        if (active) setState({ status: 'ready', program: response.data.program, error: null });
      })
      .catch((error) => {
        if (active) setState({ status: 'error', program: null, error: error.message || 'Could not load program.' });
      });
    return () => {
      active = false;
    };
  }, [programId]);

  const program = state.program;

  return (
    <Modal
      title="Program details"
      subtitle={program ? `${program.code} — ${program.name}` : 'Loading…'}
      onClose={onClose}
      footer={
        program ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => onEdit(program)}>
              <Pencil size={16} /> Edit
            </button>
            <button
              type="button"
              className={`btn ${program.isActive ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => onToggleStatus(program)}
            >
              <Power size={16} /> {program.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </>
        ) : null
      }
    >
      {state.status === 'loading' ? <LoadingSpinner label="Loading program…" /> : null}

      {state.status === 'error' ? (
        <div className="notice notice-danger" role="alert">
          {state.error}
        </div>
      ) : null}

      {state.status === 'ready' && program ? (
        <dl className="detail-list">
          <dt>Department</dt>
          <dd>{program.department ? `${program.department.name} (${program.department.code})` : '—'}</dd>
          <dt>Code</dt>
          <dd className="mono">{program.code}</dd>
          <dt>Name</dt>
          <dd>{program.name}</dd>
          <dt>Degree type</dt>
          <dd>{program.degreeType}</dd>
          <dt>Duration (years)</dt>
          <dd>{program.durationYears}</dd>
          <dt>Description</dt>
          <dd>{program.description || '—'}</dd>
          <dt>Status</dt>
          <dd>
            <Badge tone={program.isActive ? 'success' : 'danger'}>{program.isActive ? 'Active' : 'Inactive'}</Badge>
          </dd>
          <dt>Courses</dt>
          <dd>{program.courseCount}</dd>
          <dt>Created</dt>
          <dd>{formatDateTime(program.createdAt)}</dd>
          <dt>Updated</dt>
          <dd>{formatDateTime(program.updatedAt)}</dd>
        </dl>
      ) : null}
    </Modal>
  );
}
