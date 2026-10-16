
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  RefreshCw,
  Search,
  Plus,
  Pencil,
  Power,
  Trash2,
  X,
} from 'lucide-react';

import courseService from '../services/courseService';
import departmentService from '../services/departmentService';
import programService from '../services/programService';
import { useAuth } from '../context/AuthContext';
import './Courses.css';

const emptyForm = {
  departmentId: '',
  programId: '',
  code: '',
  title: '',
  credits: 3,
  description: '',
  isActive: true,
};

function getItems(payload, keys = []) {
  if (Array.isArray(payload)) return payload;

  for (const key of keys) {
    const candidates = [
      payload?.[key],
      payload?.data?.[key],
      payload?.data?.data?.[key],
    ];

    const found = candidates.find(Array.isArray);
    if (found) return found;
  }

  const candidates = [
    payload?.data,
    payload?.data?.items,
    payload?.items,
    payload?.data?.data,
    payload?.results,
  ];

  return candidates.find(Array.isArray) || [];
}

function getDepartmentId(item) {
  return item?.id ?? item?.departmentId ?? item?.department_id ?? '';
}

function getDepartmentName(item) {
  return (
    item?.name ??
    item?.departmentName ??
    item?.department_name ??
    item?.code ??
    'Unnamed department'
  );
}

function getProgramId(item) {
  return item?.id ?? item?.programId ?? item?.program_id ?? '';
}

function getProgramName(item) {
  return (
    item?.name ??
    item?.programName ??
    item?.program_name ??
    item?.code ??
    'Unnamed program'
  );
}

function getErrorMessage(error, fallback) {
  const message = error?.message || fallback;
  const details = error?.details;

  if (Array.isArray(details)) {
    const detailText = details
      .map((item) =>
        typeof item === 'string'
          ? item
          : item?.message || item?.msg || '',
      )
      .filter(Boolean)
      .join(' ');

    return detailText ? `${message} ${detailText}` : message;
  }

  if (typeof details === 'string' && details.trim()) {
    return `${message} ${details}`;
  }

  return message;
}

