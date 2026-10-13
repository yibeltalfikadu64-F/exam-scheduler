
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
} from 'lucide-react';
import api from '../services/api';

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

// Supports both the standard API envelope and an already-unwrapped response.
function getPayload(response) {
  const body = response?.data ?? response;
  return body?.data ?? body;
}

function getErrorMessage(error) {
  return (
    error?.message ||
    error?.response?.data?.message ||
    'Something went wrong. Please try again.'
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
        <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950">
          <Icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>
    </div>
  );
}

export default function Programs() {
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
      setDepartments(payload?.departments ?? []);
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
      if (statusFilter !== '') params.isActive = statusFilter;

      const response = await api.get('/programs', { params });
      const payload = getPayload(response);

      setPrograms(payload?.items ?? []);
      setPagination(
        payload?.pagination ?? {
          page,
          limit: 10,
          total: (payload?.items ?? []).length,
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
      departmentId: String(program.department?.id ?? ''),
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

    if (!payload.departmentId) {
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
      } else {
        await api.post('/programs', payload);
        setNotice('Program created successfully.');
        setPage(1);
      }

      setModalOpen(false);
      await loadPrograms();
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

  const changeFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const totalPages = Math.max(
    1,
    Number(pagination.totalPages) || 1
  );

  const activeCount = programs.filter((item) => item.isActive).length;
  const inactiveCount = programs.filter((item) => !item.isActive).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-100 p-3 dark:bg-indigo-950">
              <BookOpen className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Academic Programs
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage degree programs and their departments.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700"
        >
          <Plus size={19} />
          Add Program
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">
            <X size={18} />
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label="Programs found"
          value={pagination.total ?? programs.length}
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
      </div>

      {/* Search and filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                changeFilter(setSearch, event.target.value)
              }
              placeholder="Search code, name, description..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(event) =>
              changeFilter(setDepartmentFilter, event.target.value)
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.code} — {department.name}
              </option>
            ))}
          </select>

          <select
            value={degreeFilter}
            onChange={(event) =>
              changeFilter(setDegreeFilter, event.target.value)
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">All degree types</option>
            {DEGREE_TYPES.map((degree) => (
              <option key={degree.value} value={degree.value}>
                {degree.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(event) =>
                changeFilter(setStatusFilter, event.target.value)
              }
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            <button
              type="button"
              onClick={loadPrograms}
              title="Refresh programs"
              className="rounded-lg border border-gray-300 px-3 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Programs table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Program directory
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {pagination.total ?? programs.length} total
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 p-12 text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading programs...
          </div>
        ) : programs.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
            <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">
              No programs found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try changing your filters or create a new program.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3">Program</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Degree</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Courses</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {programs.map((program) => (
                    <tr
                      key={program.id}
                      className="transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {program.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {program.code}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-gray-800 dark:text-gray-200">
                          {program.department?.name ?? 'Not assigned'}
                        </p>
                        {program.department?.code && (
                          <p className="mt-1 text-xs text-gray-500">
                            {program.department.code}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 text-gray-700 dark:text-gray-300">
                        {DEGREE_TYPES.find(
                          (degree) => degree.value === program.degreeType
                        )?.label ?? program.degreeType ?? '—'}
                      </td>

                      <td className="px-5 py-4 text-gray-700 dark:text-gray-300">
                        {program.durationYears
                          ? `${program.durationYears} years`
                          : '—'}
                      </td>

                      <td className="px-5 py-4 text-gray-700 dark:text-gray-300">
                        {program.courseCount ?? 0}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${program.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                        >
                          {program.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(program)}
                            title="Edit program"
                            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleStatus(program)}
                            title={program.isActive ? 'Deactivate program' : 'Activate program'}
                            className={`rounded-lg border p-2 ${program.isActive
                              ? 'border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:text-gray-300'
                              : 'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-900 dark:text-green-300'
                              }`}
                          >
                            <Power size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {pagination.page ?? page} of {totalPages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-white"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-white"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create/edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setModalOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="program-modal-title"
            className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
              <div>
                <h2
                  id="program-modal-title"
                  className="text-xl font-bold text-gray-900 dark:text-white"
                >
                  {editingProgram ? 'Edit Program' : 'Create Program'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter the program's academic details.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="departmentId"
                    required
                    value={form.departmentId}
                    onChange={updateField}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code} — {department.name}
                      </option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      No department options are available. Check the Departments API.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Program code <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="code"
                    required
                    minLength={2}
                    maxLength={20}
                    value={form.code}
                    onChange={updateField}
                    placeholder="e.g. BSC-CS"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm uppercase dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    2–20 letters, numbers, dots, underscores, or hyphens.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Program name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={150}
                    value={form.name}
                    onChange={updateField}
                    placeholder="e.g. Computer Science"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Degree type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="degreeType"
                    required
                    value={form.degreeType}
                    onChange={updateField}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    {DEGREE_TYPES.map((degree) => (
                      <option key={degree.value} value={degree.value}>
                        {degree.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Duration (years) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="durationYears"
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    required
                    value={form.durationYears}
                    onChange={updateField}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={4}
                    maxLength={2000}
                    value={form.description}
                    onChange={updateField}
                    placeholder="Briefly describe the academic program..."
                    className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <label className="flex items-center gap-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={updateField}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    Program is active
                  </span>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end dark:border-gray-700">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || departments.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <RefreshCw size={16} className="animate-spin" />}
                  {saving
                    ? 'Saving...'
                    : editingProgram
                      ? 'Save Changes'
                      : 'Create Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
