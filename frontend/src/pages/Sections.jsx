import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import departmentService from '../services/departmentService';
import programService from '../services/programService';
import courseService from '../services/courseService';
import instructorService from '../services/instructorService';
import sectionService from '../services/sectionService';
import academicYearService from '../services/academicYearService';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import '../styles/sections.css';

/*
 * Section management (Phase 6 — academic modules).
 *
 * A section is a delivery group of a course for a term. Every list, option and
 * count on this page is loaded from the real API; nothing is hard-coded.
 * Writes are admin-only (the backend enforces this too), so non-admins see a
 * read-only directory.
 */

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  courseId: '',
  section: '',
  sectionName: '',
  capacity: '',
  term: '',
  programId: '',
  academicYearId: '',
  semesterId: '',
  instructorId: '',
  isActive: true,
};

/* ------------------------------ helpers ------------------------------ */

function unwrap(payload) {
  let current = payload;
  for (let i = 0; i < 6 && current; i += 1) {
    if (current.data && typeof current.data === 'object') {
      current = current.data;
    } else {
      break;
    }
  }
  return current;
}

function getItems(payload, keys = []) {
  const current = unwrap(payload);
  if (Array.isArray(current)) return current;
  for (const key of keys) {
    if (Array.isArray(current?.[key])) return current[key];
  }
  if (Array.isArray(current?.items)) return current.items;
  return [];
}

function getPagination(payload) {
  const current = unwrap(payload);
  return current?.pagination || {};
}

function getError(error) {
  if (Array.isArray(error?.details) && error.details.length) {
    return error.details
      .map((detail) => detail.message || detail.msg)
      .filter(Boolean)
      .join(' ');
  }
  return error?.message || 'The request failed. Please try again.';
}

