
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, RefreshCw, Search, Plus, Pencil, Power, X,
} from 'lucide-react';
import courseService from '../services/courseService';
import departmentService from '../services/departmentService';
import programService from '../services/programService';
import './Courses.css'

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
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await courseService.list({ limit: 100 });
      setCourses(getItems(result, ['courses']));
    } catch (err) {
      setError(err?.message || 'Could not load courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const result = await departmentService.options();
      setDepartments(getItems(result, ['departments', 'options']));
    } catch (err) {
      setError(err?.message || 'Could not load departments.');
    }
  }, []);

  const loadPrograms = useCallback(async (departmentId) => {
    if (!departmentId) {
      setPrograms([]);
      return;
    }
    try {
      const result = await programService.options(departmentId);
      setPrograms(getItems(result, ['programs', 'options']));
    } catch (err) {
      setPrograms([]);
      setError(err?.message || 'Could not load programs.');
    }
  }, []);

  useEffect(() => {
    loadCourses();
    loadDepartments();
  }, [loadCourses, loadDepartments]);

  useEffect(() => {
    loadPrograms(form.departmentId);
  }, [form.departmentId, loadPrograms]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) =>
      `${course.code || ''} ${course.title || ''} ${course.department?.name || ''
        }`.toLowerCase().includes(query),
    );
  }, [courses, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setMessage('');
    setShowForm(true);
  }

  function openEdit(course) {
    setEditing(course);
    setForm({
      departmentId: String(course.department?.id ?? course.departmentId ?? ''),
      programId: String(course.program?.id ?? course.programId ?? ''),
      code: course.code || '',
      title: course.title || '',
      credits: course.credits ?? 3,
      description: course.description || '',
      isActive: course.isActive ?? true,
    });
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
  }

  async function submitForm(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const payload = {
      departmentId: Number(form.departmentId),
      programId: form.programId ? Number(form.programId) : null,
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      credits: Number(form.credits),
      description: form.description.trim(),
      isActive: Boolean(form.isActive),
    };

    if (!payload.departmentId || !payload.code || !payload.title) {
      setError('Department, course code, and title are required.');
      return;
    }
    if (!Number.isInteger(payload.credits) ||
      payload.credits < 1 || payload.credits > 30) {
      setError('Credits must be a whole number between 1 and 30.');
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
      setForm(emptyForm);
      await loadCourses();
    } catch (err) {
      setError(err?.message || 'Could not save the course.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(course) {
    const nextStatus = !course.isActive;
    const action = nextStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${action} "${course.code}"?`)) {
      return;
    }

    setError('');
    setMessage('');
    try {
      await courseService.setStatus(course.id, nextStatus);
      setMessage(`Course ${action}d successfully.`);
      await loadCourses();
    } catch (err) {
      setError(err?.message || `Could not ${action} the course.`);
    }
  }

  return (
    <main className="courses-page">
      <header className="page-header">
        <div>
          <h1><BookOpen size={25} /> Courses</h1>
          <p>Manage the university course catalogue.</p>
        </div>
        <div className="courses-actions">
          <button type="button" className="btn btn-secondary"
            onClick={loadCourses} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add course
          </button>
        </div>
      </header>

      {error && <div className="courses-error" role="alert">{error}</div>}
      {message && <div className="courses-success" role="status">{message}</div>}

      {showForm && (
        <section className="courses-panel" aria-labelledby="course-form-title">
          <header className="courses-form-header">
            <h2 id="course-form-title">
              {editing ? 'Edit course' : 'Create course'}
            </h2>
            <button type="button" className="btn btn-secondary"
              onClick={() => setShowForm(false)} aria-label="Close form">
              <X size={16} />
            </button>
          </header>

          <form onSubmit={submitForm} className="courses-form">
            <label>
              Department *
              <select name="departmentId" value={form.departmentId}
                onChange={changeField} required>
                <option value="">Select department</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.code}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Program (optional)
              <select name="programId" value={form.programId}
                onChange={changeField} disabled={!form.departmentId}>
                <option value="">No program</option>
                {programs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.code}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Course code *
              <input name="code" value={form.code} onChange={changeField}
                minLength={2} maxLength={20}
                pattern="[A-Za-z0-9._-]{2,20}" required />
            </label>

            <label>
              Course title *
              <input name="title" value={form.title} onChange={changeField}
                minLength={2} maxLength={200} required />
            </label>

            <label>
              Credits *
              <input type="number" name="credits" value={form.credits}
                onChange={changeField} min="1" max="30" step="1" required />
            </label>

            <label className="courses-description">
              Description
              <textarea name="description" value={form.description}
                onChange={changeField} maxLength={2000} rows={3} />
            </label>

            <label className="courses-checkbox">
              <input type="checkbox" name="isActive" checked={form.isActive}
                onChange={changeField} />
              Active
            </label>

            <div className="courses-form-actions">
              <button type="button" className="btn btn-secondary"
                onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create course'}
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
            <input type="search" placeholder="Search code, title, or department…"
              value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <span>{filteredCourses.length} course(s)</span>
        </div>

        {loading ? (
          <p className="courses-state" role="status">Loading courses…</p>
        ) : !error && filteredCourses.length === 0 ? (
          <p className="courses-state">
            {search ? 'No matching courses.' : 'No courses found. Add your first course.'}
          </p>
        ) : (
          <div className="courses-table-wrapper">
            <table className="courses-table">
              <thead>
                <tr>
                  <th>Code</th><th>Title</th><th>Department</th>
                  <th>Program</th><th>Credits</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course) => (
                  <tr key={course.id ?? course.uuid ?? course.code}>
                    <td>{course.code || '—'}</td>
                    <td>{course.title || '—'}</td>
                    <td>{course.department?.name || course.departmentName || '—'}</td>
                    <td>{course.program?.name || course.programName || '—'}</td>
                    <td>{course.credits ?? '—'}</td>
                    <td>{course.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <div className="courses-actions">
                        <button type="button" className="btn btn-secondary"
                          onClick={() => openEdit(course)} aria-label={`Edit ${course.code}`}>
                          <Pencil size={15} /> Edit
                        </button>
                        <button type="button" className="btn btn-secondary"
                          onClick={() => toggleStatus(course)}
                          aria-label={`${course.isActive ? 'Deactivate' : 'Activate'} ${course.code}`}>
                          <Power size={15} />
                          {course.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
