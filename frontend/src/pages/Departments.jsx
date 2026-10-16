
import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Search,
  Plus,
  Pencil,
  RefreshCw,
  Power,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  BookOpen,
  GraduationCap,
  AlertTriangle,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Departments.css';

const PAGE_SIZE = 10;

const emptyForm = {
  code: '',
  name: '',
  description: '',
  headId: '',
  isActive: true,
};

function getErrorMessage(error) {
  if (Array.isArray(error?.details)) {
    return error.details
      .map((detail) => detail.message || detail.msg || String(detail))
      .join(', ');
  }

  if (typeof error?.details === 'string') {
    return error.details;
  }

  return error?.message || 'Something went wrong. Please try again.';
}

function getPayload(response) {
  // Supports both direct API payloads and { success, data, meta } responses.
  return response?.data?.data ?? response?.data ?? response;
}

function StatusBadge({ active }) {
  return (
    <span
      className={`department-status ${active
          ? 'department-status-active'
          : 'department-status-inactive'
        }`}
    >
      <span className="department-status-dot" />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function SummaryCard({ label, value, icon: Icon, variant = 'blue' }) {
  return (
    <article className="department-summary-card">
      <div className="department-summary-top">
        <span className="department-summary-label">{label}</span>
        <span className={`department-summary-icon department-summary-icon-${variant}`}>
          <Icon size={20} />
        </span>
      </div>
      <div className="department-summary-value">{value}</div>
    </article>
  );
}

function DepartmentModal({
  department,
  onClose,
  onSave,
  saving,
}) {
  const isEditing = Boolean(department?.id);
  const [form, setForm] = useState({
    ...emptyForm,
    ...(department || {}),
    headId: department?.headId ?? department?.head_id ?? '',
    isActive: department?.isActive ?? department?.is_active ?? true,
  });
  const [error, setError] = useState('');

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.code.trim() || !form.name.trim()) {
      setError('Department code and department name are required.');
      return;
    }

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      headId: form.headId || null,
      isActive: form.isActive,
    };

    try {
      await onSave(payload);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    }
  }

  return (
    <div
      className="department-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="department-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-modal-title"
      >
        <header className="department-modal-header">
          <div>
            <h2 id="department-modal-title" className="department-modal-title">
              {isEditing ? 'Edit Department' : 'Create Department'}
            </h2>
            <p className="department-modal-description">
              {isEditing
                ? 'Update the department information below.'
                : 'Enter the details to add a department to your university.'}
            </p>
          </div>

          <button
            type="button"
            className="department-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </header>

        <form className="department-form" onSubmit={handleSubmit}>
          {error && (
            <div className="department-alert department-alert-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="department-form-grid">
            <label className="department-form-field">
              <span>
                Department Code <span className="department-required">*</span>
              </span>
              <input
                className="department-input"
                name="code"
                value={form.code}
                onChange={updateField}
                placeholder="e.g. CSE"
                maxLength={30}
                required
                autoFocus
              />
              <small className="department-field-hint">
                Use a short, unique department code.
              </small>
            </label>

            <label className="department-form-field">
              <span>
                Department Name <span className="department-required">*</span>
              </span>
              <input
                className="department-input"
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="e.g. Computer Science"
                maxLength={150}
                required
              />
            </label>

            <label className="department-form-field department-form-field-full">
              <span>Description</span>
              <textarea
                className="department-textarea"
                name="description"
                value={form.description || ''}
                onChange={updateField}
                placeholder="Describe the department's responsibilities..."
                rows={4}
                maxLength={1000}
              />
            </label>

            <label className="department-form-field department-form-field-full">
              <span>Department Head ID (optional)</span>
              <input
                className="department-input"
                name="headId"
                value={form.headId || ''}
                onChange={updateField}
                placeholder="Enter the department head's user ID"
              />
              <small className="department-field-hint">
                Leave blank if a department head has not been assigned.
              </small>
            </label>

            <label className="department-checkbox-label department-form-field-full">
              <input
                type="checkbox"
                name="isActive"
                checked={Boolean(form.isActive)}
                onChange={updateField}
              />
              <span className="department-checkbox-custom" />
              <span>
                <strong>Department is active</strong>
                <small>
                  Active departments can be used when managing university exams.
                </small>
              </span>
            </label>
          </div>

          <footer className="department-modal-footer">
            <button
              type="button"
              className="department-btn department-btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="department-btn department-btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoaderCircle className="department-spinner" size={17} />
                  Saving...
                </>
              ) : (
                <>
                  {isEditing ? <Pencil size={17} /> : <Plus size={17} />}
                  {isEditing ? 'Save Changes' : 'Create Department'}
                </>
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function DeactivationModal({
  department,
  dependencies,
  loading,
  saving,
  onClose,
  onConfirm,
}) {
  const programs =
    dependencies?.programsCount ??
    dependencies?.programs_count ??
    dependencies?.programs?.length ??
    dependencies?.programs ??
    0;

  const courses =
    dependencies?.coursesCount ??
    dependencies?.courses_count ??
    dependencies?.courses?.length ??
    dependencies?.courses ??
    0;

  const students =
    dependencies?.studentsCount ??
    dependencies?.students_count ??
    dependencies?.students?.length ??
    dependencies?.students ??
    0;

  const programCount = Number(programs) || 0;
  const courseCount = Number(courses) || 0;
  const studentCount = Number(students) || 0;

  return (
    <div
      className="department-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="department-modal department-modal-small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-deactivation-title"
      >
        <div className="department-deactivation-content">
          <div className="department-warning-icon">
            <AlertTriangle size={27} />
          </div>

          <h2
            id="department-deactivation-title"
            className="department-modal-title"
          >
            Deactivate Department?
          </h2>

          <p className="department-modal-description">
            You are about to deactivate{' '}
            <strong>{department?.name}</strong> ({department?.code}).
            Review its associated records before continuing.
          </p>

          {loading ? (
            <div className="department-dependency-loading">
              <LoaderCircle className="department-spinner" size={20} />
              <span>Checking related records...</span>
            </div>
          ) : (
            <div className="department-dependency-panel">
              <p className="department-dependency-heading">
                Associated records
              </p>

              <div className="department-dependency-grid">
                <div className="department-dependency-item">
                  <span className="department-dependency-label">
                    <Building2 size={16} />
                    Programs
                  </span>
                  <strong className="department-dependency-value">
                    {programCount}
                  </strong>
                </div>

                <div className="department-dependency-item">
                  <span className="department-dependency-label">
                    <BookOpen size={16} />
                    Courses
                  </span>
                  <strong className="department-dependency-value">
                    {courseCount}
                  </strong>
                </div>

                <div className="department-dependency-item">
                  <span className="department-dependency-label">
                    <Users size={16} />
                    Students
                  </span>
                  <strong className="department-dependency-value">
                    {studentCount}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <p className="department-warning-note">
            Deactivation should not delete the department's existing records.
            Check your backend rules before proceeding.
          </p>
        </div>

        <footer className="department-modal-footer">
          <button
            type="button"
            className="department-btn department-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="department-btn department-btn-danger"
            onClick={onConfirm}
            disabled={saving || loading}
          >
            {saving ? (
              <>
                <LoaderCircle className="department-spinner" size={17} />
                Processing...
              </>
            ) : (
              <>
                <Power size={17} />
                Deactivate
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function Departments() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [savingDepartment, setSavingDepartment] = useState(false);

  const [deactivationDepartment, setDeactivationDepartment] = useState(null);
  const [dependencies, setDependencies] = useState(null);
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [savingDeactivation, setSavingDeactivation] = useState(false);

  const loadDepartments = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setPageError('');

      try {
        const response = await api.get('/departments', {
          params: {
            search,
            page: pagination.page,
            limit: PAGE_SIZE,
            sort: 'name',
            order: 'asc',
          },
        });

        const payload = getPayload(response);
        const items = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.departments)
            ? payload.departments
            : Array.isArray(payload)
              ? payload
              : [];

        const pageInfo = payload?.pagination || payload?.meta?.pagination || {};

        setDepartments(items);
        setPagination((current) => ({
          ...current,
          page: Number(pageInfo.page ?? pagination.page) || 1,
          limit: Number(pageInfo.limit ?? PAGE_SIZE) || PAGE_SIZE,
          total: Number(pageInfo.total ?? pageInfo.totalItems ?? items.length) || 0,
          totalPages:
            Number(
              pageInfo.totalPages ??
              pageInfo.pages ??
              Math.max(1, Math.ceil((pageInfo.total ?? items.length) / PAGE_SIZE)),
            ) || 1,
        }));
      } catch (error) {
        setPageError(getErrorMessage(error));
        setDepartments([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pagination.page, search],
  );

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timeout = setTimeout(() => setSuccessMessage(''), 4000);
    return () => clearTimeout(timeout);
  }, [successMessage]);

  function handleSearch(event) {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setSearch(searchInput.trim());
  }

  function openCreateModal() {
    setEditingDepartment(null);
    setDepartmentModalOpen(true);
  }

  function openEditModal(department) {
    setEditingDepartment(department);
    setDepartmentModalOpen(true);
  }

  async function saveDepartment(formData) {
    setSavingDepartment(true);
    setPageError('');

    try {
      if (editingDepartment) {
        await api.patch(`/departments/${editingDepartment.id}`, formData);
        setSuccessMessage('Department updated successfully.');
      } else {
        await api.post('/departments', formData);
        setSuccessMessage('Department created successfully.');
      }

      setDepartmentModalOpen(false);
      setEditingDepartment(null);

      if (!editingDepartment) {
        setPagination((current) => ({ ...current, page: 1 }));
        if (pagination.page !== 1) {
          // The page change triggers a reload through the effect.
          return;
        }
      }

      await loadDepartments({ silent: true });
    } catch (error) {
      throw error;
    } finally {
      setSavingDepartment(false);
    }
  }

  async function openDeactivation(department) {
    setDeactivationDepartment(department);
    setDependencies(null);
    setLoadingDependencies(true);
    setPageError('');

    try {
      const response = await api.get(
        `/departments/${department.id}/dependencies`,
      );
      const payload = getPayload(response);
      setDependencies(payload || {});
    } catch (error) {
      setDependencies({});
      setPageError(
        `Could not load department dependencies: ${getErrorMessage(error)}`,
      );
    } finally {
      setLoadingDependencies(false);
    }
  }

  async function confirmDeactivation() {
    if (!deactivationDepartment) return;

    setSavingDeactivation(true);
    setPageError('');

    try {
      await api.patch(
        `/departments/${deactivationDepartment.id}/status`,
        { isActive: false },
      );

      setDeactivationDepartment(null);
      setDependencies(null);
      setSuccessMessage('Department deactivated successfully.');
      await loadDepartments({ silent: true });
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSavingDeactivation(false);
    }
  }

  async function reactivateDepartment(department) {
    const confirmed = window.confirm(
      `Reactivate department "${department.name}"?`,
    );
    if (!confirmed) return;

    setPageError('');

    try {
      await api.patch(`/departments/${department.id}/status`, {
        isActive: true,
      });
      setSuccessMessage('Department reactivated successfully.');
      await loadDepartments({ silent: true });
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  async function deleteDepartment(department) {
    if (
      !window.confirm(
        `Delete department "${department.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setPageError('');

    try {
      await api.delete(`/departments/${department.id}`);
      setSuccessMessage('Department deleted successfully.');
      await loadDepartments({ silent: true });
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  function changePage(nextPage) {
    setPagination((current) => ({
      ...current,
      page: Math.min(Math.max(1, nextPage), current.totalPages || 1),
    }));
  }

  const activeCount = departments.filter(
    (department) => department.isActive ?? department.is_active,
  ).length;

  const inactiveCount = departments.length - activeCount;

  return (
    <main className="departments-page">
      <header className="departments-header">
        <div className="departments-heading">
          <div className="departments-heading-icon">
            <Building2 size={27} />
          </div>

          <div>
            <h1 className="departments-title">Departments</h1>
            <p className="departments-subtitle">
              Manage academic departments and their university records.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="department-btn department-btn-primary"
          onClick={openCreateModal}
        >
          <Plus size={18} />
          Add Department
        </button>
      </header>

      {pageError && (
        <div className="department-alert department-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{pageError}</span>
          <button
            type="button"
            className="department-alert-close"
            onClick={() => setPageError('')}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {successMessage && (
        <div
          className="department-alert department-alert-success"
          role="status"
        >
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
          <button
            type="button"
            className="department-alert-close"
            onClick={() => setSuccessMessage('')}
            aria-label="Dismiss success message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="department-summary-grid" aria-label="Department summary">
        <SummaryCard
          label="Total Departments"
          value={pagination.total}
          icon={Building2}
          variant="blue"
        />
        <SummaryCard
          label="Active on This Page"
          value={activeCount}
          icon={CheckCircle2}
          variant="green"
        />
        <SummaryCard
          label="Inactive on This Page"
          value={inactiveCount}
          icon={Power}
          variant="orange"
        />
        <SummaryCard
          label="Current Page"
          value={`${pagination.page} / ${pagination.totalPages}`}
          icon={GraduationCap}
          variant="purple"
        />
      </section>

      <section className="department-panel">
        <div className="department-panel-header">
          <div>
            <h2 className="department-panel-title">Department Directory</h2>
            <p className="department-panel-subtitle">
              {pagination.total} department{pagination.total === 1 ? '' : 's'} found
            </p>
          </div>

          <button
            type="button"
            className="department-refresh-button"
            onClick={() => loadDepartments({ silent: true })}
            disabled={refreshing || loading}
            aria-label="Refresh departments"
            title="Refresh departments"
          >
            <RefreshCw
              size={18}
              className={refreshing ? 'department-refresh-spinning' : ''}
            />
          </button>
        </div>

        <form className="department-search-form" onSubmit={handleSearch}>
          <div className="department-search-box">
            <Search className="department-search-icon" size={18} />
            <input
              className="department-input department-search-input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by department name or code..."
              aria-label="Search departments"
            />
            {searchInput && (
              <button
                type="button"
                className="department-search-clear"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="department-btn department-btn-secondary department-search-submit"
          >
            <Search size={17} />
            Search
          </button>
        </form>

        {loading ? (
          <div className="department-state">
            <LoaderCircle className="department-spinner department-state-spinner" size={32} />
            <h3 className="department-state-title">Loading departments</h3>
            <p className="department-state-description">
              Please wait while department records are retrieved.
            </p>
          </div>
        ) : departments.length === 0 ? (
          <div className="department-state">
            <div className="department-state-icon">
              <Building2 size={30} />
            </div>
            <h3 className="department-state-title">
              {search ? 'No matching departments' : 'No departments yet'}
            </h3>
            <p className="department-state-description">
              {search
                ? 'Try another search term or clear your search.'
                : 'Create your first department to get started.'}
            </p>

            {search ? (
              <button
                type="button"
                className="department-btn department-btn-secondary"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              >
                Clear Search
              </button>
            ) : (
              <button
                type="button"
                className="department-btn department-btn-primary"
                onClick={openCreateModal}
              >
                <Plus size={17} />
                Add Department
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="department-table-wrapper">
              <table className="department-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Department Head</th>
                    <th>Status</th>
                    <th className="department-actions-heading">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {departments.map((department) => {
                    const active = Boolean(
                      department.isActive ?? department.is_active,
                    );
                    const head =
                      department.head ||
                      department.departmentHead ||
                      department.department_head;

                    return (
                      <tr key={department.id}>
                        <td>
                          <div className="department-name-cell">
                            <span className="department-row-icon">
                              <Building2 size={17} />
                            </span>
                            <span className="department-name">
                              {department.name}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className="department-code">
                            {department.code || '—'}
                          </span>
                        </td>

                        <td>
                          <span
                            className="department-description"
                            title={department.description || ''}
                          >
                            {department.description || 'No description provided'}
                          </span>
                        </td>

                        <td>
                          {head ? (
                            <div className="department-head-cell">
                              <span className="department-head-icon">
                                <Users size={16} />
                              </span>
                              <span>
                                <span className="department-head-name">
                                  {head.name ||
                                    [head.firstName, head.lastName]
                                      .filter(Boolean)
                                      .join(' ') ||
                                    head.fullName ||
                                    head.full_name ||
                                    head.username ||
                                    'Assigned'}
                                </span>
                                {head.username && head.name && (
                                  <span className="department-head-username">
                                    @{head.username}
                                  </span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="department-muted">Not assigned</span>
                          )}
                        </td>

                        <td>
                          <StatusBadge active={active} />
                        </td>

                        <td>
                          <div className="department-actions">
                            <button
                              type="button"
                              className="department-action-button"
                              onClick={() => openEditModal(department)}
                              title="Edit department"
                              aria-label={`Edit ${department.name}`}
                            >
                              <Pencil size={16} />
                            </button>

                            {active ? (
                              <button
                                type="button"
                                className="department-action-button department-action-danger"
                                onClick={() => openDeactivation(department)}
                                title="Deactivate department"
                                aria-label={`Deactivate ${department.name}`}
                              >
                                <Power size={16} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="department-action-button department-action-success"
                                onClick={() => reactivateDepartment(department)}
                                title="Reactivate department"
                                aria-label={`Reactivate ${department.name}`}
                              >
                                <RefreshCw size={16} />
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                className="department-action-button department-action-delete"
                                onClick={() => deleteDepartment(department)}
                                title="Delete department"
                                aria-label={`Delete ${department.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <footer className="department-pagination">
              <p className="department-pagination-info">
                Showing{' '}
                <strong>
                  {pagination.total === 0
                    ? 0
                    : (pagination.page - 1) * pagination.limit + 1}
                </strong>{' '}
                to{' '}
                <strong>
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}
                </strong>{' '}
                of <strong>{pagination.total}</strong> departments
              </p>

              <div className="department-pagination-actions">
                <button
                  type="button"
                  className="department-pagination-button"
                  onClick={() => changePage(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                  <span>Previous</span>
                </button>

                <span className="department-pagination-current">
                  {pagination.page} / {pagination.totalPages}
                </span>

                <button
                  type="button"
                  className="department-pagination-button"
                  onClick={() => changePage(pagination.page + 1)}
                  disabled={
                    pagination.page >= pagination.totalPages || loading
                  }
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>

      {departmentModalOpen && (
        <DepartmentModal
          department={editingDepartment}
          onClose={() => {
            if (!savingDepartment) {
              setDepartmentModalOpen(false);
              setEditingDepartment(null);
            }
          }}
          onSave={saveDepartment}
          saving={savingDepartment}
        />
      )}

      {deactivationDepartment && (
        <DeactivationModal
          department={deactivationDepartment}
          dependencies={dependencies}
          loading={loadingDependencies}
          saving={savingDeactivation}
          onClose={() => {
            if (!savingDeactivation) {
              setDeactivationDepartment(null);
              setDependencies(null);
            }
          }}
          onConfirm={confirmDeactivation}
        />
      )}
    </main>
  );
}
