import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, Eye, Pencil, Plus, Power, RefreshCw, Search } from 'lucide-react';

import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/users/ConfirmDialog';
import DepartmentFormModal from '../components/departments/DepartmentFormModal';
import DepartmentDetailsModal from '../components/departments/DepartmentDetailsModal';
import departmentService from '../services/departmentService';
import userService from '../services/userService';
import { formatDateTime } from '../utils/userMeta';

const DEFAULT_QUERY = {
  page: 1,
  limit: 10,
  search: '',
  status: 'all',
  sort: 'name',
  order: 'asc',
};

export default function Departments() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [searchInput, setSearchInput] = useState('');
  const [list, setList] = useState({ status: 'loading', items: [], pagination: null, error: null });
  const [heads, setHeads] = useState([]);
  const [banner, setBanner] = useState(null);
  const [formState, setFormState] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const { user } = useAuth();
  const canWrite = user && (user.role === 'admin' || user.role === 'registrar');

  useEffect(() => {
    userService
      .options()
      .then((response) => {
        setHeads((response.data && response.data.users) || (response.data && response.data.heads) || []);
      })
      .catch(() => {});
  }, []);

  const loadDepartments = useCallback(async () => {
    setList((previous) => ({ ...previous, status: 'loading', error: null }));
    try {
      const params = {
        page: query.page,
        limit: query.limit,
        search: query.search,
        sort: query.sort,
        order: query.order,
      };
      if (query.status !== 'all') {
        params.isActive = query.status === 'active';
      }
      const response = await departmentService.list(params);
      setList({ status: 'ready', items: response.data.items, pagination: response.data.pagination, error: null });
    } catch (error) {
      setList({
        status: 'error',
        items: [],
        pagination: null,
        error: error.message || 'Could not load departments.',
      });
    }
  }, [query]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery((previous) => (previous.search === searchInput ? previous : { ...previous, search: searchInput, page: 1 }));
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const openCreate = () => setFormState({ mode: 'create', department: null });
  const openEdit = (department) => {
    setDetailsId(null);
    setFormState({ mode: 'edit', department });
  };

  const handleSaved = (message) => {
    setFormState(null);
    setBanner({ tone: 'success', message });
    loadDepartments();
  };

  const askToggleStatus = (department) => {
    setDetailsId(null);
    setConfirm({ department, nextActive: !department.isActive });
  };

  const confirmToggleStatus = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await departmentService.setStatus(confirm.department.id, confirm.nextActive);
      setBanner({
        tone: 'success',
        message: `Department "${confirm.department.code}" ${confirm.nextActive ? 'activated' : 'deactivated'}.`,
      });
      setConfirm(null);
      loadDepartments();
    } catch (error) {
      setBanner({ tone: 'danger', message: error.message || 'Could not change department status.' });
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
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Departments</h2>
          <p>Manage academic departments and department heads.</p>
        </div>
        {canWrite ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> New department
          </button>
        ) : null}
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
              <label className="sr-only" htmlFor="dept-search">
                Search departments
              </label>
              <input
                id="dept-search"
                className="input"
                type="search"
                placeholder="Search code, name, descriptionâ€¦"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <label className="sr-only" htmlFor="dept-status-filter">
              Filter by status
            </label>
            <select
              id="dept-status-filter"
              className="input users-select"
              value={query.status}
              onChange={(event) => setQuery((previous) => ({ ...previous, status: event.target.value, page: 1 }))}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button type="button" className="btn btn-ghost" onClick={loadDepartments} disabled={loading} title="Reload">
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading departmentsâ€¦" />
        ) : list.status === 'error' ? (
          <div className="panel-body">
            <div className="notice notice-danger" role="alert">
              <span className="grow">{list.error}</span>
              <button type="button" className="btn btn-subtle" onClick={loadDepartments}>
                Try again
              </button>
            </div>
          </div>
        ) : showEmpty ? (
          <EmptyState
            icon={Building2}
            title="No departments found"
            description="Try adjusting your search or create a new department."
            action={
              canWrite ? (
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <Plus size={16} /> New department
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
                  <th>Head</th>
                  <th>Status</th>
                  <th>Programs</th>
                  <th>Courses</th>
                  <th>Updated</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((department) => (
                  <tr key={department.id}>
                    <td>
                      <Badge tone={department.isActive ? 'success' : 'danger'}>{department.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td>{department.programCount}</td>
                    <td>{department.courseCount}</td>
                    <td className="text-muted text-xs">{formatDateTime(department.updatedAt)}</td>
                    <td className="actions">
                      <div className="row gap-2">
                        <button type="button" className="btn btn-icon" title="View details" onClick={() => setDetailsId(department.id)}>
                          <Eye size={16} />
                        </button>
                        {canWrite ? (
                          <>
                            <button type="button" className="btn btn-icon" title="Edit" onClick={() => openEdit(department)}>
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className={`btn btn-icon ${department.isActive ? 'danger' : 'primary'}`}
                              title={department.isActive ? 'Deactivate' : 'Activate'}
                              onClick={() => askToggleStatus(department)}
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
        <DepartmentFormModal
          mode={formState.mode}
          department={formState.department}
          heads={heads}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {detailsId ? (
        <DepartmentDetailsModal
          departmentId={detailsId}
          onClose={() => setDetailsId(null)}
          onEdit={openEdit}
          onToggleStatus={askToggleStatus}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={confirm.nextActive ? 'Activate department' : 'Deactivate department'}
          message={`Are you sure you want to ${confirm.nextActive ? 'activate' : 'deactivate'} "${confirm.department.code} — ${confirm.department.name}"?`}
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
