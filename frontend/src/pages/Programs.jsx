
import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Pencil,
  Power,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Building2,
  BookMarked,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Programs.css';

const DEGREE_TYPES = [
  { value: 'bachelor', label: "Bachelor's Degree" },
  { value: 'master', label: "Master's Degree" },
  { value: 'phd', label: 'PhD' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'certificate', label: 'Certificate' },
];

const emptyForm = {
  departmentId: '',
  code: '',
  name: '',
  degreeType: 'bachelor',
  durationYears: 4,
  description: '',
  isActive: true,
};

function getPayload(response) {
  const body = response?.data ?? response;
  return body?.data ?? body;
}

function getErrorMessage(error) {
  if (Array.isArray(error?.details) && error.details.length) {
    return error.details
      .map((detail) => detail?.message || detail?.msg || String(detail))
      .filter(Boolean)
      .join(' ');
  }

  return (
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="program-stat-card">
      <div className="program-stat-content">
        <div>
          <div className="program-stat-label">{label}</div>
          <div className="program-stat-value">{value}</div>
        </div>

        <div className="program-stat-icon">
          <Icon size={23} />
        </div>
      </div>
    </div>
  );
}

export default function Programs() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [programs, setPrograms] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const loadDepartments = useCallback(async () => {
    try {
      const response = await api.get('/departments/options');
      const payload = getPayload(response);

      const list = Array.isArray(payload)
        ? payload
        : payload?.departments ?? payload?.items ?? [];

      setDepartments(list);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        page,
        limit: 10,
        sort: 'name',
        order: 'asc',
      };

      if (search.trim()) params.search = search.trim();
      if (departmentFilter) params.departmentId = departmentFilter;
      if (degreeFilter) params.degreeType = degreeFilter;

      if (statusFilter !== '') {
        params.isActive = statusFilter;
      }

      const response = await api.get('/programs', { params });
      const payload = getPayload(response);

      const items = Array.isArray(payload)
        ? payload
        : payload?.items ?? payload?.programs ?? [];

      setPrograms(items);

      setPagination(
        payload?.pagination ?? {
          page,
          limit: 10,
          total: items.length,
          totalPages: 1,
        }
      );
    } catch (err) {
      setError(getErrorMessage(err));
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, departmentFilter, degreeFilter, statusFilter]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const openCreateModal = () => {
    setEditingProgram(null);
    setForm({
      ...emptyForm,
      departmentId: departments[0]?.id
        ? String(departments[0].id)
        : '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (program) => {
    setEditingProgram(program);

    setForm({
      departmentId: String(
        program.department?.id ?? program.departmentId ?? ''
      ),
      code: program.code ?? '',
      name: program.name ?? '',
      degreeType: program.degreeType ?? 'bachelor',
      durationYears: program.durationYears ?? 4,
      description: program.description ?? '',
      isActive: Boolean(program.isActive),
    });

    setFormError('');
    setModalOpen(true);
  };

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setFormError('');
    setNotice('');

    const payload = {
      departmentId: Number(form.departmentId),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      degreeType: form.degreeType,
      durationYears: Number(form.durationYears),
      description: form.description.trim() || null,
      isActive: Boolean(form.isActive),
    };

    if (!payload.departmentId || !Number.isFinite(payload.departmentId)) {
      setFormError('Please select a department.');
      setSaving(false);
      return;
    }

    if (payload.code.length < 2 || payload.code.length > 20) {
      setFormError('Program code must contain 2–20 characters.');
      setSaving(false);
      return;
    }

    if (payload.name.length < 2 || payload.name.length > 150) {
      setFormError('Program name must contain 2–150 characters.');
      setSaving(false);
      return;
    }

    if (
      !Number.isInteger(payload.durationYears) ||
      payload.durationYears < 1 ||
      payload.durationYears > 10
    ) {
      setFormError('Duration must be a whole number from 1 to 10 years.');
      setSaving(false);
      return;
    }

    try {
      if (editingProgram) {
        await api.patch(`/programs/${editingProgram.id}`, payload);
        setNotice('Program updated successfully.');
        setModalOpen(false);
        await loadPrograms();
      } else {
        await api.post('/programs', payload);
        setNotice('Program created successfully.');
        setModalOpen(false);

        if (page !== 1) {
          setPage(1);
        } else {
          await loadPrograms();
        }
      }
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (program) => {
    const action = program.isActive ? 'deactivate' : 'activate';

    if (
      !window.confirm(
        `Are you sure you want to ${action} "${program.name}"?`
      )
    ) {
      return;
    }

    setError('');
    setNotice('');

    try {
      await api.patch(`/programs/${program.id}/status`, {
        isActive: !program.isActive,
      });

      setNotice(
        `Program ${program.isActive ? 'deactivated' : 'activated'} successfully.`
      );

      await loadPrograms();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const deleteProgram = async (program) => {
    if (
      !window.confirm(
        `Delete program "${program.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setError('');
    setNotice('');

    try {
      await api.delete(`/programs/${program.id}`);
      setNotice('Program deleted successfully.');
      await loadPrograms();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const changeFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const totalPages = Math.max(
    1,
    Number(pagination.totalPages) || 1
  );

  const activeCount = programs.filter(
    (program) => program.isActive
  ).length;

  const inactiveCount = programs.length - activeCount;

  const totalPrograms = pagination.total ?? programs.length;

  return (
    <main className="programs-page">
      <header className="programs-header">
        <div className="programs-heading">
          <div className="programs-heading-icon">
            <BookOpen size={27} />
          </div>

          <div>
            <h1 className="programs-title">Academic Programs</h1>
            <p className="programs-subtitle">
              Manage degree programs and their departments.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="program-btn program-btn-primary"
          onClick={openCreateModal}
        >
          <Plus size={18} />
          Add Program
        </button>
      </header>

      {error && (
        <div className="program-alert program-alert-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {notice && (
        <div className="program-alert program-alert-success" role="status">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="Dismiss notification"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <section className="program-stats-grid" aria-label="Program statistics">
        <StatCard
          icon={GraduationCap}
          label="Total programs"
          value={totalPrograms}
        />
        <StatCard
          icon={BookMarked}
          label="Active on this page"
          value={activeCount}
        />
        <StatCard
          icon={Power}
          label="Inactive on this page"
          value={inactiveCount}
        />
        <StatCard
          icon={Building2}
          label="Departments"
          value={departments.length}
        />
      </section>

      <section className="program-filters" aria-label="Search and filters">
        <div className="program-search">
          <Search className="program-search-icon" size={17} />
          <input
            className="program-input"
            type="search"
            value={search}
            onChange={(event) =>
              changeFilter(setSearch, event.target.value)
            }
            placeholder="Search programs..."
            aria-label="Search programs"
          />
        </div>

        <select
          className="program-select"
          value={departmentFilter}
          onChange={(event) =>
            changeFilter(setDepartmentFilter, event.target.value)
          }
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.code
                ? `${department.code} — ${department.name}`
                : department.name}
            </option>
          ))}
        </select>

        <select
          className="program-select"
          value={degreeFilter}
          onChange={(event) =>
            changeFilter(setDegreeFilter, event.target.value)
          }
          aria-label="Filter by degree type"
        >
          <option value="">All degree types</option>
          {DEGREE_TYPES.map((degree) => (
            <option key={degree.value} value={degree.value}>
              {degree.label}
            </option>
          ))}
        </select>

        <div className="program-filter-status">
          <select
            className="program-select"
            value={statusFilter}
            onChange={(event) =>
              changeFilter(setStatusFilter, event.target.value)
            }
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>

          <button
            type="button"
            className="program-refresh-button"
            onClick={loadPrograms}
            title="Refresh programs"
            aria-label="Refresh programs"
            disabled={loading}
          >
            <RefreshCw
              size={18}
              className={loading ? 'program-loading-icon' : ''}
            />
          </button>
        </div>
      </section>

      <section className="program-table-panel">
        <div className="program-table-header">
          <h2 className="program-table-title">Program directory</h2>
          <span className="program-table-count">
            {totalPrograms} total
          </span>
        </div>

        {loading ? (
          <div className="program-state">
            <RefreshCw
              size={30}
              className="program-state-icon program-loading-icon"
            />
            <h3 className="program-state-title">Loading programs</h3>
            <p className="program-state-description">
              Please wait while program data is retrieved.
            </p>
          </div>
        ) : programs.length === 0 ? (
          <div className="program-state">
            <BookOpen size={38} className="program-state-icon" />
            <h3 className="program-state-title">No programs found</h3>
            <p className="program-state-description">
              Try changing your filters or create a new program.
            </p>
            <button
              type="button"
              className="program-btn program-btn-primary"
              onClick={openCreateModal}
            >
              <Plus size={17} />
              Add Program
            </button>
          </div>
        ) : (
          <>
            <div className="program-table-wrapper">
              <table className="program-table">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Department</th>
                    <th>Degree</th>
                    <th>Duration</th>
                    <th>Courses</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {programs.map((program) => (
                    <tr key={program.id}>
                      <td>
                        <span className="program-name">
                          {program.name}
                        </span>
                        <span className="program-code">
                          {program.code}
                        </span>
                      </td>

                      <td>
                        <span className="program-department-name">
                          {program.department?.name ??
                            program.departmentName ??
                            'Not assigned'}
                        </span>
                        {program.department?.code && (
                          <div className="program-muted">
                            {program.department.code}
                          </div>
                        )}
                      </td>

                      <td>
                        {DEGREE_TYPES.find(
                          (degree) => degree.value === program.degreeType
                        )?.label ?? program.degreeType ?? '—'}
                      </td>

                      <td>
                        {program.durationYears
                          ? `${program.durationYears} years`
                          : '—'}
                      </td>

                      <td>{program.courseCount ?? 0}</td>

                      <td>
                        <span
                          className={`program-status ${program.isActive
                              ? 'program-status-active'
                              : 'program-status-inactive'
                            }`}
                        >
                          {program.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td>
                        <div className="program-actions">
                          <button
                            type="button"
                            className="program-action-button program-action-edit"
                            onClick={() => openEditModal(program)}
                            title="Edit program"
                            aria-label={`Edit ${program.name}`}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className={`program-action-button ${program.isActive
                                ? 'program-action-deactivate'
                                : 'program-action-activate'
                              }`}
                            onClick={() => toggleStatus(program)}
                            title={
                              program.isActive
                                ? 'Deactivate program'
                                : 'Activate program'
                            }
                            aria-label={
                              program.isActive
                                ? `Deactivate ${program.name}`
                                : `Activate ${program.name}`
                            }
                          >
                            <Power size={16} />
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              className="program-action-button program-action-delete"
                              onClick={() => deleteProgram(program)}
                              title="Delete program"
                              aria-label={`Delete ${program.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="program-pagination">
              <p className="program-pagination-info">
                Page {pagination.page ?? page} of {totalPages}
              </p>

              <div className="program-pagination-actions">
                <button
                  type="button"
                  className="program-pagination-button"
                  disabled={page <= 1 || loading}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <button
                  type="button"
                  className="program-pagination-button"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(totalPages, current + 1)
                    )
                  }
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <div
          className="program-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setModalOpen(false);
            }
          }}
        >
          <section
            className="program-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="program-modal-title"
          >
            <header className="program-modal-header">
              <div>
                <h2
                  id="program-modal-title"
                  className="program-modal-title"
                >
                  {editingProgram ? 'Edit Program' : 'Create Program'}
                </h2>
                <p className="program-modal-description">
                  Enter the program's academic details.
                </p>
              </div>

              <button
                type="button"
                className="program-modal-close"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </header>

            <form
              className="program-modal-form"
              onSubmit={handleSubmit}
            >
              {formError && (
                <div className="program-form-error" role="alert">
                  {formError}
                </div>
              )}

              <div className="program-form-grid">
                <div className="program-form-field program-form-field-full">
                  <label
                    className="program-form-label"
                    htmlFor="program-department"
                  >
                    Department <span className="program-required">*</span>
                  </label>

                  <select
                    id="program-department"
                    name="departmentId"
                    className="program-select"
                    required
                    value={form.departmentId}
                    onChange={updateField}
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code
                          ? `${department.code} — ${department.name}`
                          : department.name}
                      </option>
                    ))}
                  </select>

                  {departments.length === 0 && (
                    <p className="program-muted">
                      No departments are available. Check the Departments API.
                    </p>
                  )}
                </div>

                <div className="program-form-field">
                  <label
                    className="program-form-label"
                    htmlFor="program-code"
                  >
                    Program code <span className="program-required">*</span>
                  </label>
                  <input
                    id="program-code"
                    className="program-input"
                    name="code"
                    required
                    minLength={2}
                    maxLength={20}
                    value={form.code}
                    onChange={updateField}
                    placeholder="e.g. BSC-CS"
                  />
                </div>

                <div className="program-form-field">
                  <label
                    className="program-form-label"
                    htmlFor="program-name"
                  >
                    Program name <span className="program-required">*</span>
                  </label>
                  <input
                    id="program-name"
                    className="program-input"
                    name="name"
                    required
                    minLength={2}
                    maxLength={150}
                    value={form.name}
                    onChange={updateField}
                    placeholder="e.g. Computer Science"
                  />
                </div>

                <div className="program-form-field">
                  <label
                    className="program-form-label"
                    htmlFor="program-degree"
                  >
                    Degree type <span className="program-required">*</span>
                  </label>
                  <select
                    id="program-degree"
                    className="program-select"
                    name="degreeType"
                    required
                    value={form.degreeType}
                    onChange={updateField}
                  >
                    {DEGREE_TYPES.map((degree) => (
                      <option key={degree.value} value={degree.value}>
                        {degree.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="program-form-field">
                  <label
                    className="program-form-label"
                    htmlFor="program-duration"
                  >
                    Duration (years) <span className="program-required">*</span>
                  </label>
                  <input
                    id="program-duration"
                    className="program-input"
                    name="durationYears"
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    required
                    value={form.durationYears}
                    onChange={updateField}
                  />
                </div>

                <div className="program-form-field program-form-field-full">
                  <label
                    className="program-form-label"
                    htmlFor="program-description"
                  >
                    Description
                  </label>
                  <textarea
                    id="program-description"
                    className="program-textarea"
                    name="description"
                    rows={4}
                    maxLength={2000}
                    value={form.description}
                    onChange={updateField}
                    placeholder="Briefly describe the academic program..."
                  />
                </div>

                <div className="program-form-field program-form-field-full">
                  <label className="program-checkbox-row">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={form.isActive}
                      onChange={updateField}
                    />
                    <span>Program is active</span>
                  </label>
                </div>
              </div>

              <footer className="program-modal-footer">
                <button
                  type="button"
                  className="program-btn program-btn-secondary"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="program-btn program-btn-primary"
                  disabled={saving || departments.length === 0}
                >
                  {saving && (
                    <RefreshCw
                      size={16}
                      className="program-loading-icon"
                    />
                  )}
                  {saving
                    ? 'Saving...'
                    : editingProgram
                      ? 'Save Changes'
                      : 'Create Program'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