function ActiveBadge({ active }) {
  return (
    <Badge tone={active ? 'success' : 'neutral'}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

function Notice({ notice, dismiss }) {
  if (!notice) return null;
  return (
    <div
      className={`notice ${notice.type === 'success' ? 'notice-success' : 'notice-danger'}`}
      role="status"
    >
      {notice.type === 'success' ? (
        <CheckCircle2 size={18} />
      ) : (
        <AlertCircle size={18} />
      )}
      <span>{notice.text}</span>
      <button
        type="button"
        className="sections-notice-close"
        onClick={dismiss}
        aria-label="Dismiss message"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* ------------------------------- page -------------------------------- */

export default function Sections() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin';
  const isDepartmentHead = user?.role === 'department_head';

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // A department head starts scoped to their own department.
  const [departmentFilter, setDepartmentFilter] = useState(
    isDepartmentHead && user?.departmentId ? String(user.departmentId) : '',
  );
  const [courseFilter, setCourseFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [courseOptions, setCourseOptions] = useState([]);
  const [programOptions, setProgramOptions] = useState([]);
  const [instructorOptions, setInstructorOptions] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [semesterOptions, setSemesterOptions] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  /* ---------------------------- data loading ---------------------------- */

  const loadSections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await sectionService.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        departmentId: departmentFilter || undefined,
        courseId: courseFilter || undefined,
        programId: programFilter || undefined,
        isActive: statusFilter === '' ? undefined : statusFilter === 'active',
        sort: 'section',
        order: 'asc',
      });

      setItems(getItems(response, ['sections']));
      const info = getPagination(response);
      setPagination({
        page: Number(info.page) || page,
        limit: Number(info.limit) || PAGE_SIZE,
        total: Number(info.total) || 0,
        totalPages: Math.max(
          1,
          Number(info.totalPages) ||
            Math.ceil((Number(info.total) || 0) / PAGE_SIZE),
        ),
      });
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, departmentFilter, courseFilter, programFilter, statusFilter]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const loadOptions = useCallback(async () => {
    const departmentId = departmentFilter || undefined;
    try {
      const [deptResult, courseResult, programResult, instructorResult, yearResult] =
        await Promise.all([
          departmentService.options(),
          courseService.options({ departmentId }),
          programService.options(departmentId),
          instructorService.options(departmentId),
          academicYearService.options(),
        ]);

      setDepartments(getItems(deptResult, ['departments']));
      setCourseOptions(getItems(courseResult, ['courses']));
      setProgramOptions(getItems(programResult, ['programs']));
      setInstructorOptions(getItems(instructorResult, ['instructors']));
      setYearOptions(getItems(yearResult, ['academicYears']));
    } catch {
      // The list request surfaces any API error to the user.
    }
  }, [departmentFilter]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Semesters depend on the selected academic year in the form.
  useEffect(() => {
    if (!formOpen || !form.academicYearId) {
      setSemesterOptions([]);
      return undefined;
    }

    let active = true;
    academicYearService
      .semesters(form.academicYearId, { limit: 100, sort: 'sequence', order: 'asc' })
      .then((response) => {
        if (active) setSemesterOptions(getItems(response, ['semesters']));
      })
      .catch(() => {
        if (active) setSemesterOptions([]);
      });

    return () => {
      active = false;
    };
  }, [formOpen, form.academicYearId]);

  /* ------------------------------ handlers ------------------------------ */

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setDepartmentFilter(
      isDepartmentHead && user?.departmentId ? String(user.departmentId) : '',
    );
    setCourseFilter('');
    setProgramFilter('');
    setStatusFilter('');
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, courseId: courseFilter || '' });
    setNotice(null);
    setFormOpen(true);
  }

  function openEdit(section) {
    setEditing(section);
    setForm({
      courseId: String(section.course?.id ?? ''),
      section: section.section || '',
      sectionName: section.sectionName || '',
      capacity: section.capacity != null ? String(section.capacity) : '',
      term: section.term || '',
      programId: String(section.program?.id ?? ''),
      academicYearId: String(section.academicYear?.id ?? ''),
      semesterId: String(section.semester?.id ?? ''),
      instructorId: String(section.instructor?.id ?? ''),
      isActive: section.isActive !== false,
    });
    setNotice(null);
    setFormOpen(true);
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((previous) => {
      const next = {
        ...previous,
        [name]: type === 'checkbox' ? checked : value,
      };
      // Changing the year invalidates the previously selected semester.
      if (name === 'academicYearId') next.semesterId = '';
      return next;
    });
  }

  async function submitForm(event) {
    event.preventDefault();
    setNotice(null);

    if (!form.courseId) {
      setNotice({ type: 'error', text: 'Please select a course for this section.' });
      return;
    }
    if (!form.section.trim()) {
      setNotice({ type: 'error', text: 'Section code is required.' });
      return;
    }
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setNotice({ type: 'error', text: 'Capacity must be a whole number of at least 1.' });
      return;
    }
    if (form.semesterId && !form.academicYearId) {
      setNotice({
        type: 'error',
        text: 'Select an academic year before choosing a semester.',
      });
      return;
    }

    const payload = {
      courseId: Number(form.courseId),
      section: form.section.trim().toUpperCase(),
      sectionName: form.sectionName.trim() || null,
      capacity,
      term: form.term.trim() || null,
      programId: form.programId ? Number(form.programId) : null,
      academicYearId: form.academicYearId ? Number(form.academicYearId) : null,
      semesterId: form.semesterId ? Number(form.semesterId) : null,
      instructorId: form.instructorId ? Number(form.instructorId) : null,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (editing) {
        await sectionService.update(editing.id, payload);
      } else {
        await sectionService.create(payload);
      }
      setNotice({
        type: 'success',
        text: `Section ${editing ? 'updated' : 'created'} successfully.`,
      });
      setFormOpen(false);
      await loadSections();
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(section) {
    const nextStatus = section.isActive === false;
    const label = `${section.course?.code || 'Section'} / ${section.section}`;

    if (
      !window.confirm(
        `${nextStatus ? 'Activate' : 'Deactivate'} section "${label}"?`,
      )
    ) {
      return;
    }

    setNotice(null);
    try {
      await sectionService.setStatus(section.id, nextStatus);
      setNotice({ type: 'success', text: 'Section status updated.' });
      await loadSections();
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
    }
  }

  /* ------------------------------- render ------------------------------- */

  const activeCount = items.filter((item) => item.isActive !== false).length;
  const totalCapacity = items.reduce(
    (total, item) => total + (Number(item.capacity) || 0),
    0,
  );
  const totalEnrolled = items.reduce(
    (total, item) => total + (Number(item.enrolledCount) || 0),
    0,
  );

  const firstRow =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const lastRow = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="page sections-page">
      <header className="page-header">
        <div>
          <div className="sections-eyebrow">
            <Layers size={16} />
            ACADEMIC MANAGEMENT
          </div>
          <h1>Sections</h1>
          <p>
            Delivery groups of courses for a term, with capacity and instructor
            assignment.
          </p>
        </div>
        <div className="sections-header-actions">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={loadSections}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'sections-spin' : ''} />
            Refresh
          </button>
          {canManage && (
            <button className="btn btn-primary" type="button" onClick={openCreate}>
              <Plus size={17} /> Add section
            </button>
          )}
        </div>
      </header>

      <Notice notice={notice} dismiss={() => setNotice(null)} />

      <section className="sections-stats">
        <article className="sections-stat card">
          <div className="sections-stat-icon purple"><Layers size={21} /></div>
          <div>
            <span>Sections shown</span>
            <strong>{loading ? '—' : pagination.total}</strong>
          </div>
        </article>
        <article className="sections-stat card">
          <div className="sections-stat-icon green"><CheckCircle2 size={21} /></div>
          <div>
            <span>Active on this page</span>
            <strong>{loading ? '—' : activeCount}</strong>
          </div>
        </article>
        <article className="sections-stat card">
          <div className="sections-stat-icon blue"><Users size={21} /></div>
          <div>
            <span>Capacity on this page</span>
            <strong>{loading ? '—' : totalCapacity.toLocaleString()}</strong>
          </div>
        </article>
        <article className="sections-stat card">
          <div className="sections-stat-icon amber"><GraduationCap size={21} /></div>
          <div>
            <span>Enrolled on this page</span>
            <strong>{loading ? '—' : totalEnrolled.toLocaleString()}</strong>
          </div>
        </article>
      </section>

      <section className="card sections-panel">
        <div className="sections-toolbar">
          <form className="sections-search" onSubmit={submitSearch}>
            <Search size={18} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by section code, course, or term…"
              aria-label="Search sections"
            />
            <button className="btn btn-primary" type="submit">Search</button>
          </form>

          <select
            className="input sections-filter"
            aria-label="Filter by department"
            value={departmentFilter}
            onChange={(event) => {
              setDepartmentFilter(event.target.value);
              setCourseFilter('');
              setProgramFilter('');
              setPage(1);
            }}
            disabled={isDepartmentHead}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.code} — {department.name}
              </option>
            ))}
          </select>

          <select
            className="input sections-filter"
            aria-label="Filter by course"
            value={courseFilter}
            onChange={(event) => {
              setCourseFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All courses</option>
            {courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.title}
              </option>
            ))}
          </select>

          <select
            className="input sections-filter"
            aria-label="Filter by program"
            value={programFilter}
            onChange={(event) => {
              setProgramFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All programs</option>
            {programOptions.map((program) => (
              <option key={program.id} value={program.id}>
                {program.code} — {program.name}
              </option>
            ))}
          </select>

          <select
            className="input sections-filter"
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button className="btn btn-ghost" type="button" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div className="table-wrap">
          <table className="table sections-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Course</th>
                <th>Term</th>
                <th>Program</th>
                <th>Instructor</th>
                <th>Capacity</th>
                <th>Enrolled</th>
                <th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="sections-message">
                    <span className="spinner" /> Loading sections…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="sections-message">
                    <Layers size={28} />
                    <strong>No sections found</strong>
                    <span>
                      Adjust your filters or add a section if you have permission.
                    </span>
                  </td>
                </tr>
              ) : (
                items.map((section) => (
                  <tr key={section.id}>
                    <td>
                      <div className="sections-primary">
                        <strong>{section.section}</strong>
                        {section.sectionName && <span>{section.sectionName}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="sections-course">
                        <BookOpen size={14} />
                        {section.course
                          ? `${section.course.code} — ${section.course.title}`
                          : '—'}
                      </span>
                    </td>
                    <td>{section.term || '—'}</td>
                    <td>
                      {section.program
                        ? `${section.program.code} — ${section.program.name}`
                        : '—'}
                    </td>
                    <td>{section.instructor?.fullName || '—'}</td>
                    <td>{section.capacity ?? '—'}</td>
                    <td>{section.enrolledCount ?? 0}</td>
                    <td>
                      <ActiveBadge active={section.isActive !== false} />
                    </td>
                    {canManage && (
                      <td>
                        <div className="sections-actions">
                          <button
                            className="btn btn-icon"
                            type="button"
                            title="Edit section"
                            onClick={() => openEdit(section)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="btn btn-icon"
                            type="button"
                            title={
                              section.isActive === false ? 'Activate' : 'Deactivate'
                            }
                            onClick={() => changeStatus(section)}
                          >
                            {section.isActive === false ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <XCircle size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="sections-footer">
          <span className="text-sm text-muted">
            Showing <strong>{firstRow}</strong>–<strong>{lastRow}</strong> of{' '}
            <strong>{pagination.total}</strong>
          </span>

          <div className="sections-pager">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || pagination.page <= 1}
            >
              Previous
            </button>
            <span className="sections-page">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setPage((current) =>
                  Math.min(pagination.totalPages, current + 1),
                )
              }
              disabled={loading || pagination.page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      {formOpen && (
        <Modal
          title={editing ? 'Edit section' : 'Add section'}
          subtitle={
            editing
              ? 'Update the section details below.'
              : 'Create a delivery group for a course.'
          }
          onClose={() => {
            if (!saving) setFormOpen(false);
          }}
          size="lg"
          footer={
            <>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                form="sections-form"
                disabled={saving}
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create section'}
              </button>
            </>
          }
        >
          <form id="sections-form" className="sections-form" onSubmit={submitForm}>
            <label className="field">
              <span className="field-label">Course *</span>
              <select
                className="input"
                name="courseId"
                value={form.courseId}
                onChange={updateField}
                required
                disabled={saving || courseOptions.length === 0}
              >
                <option value="">Select a course…</option>
                {courseOptions.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} — {course.title}
                  </option>
                ))}
              </select>
              {courseOptions.length === 0 && (
                <small className="field-hint">
                  No active courses are available. Change the department filter or
                  add a course first.
                </small>
              )}
            </label>

            <div className="sections-form-grid">
              <label className="field">
                <span className="field-label">Section code *</span>
                <input
                  className="input"
                  name="section"
                  value={form.section}
                  onChange={updateField}
                  required
                  maxLength="10"
                  pattern="[A-Za-z0-9._-]{1,10}"
                  placeholder="e.g. A"
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span className="field-label">Capacity *</span>
                <input
                  className="input"
                  type="number"
                  name="capacity"
                  value={form.capacity}
                  onChange={updateField}
                  required
                  min="1"
                  max="65535"
                  step="1"
                  placeholder="e.g. 60"
                  disabled={saving}
                />
              </label>
            </div>

            <div className="sections-form-grid">
              <label className="field">
                <span className="field-label">Section name</span>
                <input
                  className="input"
                  name="sectionName"
                  value={form.sectionName}
                  onChange={updateField}
                  maxLength="100"
                  placeholder="Optional label"
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span className="field-label">Term</span>
                <input
                  className="input"
                  name="term"
                  value={form.term}
                  onChange={updateField}
                  maxLength="30"
                  placeholder="e.g. 2025/26 Sem 1"
                  disabled={saving}
                />
              </label>
            </div>

            <div className="sections-form-grid">
              <label className="field">
                <span className="field-label">Program</span>
                <select
                  className="input"
                  name="programId"
                  value={form.programId}
                  onChange={updateField}
                  disabled={saving}
                >
                  <option value="">Not set</option>
                  {programOptions.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.code} — {program.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Instructor</span>
                <select
                  className="input"
                  name="instructorId"
                  value={form.instructorId}
                  onChange={updateField}
                  disabled={saving}
                >
                  <option value="">Not assigned</option>
                  {instructorOptions.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.fullName || instructor.staffNumber || `#${instructor.id}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="sections-form-grid">
              <label className="field">
                <span className="field-label">Academic year</span>
                <select
                  className="input"
                  name="academicYearId"
                  value={form.academicYearId}
                  onChange={updateField}
                  disabled={saving}
                >
                  <option value="">Not set</option>
                  {yearOptions.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.code} — {year.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Semester</span>
                <select
                  className="input"
                  name="semesterId"
                  value={form.semesterId}
                  onChange={updateField}
                  disabled={saving || !form.academicYearId}
                >
                  <option value="">Not set</option>
                  {semesterOptions.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="sections-checkbox">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={updateField}
                disabled={saving}
              />
              <span>Section is active</span>
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
