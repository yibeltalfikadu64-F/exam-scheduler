import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Eye, Pencil, Plus, Power, RefreshCw, Search } from 'lucide-react';

import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/users/ConfirmDialog';
import ProgramFormModal from '../components/programs/ProgramFormModal';
import ProgramDetailsModal from '../components/programs/ProgramDetailsModal';
import programService from '../services/programService';
import departmentService from '../services/departmentService';
import { formatDateTime } from '../utils/userMeta';

const DEFAULT_QUERY = {
  page: 1,
  limit: 10,
  search: '',
  departmentId: '',
  degreeType: '',
  status: 'all',
  sort: 'name',
  order: 'asc',
};

const DEGREE_OPTIONS = [
  { value: '', label: 'All degree types' },
  { value: 'bachelor', label: 'Bachelor' },
  { value: 'master', label: 'Master' },
  { value: 'phd', label: 'PhD' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'certificate', label: 'Certificate' },
];

export default function Programs() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [searchInput, setSearchInput] = useState('');
  const [list, setList] = useState({ status: 'loading', items: [], pagination: null, error: null });
  const [departments, setDepartments] = useState([]);
  const [banner, setBanner] = useState(null);
  const [formState, setFormState] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const { user } = useAuth();
  const canWrite = user && (user.role === 'admin' || user.role === 'registrar' || user.role === 'department_head');

  useEffect(() => {
    departmentService
      .options()
      .then((response) => {
        setDepartments(response.data.departments || []);
      })
      .catch(() => {});
  }, []);

  const loadPrograms = useCallback(async () => {
    setList((previous) => ({ ...previous, status: 'loading', error: null }));
    try {
      const params = {
        page: query.page,
        limit: query.limit,
        search: query.search,
        sort: query.sort,
        order: query.order,
      };
      if (query.departmentId) params.departmentId = Number(query.departmentId);
      if (query.degreeType) params.degreeType = query.degreeType;
      if (query.status !== 'all') {
        params.isActive = query.status === 'active';
      }
      const response = await programService.list(params);
      setList({ status: 'ready', items: response.data.items, pagination: response.data.pagination, error: null });
    } catch (error) {
      setList({
        status: 'error',
        items: [],
        pagination: null,
        error: error.message || 'Could not load programs.',
      });
    }
  }, [query]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery((previous) => (previous.search === searchInput ? previous : { ...previous, search: searchInput, page: 1 }));
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const openCreate = () => setFormState({ mode: 'create', program: null });
  const openEdit = (program) => {
    setDetailsId(null);
    setFormState({ mode: 'edit', program });
  };

  const handleSaved = (message) => {
    setFormState(null);
    setBanner({ tone: 'success', message });
    loadPrograms();
  };

  const askToggleStatus = (program) => {
    setDetailsId(null);
    setConfirm({ program, nextActive: !program.isActive });
  };

  const confirmToggleStatus = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await programService.setStatus(confirm.program.id, confirm.nextActive);
      setBanner({
        tone: 'success',
        message: `Program "${confirm.program.code}" ${confirm.nextActive ? 'activated' : 'deactivated'}.`,
      });
      setConfirm(null);
      loadPrograms();
    } catch (error) {
      setBanner({ tone: 'danger', message: error.message || 'Could not change program status.' });
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const pagination = list.pagination;
  const loading = list.status === 'loading';
  const showEmpty = list.status === 'ready' && list.items.length === 0;

  const pageNumbers = [];
  if (pagination) {
    const totalPages = pagination.totalPages || Math.ceil((pagination.total || 0) / (pagination.limit || 10));
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  }

  return (
    <div classNameame="page">
      <div classNameame="page-header">
        <div>
          <h2>Programs</h2>
          <p>Manage degree programs offered by departments.</p>
        </div>
        <button type="button" classNameame="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> New program
        </button>
      </div>

      {banner ? (
        <div classNameame={`notice notice-${banner.tone}`} role="status" style={{ marginBottom: 'var(--space-4)' }}>
          <span classNameame="grow">{banner.message}</span>
          <button type="button" classNameame="btn btn-subtle" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section classNameame="panel">
        <div classNameame="panel-header users-toolbar">
          <div classNameame="users-toolbar-filters">
            <div classNameame="users-search">
              <Search size={16} aria-hidden="true" />
              <label classNameame="sr-only" htmlFor="prog-search">
                Search programs
              </label>
              <input
                id="prog-search"
                classNameame="input"
                type="search"
                placeholder="Search code, name, descriptionâ€¦"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <label classNameame="sr-only" htmlFor="prog-dept-filter">
              Filter by department
            </label>
            <select
              id="prog-dept-filter"
              classNameame="input users-select"
              value={query.departmentId}
              onChange={(event) => setQuery((previous) => ({ ...previous, departmentId: event.target.value, page: 1 }))}
            >
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>

            <label classNameame="sr-only" htmlFor="prog-degree-filter">
              Filter by degree type
            </label>
            <select
              id="prog-degree-filter"
              classNameame="input users-select"
              value={query.degreeType}
              onChange={(event) => setQuery((previous) => ({ ...previous, degreeType: event.target.value, page: 1 }))}
            >
              {DEGREE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label classNameame="sr-only" htmlFor="prog-status-filter">
              Filter by status
            </label>
            <select
              id="prog-status-filter"
              classNameame="input users-select"
              value={query.status}
              onChange={(event) => setQuery((previous) => ({ ...previous, status: event.target.value, page: 1 }))}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button type="button" classNameame="btn btn-ghost" onClick={loadPrograms} disabled={loading} title="Reload">
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading programsâ€¦" />
        ) : list.status === 'error' ? (
          <div className="panel-body">
            <div className="notice notice-danger" role="alert">
              <span className="grow">{list.error}</span>
              <button type="button" className="btn btn-subtle" onClick={loadPrograms}>
                Try again
              </button>
            </div>
          </div>
        ) : showEmpty ? (
          <EmptyState
            icon={BookOpen}
            title="No programs found"
            description="Try adjusting filters or create a new program."
            action={
              canWrite ? (
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <Plus size={16} /> New program
                </button>
              ) : null
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Degree</th>
                  <th>Duration (yrs)</th>
                  <th>Status</th>
                  <th>Courses</th>
                  <th>Updated</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((program) => (
                  <tr key={program.id}>
                    <td className="mono">{program.code}</td>
                    <td>{program.name}</td>
                    <td>{program.department ? `${program.department.code} — ${program.department.name}` : '—'}</td>
                    <td>{program.degreeType}</td>
                    <td>{program.durationYears}</td>
                    <td>
                      <Badge tone={program.isActive ? 'success' : 'danger'}>{program.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td>{program.courseCount}</td>
                    <td className="text-muted text-xs">{formatDateTime(program.updatedAt)}</td>
                    <td className="actions">
                      <div className="row gap-2">
                        <button type="button" className="btn btn-icon" title="View details" onClick={() => setDetailsId(program.id)}>
                          <Eye size={16} />
                        </button>
                        {canWrite ? (
                          <>
                            <button type="button" className="btn btn-icon" title="Edit" onClick={() => openEdit(program)}>
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className={`btn btn-icon ${program.isActive ? 'danger' : 'primary'}`}
                              title={program.isActive ? 'Deactivate' : 'Activate'}
                              onClick={() => askToggleStatus(program)}
                            >
                              <Power size={16} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.total > 0 ? (
          <div className="panel-footer users-pagination">
            <span className="text-muted text-sm">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="row gap-2">
              <button
                type="button"
                className="btn btn-subtle"
                disabled={pagination.page <= 1}
                onClick={() => setQuery((p) => ({ ...p, page: p.page - 1 }))}
              >
                Previous
              </button>
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`btn ${num === pagination.page ? 'btn-primary' : 'btn-subtle'}`}
                  onClick={() => setQuery((p) => ({ ...p, page: num }))}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-subtle"
                disabled={pagination.page >= (pagination.totalPages || 1)}
                onClick={() => setQuery((p) => ({ ...p, page: p.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {formState ? (
        <ProgramFormModal
          mode={formState.mode}
          program={formState.program}
          departments={departments}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {detailsId ? (
        <ProgramDetailsModal
          programId={detailsId}
          onClose={() => setDetailsId(null)}
          onEdit={openEdit}
          onToggleStatus={askToggleStatus}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={confirm.nextActive ? 'Activate program' : 'Deactivate program'}
          message={`Are you sure you want to ${confirm.nextActive ? 'activate' : 'deactivate'} "${confirm.program.code} — ${confirm.program.name}"?`}
          confirmLabel={confirm.nextActive ? 'Activate' : 'Deactivate'}
          tone={confirm.nextActive ? 'primary' : 'danger'}
          busy={confirmBusy}
          onConfirm={confirmToggleStatus}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