export default function Courses() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [departmentsError, setDepartmentsError] = useState('');
  const [message, setMessage] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  // Load courses.
  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await courseService.list({ limit: 100 });
      setCourses(getItems(result, ['courses']));
    } catch (err) {
      console.error('Failed to load courses:', err);
      setCourses([]);
      setError(getErrorMessage(err, 'Could not load courses.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load departments.
  const loadDepartments = useCallback(async () => {
    setDepartmentsLoading(true);
    setDepartmentsError('');

    try {
      const result = await departmentService.options();
      const items = getItems(result, ['departments', 'options']);

      setDepartments(items);
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDepartments([]);
      setDepartmentsError(
        getErrorMessage(err, 'Could not load departments.'),
      );
    } finally {
      setDepartmentsLoading(false);
    }
  }, []);

  // Load programs for a selected department.
  const loadPrograms = useCallback(async (departmentId) => {
    if (!departmentId) {
      setPrograms([]);
      setProgramsLoading(false);
      return;
    }

    setProgramsLoading(true);

    try {
      const result = await programService.options(departmentId);
      const items = getItems(result, ['programs', 'options']);

      const filtered = items.filter((program) => {
        const programDepartmentId =
          program?.department?.id ??
          program?.departmentId ??
          program?.department_id;

        if (
          programDepartmentId === undefined ||
          programDepartmentId === null ||
          programDepartmentId === ''
        ) {
          return true;
        }

        return String(programDepartmentId) === String(departmentId);
      });

      const unique = Array.from(
        new Map(
          filtered
            .filter((item) => getProgramId(item) !== '')
            .map((item) => [String(getProgramId(item)), item]),
        ).values(),
      );

      setPrograms(unique);
    } catch (err) {
      console.error('Failed to load programs:', err);
      setPrograms([]);
      setError(getErrorMessage(err, 'Could not load programs.'));
    } finally {
      setProgramsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
    loadDepartments();
  }, [loadCourses, loadDepartments]);

  useEffect(() => {
    loadPrograms(form.departmentId);
  }, [form.departmentId, loadPrograms]);

  // Filter courses.
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return courses;

    return courses.filter((course) =>
      [
        course.code,
        course.title,
        course.department?.name,
        course.departmentName,
        course.department_name,
        course.program?.name,
        course.programName,
        course.program_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [courses, search]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setPrograms([]);
    setError('');
    setMessage('');
    setShowForm(true);
  }

  function openEdit(course) {
    const departmentId = String(
      course.department?.id ??
      course.departmentId ??
      course.department_id ??
      '',
    );

    const programId = String(
      course.program?.id ??
      course.programId ??
      course.program_id ??
      '',
    );

    setEditing(course);

    setForm({
      departmentId,
      programId,
      code: course.code || '',
      title: course.title || '',
      credits: course.credits ?? 3,
      description: course.description || '',
      isActive: course.isActive ?? course.is_active ?? true,
    });

    setPrograms([]);
    setError('');
    setMessage('');
    setShowForm(true);
  }

  function changeField(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'departmentId' ? { programId: '' } : {}),
    }));

    if (name === 'departmentId') {
      setPrograms([]);
      setError('');
    }
  }

  // Create or update a course.
  async function submitForm(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    // Keep the entered course-code characters; only trim surrounding spaces.
    const code = form.code.trim();
    const title = form.title.trim();

    const payload = {
      departmentId: Number(form.departmentId),
      programId: form.programId ? Number(form.programId) : null,
      code,
      title,
      credits: Number(form.credits),
      description: form.description.trim(),
      isActive: Boolean(form.isActive),
    };

    if (
      !form.departmentId ||
      !Number.isInteger(payload.departmentId) ||
      payload.departmentId <= 0
    ) {
      setError('Please select a valid department.');
      return;
    }

    if (!code) {
      setError('Course code is required.');
      return;
    }

    if (code.length > 100) {
      setError('Course code cannot exceed 100 characters.');
      return;
    }

    if (!title) {
      setError('Course Name is required.');
      return;
    }

    if (title.length < 2 || title.length > 200) {
      setError('Course Name must be between 2 and 200 characters.');
      return;
    }

    if (
      !Number.isInteger(payload.credits) ||
      payload.credits < 1 ||
      payload.credits > 30
    ) {
      setError('Credits must be a whole number between 1 and 30.');
      return;
    }

    if (
      payload.programId !== null &&
      (!Number.isInteger(payload.programId) || payload.programId <= 0)
    ) {
      setError('Please select a valid program or choose No program.');
      return;
    }

    setSaving(true);

    try {
      if (editing) {
        await courseService.update(editing.id, payload);
        setMessage('Course updated successfully.');
      } else {
        await courseService.create(payload);
        setMessage('Course created successfully.');
      }

      setShowForm(false);
      setEditing(null);
      setForm({ ...emptyForm });

      await loadCourses();
    } catch (err) {
      console.error('Create/update course failed:', err);
      setError(getErrorMessage(err, 'Could not save the course.'));
    } finally {
      setSaving(false);
    }
  }

  // Activate or deactivate a course.
  async function toggleStatus(course) {
    const isActive = course.isActive ?? course.is_active ?? true;
    const nextStatus = !isActive;
    const action = nextStatus ? 'activate' : 'deactivate';

    if (
      !window.confirm(
        `Are you sure you want to ${action} "${course.code}"?`,
      )
    ) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await courseService.setStatus(course.id, nextStatus);

      setMessage(
        nextStatus
          ? 'Course activated successfully.'
          : 'Course deactivated successfully.',
      );

      await loadCourses();
    } catch (err) {
      setError(getErrorMessage(err, `Could not ${action} the course.`));
    }
  }

  // Permanently delete a course (admin only; refused while dependents exist).
  async function deleteCourse(course) {
    const label = course.code || course.name || `Course #${course.id}`;

    if (
      !window.confirm(
        `Delete course "${label}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await courseService.remove(course.id);
      setMessage('Course deleted successfully.');
      await loadCourses();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the course.'));
    }
  }

  // Refresh all data.
  async function refreshAll() {
    setError('');
    setMessage('');

    await Promise.all([
      loadCourses(),
      loadDepartments(),
      form.departmentId
        ? loadPrograms(form.departmentId)
        : Promise.resolve(),
    ]);
  }

  return (
    <main className="courses-page">
      <header className="page-header">
        <div>
          <h1>
            <BookOpen size={25} />
            Courses
          </h1>
          <p>Manage the university course catalogue.</p>
        </div>

        <div className="courses-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={refreshAll}
            disabled={loading || departmentsLoading}
          >
            <RefreshCw
              size={16}
              className={
                loading || departmentsLoading ? 'spin' : ''
              }
            />
            Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            <Plus size={16} />
            Add course
          </button>
        </div>
      </header>

      {error && (
        <div className="courses-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="courses-success" role="status">
          {message}
        </div>
      )}

      {showForm && (
        <section
          className="courses-panel"
          aria-labelledby="course-form-title"
        >
          <header className="courses-form-header">
            <h2 id="course-form-title">
              {editing ? 'Edit course' : 'Create course'}
            </h2>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowForm(false)}
              aria-label="Close form"
              disabled={saving}
            >
              <X size={16} />
            </button>
          </header>

          <form onSubmit={submitForm} className="courses-form">
            <label>
              Department *

              <select
                name="departmentId"
                value={form.departmentId}
                onChange={changeField}
                required
                disabled={departmentsLoading}
              >
                <option value="">
                  {departmentsLoading
                    ? 'Loading departments...'
                    : departments.length
                      ? 'Select department'
                      : 'No departments available'}
                </option>

                {departments.map((item, index) => {
                  const id = getDepartmentId(item);

                  return (
                    <option
                      key={id || `department-${index}`}
                      value={id}
                    >
                      {getDepartmentName(item)}
                    </option>
                  );
                })}
              </select>

              {departmentsLoading && (
                <small role="status">
                  Loading departments from the server...
                </small>
              )}

              {!departmentsLoading && departmentsError && (
                <small role="alert">
                  {departmentsError}{' '}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={loadDepartments}
                  >
                    Try again
                  </button>
                </small>
              )}

              {!departmentsLoading &&
                !departmentsError &&
                departments.length === 0 && (
                  <small>
                    No departments were returned by the API.
                    Check the database and department endpoint.
                  </small>
                )}
            </label>

            <label>
              Program (optional)

              <select
                name="programId"
                value={form.programId}
                onChange={changeField}
                disabled={!form.departmentId || programsLoading}
              >
                <option value="">
                  {!form.departmentId
                    ? 'Select a department first'
                    : programsLoading
                      ? 'Loading programs...'
                      : 'No program'}
                </option>

                {programs.map((item, index) => {
                  const id = getProgramId(item);

                  return (
                    <option
                      key={id || `program-${index}`}
                      value={id}
                    >
                      {getProgramName(item)}
                    </option>
                  );
                })}
              </select>
            </label>

            <label>
              Course code *

              <input
                name="code"
                value={form.code}
                onChange={changeField}
                maxLength={100}
                placeholder="e.g. SE/301 + Lab #1"
                required
              />

              <small>
                Special characters are allowed. Maximum 100 characters.
              </small>
            </label>

            <label>
              Course Name *

              <input
                name="title"
                value={form.title}
                onChange={changeField}
                minLength={2}
                maxLength={200}
                placeholder="Enter course name"
                required
              />
            </label>

            <label>
              Credits *

              <input
                type="number"
                name="credits"
                value={form.credits}
                onChange={changeField}
                min="1"
                max="30"
                step="1"
                required
              />
            </label>

            <label className="courses-description">
              Description

              <textarea
                name="description"
                value={form.description}
                onChange={changeField}
                maxLength={2000}
                rows={3}
                placeholder="Optional course description"
              />
            </label>

            <label className="courses-checkbox">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={changeField}
              />
              Active
            </label>

            <div className="courses-form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  saving ||
                  departmentsLoading ||
                  departments.length === 0
                }
              >
                {saving
                  ? 'Saving...'
                  : editing
                    ? 'Save changes'
                    : 'Create course'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="courses-panel">
        <div className="courses-toolbar">
          <label className="courses-search">
            <Search size={18} />
            <span className="sr-only">Search courses</span>

            <input
              type="search"
              placeholder="Search code, name, or department..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <span>{filteredCourses.length} course(s)</span>
        </div>

        {loading ? (
          <p className="courses-state" role="status">
            Loading courses...
          </p>
        ) : filteredCourses.length === 0 ? (
          <p className="courses-state">
            {search
              ? 'No matching courses.'
              : 'No courses found. Add your first course.'}
          </p>
        ) : (
          <div className="courses-table-wrapper">
            <table className="courses-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course Name</th>
                  <th>Department</th>
                  <th>Program</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCourses.map((course) => {
                  const isActive =
                    course.isActive ?? course.is_active ?? true;

                  return (
                    <tr
                      key={
                        course.id ??
                        course.uuid ??
                        course.code
                      }
                    >
                      <td>{course.code || '—'}</td>
                      <td>{course.title || '—'}</td>

                      <td>
                        {course.department?.name ||
                          course.departmentName ||
                          course.department_name ||
                          '—'}
                      </td>

                      <td>
                        {course.program?.name ||
                          course.programName ||
                          course.program_name ||
                          '—'}
                      </td>

                      <td>{course.credits ?? '—'}</td>
                      <td>{isActive ? 'Active' : 'Inactive'}</td>

                      <td>
                        <div className="courses-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openEdit(course)}
                            aria-label={`Edit ${course.code}`}
                          >
                            <Pencil size={15} />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => toggleStatus(course)}
                            aria-label={`${isActive ? 'Deactivate' : 'Activate'
                              } ${course.code}`}
                          >
                            <Power size={15} />
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => deleteCourse(course)}
                              aria-label={`Delete ${course.code}`}
                            >
                              <Trash2 size={15} />
                              Delete
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
        )}
      </section>
    </main>
  );
}
