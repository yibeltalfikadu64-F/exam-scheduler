
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
} from 'lucide-react';

import api from '../services/api';

const PAGE_SIZE = 10;

const emptyForm = {
  code: '',
  name: '',
  description: '',
  headId: '',
  isActive: true,
};

function getErrorMessage(error) {
  if (error?.details?.length) {
    return error.details.map((item) => item.message).join(' ');
  }
  return error?.message || 'Something went wrong. Please try again.';
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${active
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-600'
        }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function DepartmentModal({ department, onClose, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...(department
      ? {
        code: department.code || '',
        name: department.name || '',
        description: department.description || '',
        headId: department.headId ?? '',
        isActive: department.isActive ?? true,
      }
      : {}),
  }));
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
      setError('Department code and name are required.');
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      headId: form.headId === '' ? null : Number(form.headId),
      ...(department ? {} : { isActive: form.isActive }),
    };

    if (
      payload.headId !== null &&
      (!Number.isInteger(payload.headId) || payload.headId <= 0)
    ) {
      setError('Department head ID must be a positive whole number.');
      return;
    }

    try {
      await onSave(payload);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-modal-title"
        className="my-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="department-modal-title" className="text-xl font-bold">
              {department ? 'Edit department' : 'Create department'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage department information and its assigned head.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Department code *
              <input
                name="code"
                value={form.code}
                onChange={updateField}
                maxLength={30}
                required
                placeholder="e.g. CS"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="block text-sm font-medium">
              Department name *
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                maxLength={150}
                required
                placeholder="e.g. Computer Science"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Description
            <textarea
              name="description"
              value={form.description}
              onChange={updateField}
              rows={3}
              placeholder="Describe the department..."
              className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="block text-sm font-medium">
            Department head user ID
            <input
              name="headId"
              type="number"
              min="1"
              step="1"
              value={form.headId}
              onChange={updateField}
              placeholder="Leave blank if not assigned"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Enter an existing user ID. A searchable user selector can be
              added after checking the users API.
            </span>
          </label>

          {!department && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                name="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={updateField}
                className="h-4 w-4 rounded"
              />
              Create as an active department
            </label>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving && <LoaderCircle size={16} className="animate-spin" />}
              {saving ? 'Saving...' : department ? 'Save changes' : 'Create department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeactivationModal({ department, dependencies, loading, onCancel, onConfirm, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle size={25} />
        </div>

        <h2 id="deactivate-title" className="text-xl font-bold">
          Deactivate department?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          You are about to deactivate <strong>{department.name}</strong> ({department.code}).
          Existing records will not be deleted.
        </p>

        <div className="my-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <LoaderCircle size={16} className="animate-spin" />
              Checking related records...
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Programs</p>
                <p className="mt-1 text-2xl font-bold">
                  {dependencies?.programs ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Courses</p>
                <p className="mt-1 text-2xl font-bold">
                  {dependencies?.courses ?? '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="mb-5 text-xs leading-5 text-slate-500">
          Check these dependencies before proceeding. The backend may allow
          related records to remain attached to an inactive department.
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || saving || !dependencies}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Updating...' : 'Confirm deactivation'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [dependencies, setDependencies] = useState(null);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/departments', {
        params: {
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
          sort: 'name',
          order: 'asc',
        },
      });

      const result = response?.data || {};
      setDepartments(Array.isArray(result.items) ? result.items : []);
      setPagination(
        result.pagination || {
          page,
          limit: PAGE_SIZE,
          total: result.items?.length || 0,
          totalPages: 1,
        }
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function saveDepartment(payload) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (editing) {
        await api.patch(`/departments/${editing.id}`, payload);
        setNotice('Department updated successfully.');
      } else {
        await api.post('/departments', payload);
        setNotice('Department created successfully.');
        setPage(1);
      }

      setFormOpen(false);
      setEditing(null);
      await loadDepartments();
    } finally {
      setSaving(false);
    }
  }

  async function openDeactivation(department) {
    setStatusTarget(department);
    setDependencies(null);
    setDependenciesLoading(true);
    setError('');

    try {
      const response = await api.get(`/departments/${department.id}/dependencies`);
      setDependencies(response?.data || null);
    } catch (requestError) {
      setError(`Unable to check dependencies: ${getErrorMessage(requestError)}`);
      setStatusTarget(null);
    } finally {
      setDependenciesLoading(false);
    }
  }

  async function toggleStatus(department) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api.patch(`/departments/${department.id}/status`, {
        isActive: !department.isActive,
      });

      setNotice(
        department.isActive
          ? 'Department deactivated successfully.'
          : 'Department activated successfully.'
      );
      setStatusTarget(null);
      await loadDepartments();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setStatusTarget(null);
    } finally {
      setSaving(false);
    }
  }

  const activeCount = departments.filter((department) => department.isActive).length;
  const programCount = departments.reduce(
    (total, department) => total + Number(department.programCount || 0),
    0
  );
  const courseCount = departments.reduce(
    (total, department) => total + Number(department.courseCount || 0),
    0
  );

  return (
    <main className="space-y-6 p-4 text-slate-900 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Building2 size={25} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Departments & Programs
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage university departments, department heads, and dependencies.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
            setNotice('');
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus size={18} />
          Add department
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error">
            <X size={18} />
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss message">
            <X size={18} />
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Building2} label="Departments on this page" value={departments.length} />
        <SummaryCard icon={Power} label="Active on this page" value={activeCount} />
        <SummaryCard icon={GraduationCap} label="Programs on this page" value={programCount} />
        <SummaryCard icon={BookOpen} label="Courses on this page" value={courseCount} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">Department directory</h2>
            <p className="mt-1 text-sm text-slate-500">
              {Number(pagination.total || 0)} department(s) found
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex w-full gap-2 sm:max-w-md">
            <div className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name, code, or description"
                aria-label="Search departments"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setPage(1);
              }}
              aria-label="Refresh departments"
              title="Refresh departments"
              className="rounded-lg border border-slate-300 p-2.5 hover:bg-slate-50"
            >
              <RefreshCw size={17} />
            </button>
          </form>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
            <LoaderCircle className="animate-spin" size={22} />
            Loading departments...
          </div>
        ) : departments.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <Building2 size={36} className="text-slate-300" />
            <h3 className="mt-3 font-semibold">No departments found</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try another search or create a new department.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Department</th>
                    <th className="px-5 py-3.5 font-semibold">Department head</th>
                    <th className="px-5 py-3.5 font-semibold">Programs</th>
                    <th className="px-5 py-3.5 font-semibold">Courses</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map((department) => (
                    <tr key={department.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <div className="font-semibold">{department.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {department.code}
                          {department.description ? ` · ${department.description}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-slate-400" />
                          <div>
                            <div>{department.head?.fullName || 'Not assigned'}</div>
                            {department.head?.username && (
                              <div className="text-xs text-slate-500">
                                @{department.head.username}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">{department.programCount ?? 0}</td>
                      <td className="px-5 py-4">{department.courseCount ?? 0}</td>
                      <td className="px-5 py-4">
                        <StatusBadge active={department.isActive} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(department);
                              setFormOpen(true);
                              setNotice('');
                            }}
                            title="Edit department"
                            aria-label={`Edit ${department.name}`}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Pencil size={16} />
                          </button>
                          {department.isActive ? (
                            <button
                              type="button"
                              onClick={() => openDeactivation(department)}
                              title="Deactivate department"
                              aria-label={`Deactivate ${department.name}`}
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            >
                              <Power size={16} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleStatus(department)}
                              title="Activate department"
                              aria-label={`Activate ${department.name}`}
                              className="rounded-lg border border-slate-200 p-2 text-emerald-700 hover:bg-emerald-50"
                            >
                              <Power size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row">
              <p className="text-sm text-slate-500">
                Page {pagination.page || page} of {Math.max(1, pagination.totalPages || 1)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= (pagination.totalPages || 1)}
                  onClick={() => setPage((current) => current + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {formOpen && (
        <DepartmentModal
          department={editing}
          saving={saving}
          onClose={() => {
            if (!saving) {
              setFormOpen(false);
              setEditing(null);
            }
          }}
          onSave={saveDepartment}
        />
      )}

      {statusTarget && (
        <DeactivationModal
          department={statusTarget}
          dependencies={dependencies}
          loading={dependenciesLoading}
          saving={saving}
          onCancel={() => {
            if (!saving) setStatusTarget(null);
          }}
          onConfirm={() => toggleStatus(statusTarget)}
        />
      )}
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}
