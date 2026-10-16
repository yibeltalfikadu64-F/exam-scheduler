
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  BookOpen,
  X,
  Users,
  UserRound,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import api from '../services/api';
import studentService from '../services/studentService';
import { useAuth } from '../context/AuthContext';
import '../styles/students.css';

const EMPTY_FORM = {
  studentNumber: '',
  fullName: '',
  email: '',
  phone: '',
  programId: '',
  year: '1',
  status: 'active',
};

const STUDENT_NUMBER_MAX_LENGTH = 100;

function extractItems(payload, keys = []) {
  let current = payload;

  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (Array.isArray(current)) return current;

    for (const key of keys) {
      if (Array.isArray(current[key])) return current[key];
    }

    if (Array.isArray(current.items)) return current.items;
    if (Array.isArray(current.data)) return current.data;

    current = current.data;
  }

  return [];
}

function errorMessage(error) {
  if (error?.details?.length) {
    return error.details
      .map((item) => item.message)
      .filter(Boolean)
      .join(' ');
  }

  return error?.message || 'The request failed. Please try again.';
}

function StatusBadge({ status }) {
  const normalized = String(status || 'unknown').toLowerCase();

  const variant = ['active', 'enrolled', 'completed'].includes(normalized)
    ? 'success'
    : ['suspended', 'dropped'].includes(normalized)
      ? 'danger'
      : normalized === 'graduated'
        ? 'info'
        : 'neutral';

  return (
    <span className={`students-status students-status-${variant}`}>
      {normalized}
    </span>
  );
}

function getProgramLabel(program) {
  const code = String(program.code || '').trim();
  const name = String(program.name || '').trim();

  if (code && name) return `${code} — ${name}`;
  return name || code || `Program ${program.id}`;
}

export default function Students() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [notice, setNotice] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [enrollmentSaving, setEnrollmentSaving] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);

    try {
      const result = await studentService.list({
        limit: 100,
        search: search || undefined,
        status: statusFilter || undefined,
        programId: programFilter || undefined,
        year: yearFilter || undefined,
        sort: 'full_name',
        order: 'asc',
      });

      setStudents(extractItems(result, ['students']));
      setNotice(null);
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, programFilter, yearFilter]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [programResult, sectionResult] = await Promise.all([
          api.get('/programs', {
            params: {
              limit: 100,
              isActive: true,
              order: 'asc',
            },
          }),
          api.get('/sections', {
            params: {
              limit: 100,
              isActive: true,
              order: 'asc',
            },
          }),
        ]);

        if (cancelled) return;

        const programItems = extractItems(programResult, ['programs']);
        const sectionItems = extractItems(sectionResult, ['sections']);

        setPrograms(
          programItems.filter(
            (program) =>
              program &&
              program.id !== undefined &&
              program.id !== null
          )
        );

        setSections(
          sectionItems.filter(
            (section) => section.isActive !== false
          )
        );
      } catch (error) {
        if (!cancelled) {
          setNotice((previous) =>
            previous || {
              type: 'error',
              text:
                errorMessage(error) ||
                'Program or section options could not be loaded.',
            }
          );
        }
      }
    }

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = useMemo(
    () => students.filter((student) => student.status === 'active').length,
    [students]
  );

  const enrolledCount = useMemo(
    () =>
      students.reduce(
        (total, student) => total + Number(student.enrolledCount || 0),
        0
      ),
    [students]
  );

  function openCreateForm() {
    setEditingStudent(null);
    setForm({ ...EMPTY_FORM });
    setNotice(null);
    setFormOpen(true);
  }

  function openEditForm(student) {
    setEditingStudent(student);

    setForm({
      studentNumber: student.studentNumber || '',
      fullName: student.fullName || '',
      email: student.email || '',
      phone: student.phone || '',
      programId: student.program?.id
        ? String(student.program.id)
        : '',
      year: String(student.year || 1),
      status: student.status || 'active',
    });

    setNotice(null);
    setFormOpen(true);
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function submitStudent(event) {
    event.preventDefault();

    const studentNumber = form.studentNumber.trim();
    const fullName = form.fullName.trim();

    if (!studentNumber) {
      setNotice({
        type: 'error',
        text: 'Student number is required.',
      });
      return;
    }

    if (studentNumber.length > STUDENT_NUMBER_MAX_LENGTH) {
      setNotice({
        type: 'error',
        text: 'Student number cannot exceed 100 characters.',
      });
      return;
    }

    if (fullName.length < 2 || fullName.length > 150) {
      setNotice({
        type: 'error',
        text: 'Full name must be 2–150 characters.',
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    const payload = {
      studentNumber,
      fullName,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      programId: form.programId ? Number(form.programId) : null,
      year: Number(form.year),
      status: form.status,
    };

    try {
      if (editingStudent) {
        await studentService.update(editingStudent.id, payload);

        setNotice({
          type: 'success',
          text: 'Student updated successfully.',
        });
      } else {
        await studentService.create(payload);

        setNotice({
          type: 'success',
          text: 'Student registered successfully.',
        });
      }

      setFormOpen(false);
      setEditingStudent(null);
      setForm({ ...EMPTY_FORM });

      await loadStudents();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  async function openEnrollments(student) {
    setSelectedStudent(student);
    setEnrollments([]);
    setSectionId('');
    setEnrollmentLoading(true);
    setNotice(null);

    try {
      const result = await studentService.listEnrollments(student.id);
      setEnrollments(extractItems(result, ['enrollments']));
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    } finally {
      setEnrollmentLoading(false);
    }
  }

  async function addEnrollment(event) {
    event.preventDefault();

    if (!selectedStudent || !sectionId) return;

    setEnrollmentSaving(true);
    setNotice(null);

    try {
      await studentService.addEnrollment(
        selectedStudent.id,
        Number(sectionId)
      );

      const result = await studentService.listEnrollments(
        selectedStudent.id
      );

      setEnrollments(extractItems(result, ['enrollments']));
      setSectionId('');

      setNotice({
        type: 'success',
        text: 'Student enrolled successfully.',
      });

      await loadStudents();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    } finally {
      setEnrollmentSaving(false);
    }
  }

  async function changeEnrollmentStatus(enrollment, status) {
    if (!selectedStudent) return;

    setNotice(null);

    try {
      await studentService.setEnrollmentStatus(
        selectedStudent.id,
        enrollment.id,
        status
      );

      const result = await studentService.listEnrollments(
        selectedStudent.id
      );

      setEnrollments(extractItems(result, ['enrollments']));

      setNotice({
        type: 'success',
        text: `Enrollment marked ${status}.`,
      });

      await loadStudents();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    }
  }

  async function changeStudentStatus(student, status) {
    if (
      !window.confirm(
        `Change ${student.fullName}'s status to "${status}"?`
      )
    ) {
      return;
    }

    setNotice(null);

    try {
      await studentService.setStatus(student.id, status);

      setNotice({
        type: 'success',
        text: 'Student status updated.',
      });

      await loadStudents();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    }
  }

  async function deleteStudentRecord(student) {
    const label = student.fullName || student.studentNumber || `Student #${student.id}`;

    if (
      !window.confirm(
        `Delete student "${label}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setNotice(null);

    try {
      await studentService.remove(student.id);

      setNotice({
        type: 'success',
        text: 'Student deleted successfully.',
      });

      await loadStudents();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function closeStudentForm() {
    if (saving) return;

    setFormOpen(false);
    setEditingStudent(null);
  }

  const availableSections = sections.filter((section) => {
    const capacity = Number(section.capacity || 0);
    const enrolled = Number(section.enrolledCount || 0);

    return capacity > enrolled;
  });

  return (
    <div className="page students-page">
      <header className="page-header students-page-header">
        <div>
          <div className="students-eyebrow">
            <GraduationCap size={16} />
            ACADEMIC MANAGEMENT
          </div>

          <h1>Students &amp; Enrollments</h1>

          <p>
            Manage student records, academic standing, and course-section
            registrations.
          </p>
        </div>

        <div className="students-header-actions">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={loadStudents}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? 'students-spin' : ''}
            />
            Refresh
          </button>

          <button
            className="btn btn-primary"
            type="button"
            onClick={openCreateForm}
          >
            <Plus size={17} />
            Add student
          </button>
        </div>
      </header>

      {notice && (
        <div
          className={`students-notice students-notice-${notice.type}`}
          role="status"
        >
          {notice.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}

          <span>{notice.text}</span>

          <button
            className="students-notice-close"
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="students-stats" aria-label="Student statistics">
        <article className="students-stat-card">
          <div className="students-stat-icon students-stat-purple">
            <Users size={20} />
          </div>
          <div>
            <span>Total shown</span>
            <strong>{loading ? '—' : students.length}</strong>
          </div>
        </article>

        <article className="students-stat-card">
          <div className="students-stat-icon students-stat-green">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>Active students shown</span>
            <strong>{loading ? '—' : activeCount}</strong>
          </div>
        </article>

        <article className="students-stat-card">
          <div className="students-stat-icon students-stat-blue">
            <BookOpen size={20} />
          </div>
          <div>
            <span>Enrollments represented</span>
            <strong>{loading ? '—' : enrolledCount}</strong>
          </div>
        </article>
      </section>

      <section className="card students-panel">
        <div className="students-toolbar">
          <form className="students-search" onSubmit={submitSearch}>
            <Search size={18} />

            <input
              aria-label="Search students"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, student number, or email..."
            />

            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </form>

          <div className="students-filters">
            <select
              aria-label="Filter by program"
              className="input"
              value={programFilter}
              onChange={(event) => setProgramFilter(event.target.value)}
            >
              <option value="">All programs</option>

              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {getProgramLabel(program)}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by year"
              className="input"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="">All years</option>

              {[1, 2, 3, 4, 5, 6, 7, 8].map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by student status"
              className="input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>

              {['active', 'inactive', 'graduated', 'suspended'].map(
                (status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="students-table-heading">
          <div>
            <h2>Student directory</h2>
            <p>Student information and current enrollment counts</p>
          </div>

          <span className="students-result-count">
            {students.length} shown
          </span>
        </div>

        <div className="table-wrap">
          <table className="table students-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Program</th>
                <th>Year</th>
                <th>Enrollments</th>
                <th>Status</th>
                <th className="students-actions-heading">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6">
                    <div className="students-loading">
                      <span className="spinner" />
                      Loading students…
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <UserRound size={24} />
                      </div>

                      <div className="empty-state-title">
                        No students found
                      </div>

                      <p>
                        Try changing the filters or register a new student.
                      </p>

                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={openCreateForm}
                      >
                        <Plus size={16} />
                        Add student
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="students-person">
                        <div className="students-avatar">
                          {(student.fullName || '?')
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="students-person-info">
                          <strong>{student.fullName}</strong>
                          <span>{student.studentNumber}</span>
                          <small>
                            {student.email || 'No email provided'}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="students-program">
                        <strong>{student.program?.code || '—'}</strong>
                        <span>
                          {student.program?.name || 'Not assigned'}
                        </span>
                      </div>
                    </td>

                    <td>Year {student.year || 1}</td>

                    <td>
                      <span className="students-enrollment-count">
                        {student.enrolledCount || 0}
                      </span>
                    </td>

                    <td>
                      <StatusBadge status={student.status} />
                    </td>

                    <td>
                      <div className="students-row-actions">
                        <button
                          className="btn btn-icon"
                          type="button"
                          title="Edit student"
                          aria-label={`Edit ${student.fullName}`}
                          onClick={() => openEditForm(student)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="btn btn-icon"
                          type="button"
                          title="Manage enrollments"
                          aria-label={`Manage enrollments for ${student.fullName}`}
                          onClick={() => openEnrollments(student)}
                        >
                          <BookOpen size={16} />
                        </button>

                        {student.status === 'active' ? (
                          <button
                            className="btn btn-icon"
                            type="button"
                            title="Deactivate student"
                            aria-label={`Deactivate ${student.fullName}`}
                            onClick={() =>
                              changeStudentStatus(student, 'inactive')
                            }
                          >
                            <X size={16} />
                          </button>
                        ) : student.status === 'inactive' ? (
                          <button
                            className="btn btn-icon"
                            type="button"
                            title="Activate student"
                            aria-label={`Activate ${student.fullName}`}
                            onClick={() =>
                              changeStudentStatus(student, 'active')
                            }
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        ) : null}

                        {isAdmin && (
                          <button
                            className="btn btn-icon students-delete"
                            type="button"
                            title="Delete student"
                            aria-label={`Delete ${student.fullName}`}
                            onClick={() => deleteStudentRecord(student)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="students-table-footer">
          <span>
            Showing up to 100 records for the selected filters.
          </span>
        </div>
      </section>

      {formOpen && (
        <div
          className="students-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              closeStudentForm();
            }
          }}
        >
          <section
            className="students-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-form-title"
          >
            <div className="students-modal-header">
              <div>
                <span className="students-eyebrow">STUDENT RECORD</span>

                <h2 id="student-form-title">
                  {editingStudent ? 'Edit student' : 'Register student'}
                </h2>

                <p>
                  Enter the student's academic and contact information.
                </p>
              </div>

              <button
                className="btn btn-icon"
                type="button"
                aria-label="Close form"
                onClick={closeStudentForm}
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitStudent} className="students-form">
              <label className="field">
                <span className="field-label">Student number *</span>

                <input
                  className="input"
                  name="studentNumber"
                  value={form.studentNumber}
                  onChange={updateField}
                  required
                  maxLength={STUDENT_NUMBER_MAX_LENGTH}
                  placeholder="e.g. Student #1 / CS & AI"
                  disabled={saving || Boolean(editingStudent)}
                />

                <small className="field-hint">
                  Any characters are allowed. Maximum 100 characters.
                </small>

                {editingStudent && (
                  <small className="field-hint">
                    Student number cannot be changed here.
                  </small>
                )}
              </label>

              <label className="field">
                <span className="field-label">Full name *</span>

                <input
                  className="input"
                  name="fullName"
                  value={form.fullName}
                  onChange={updateField}
                  required
                  minLength={2}
                  maxLength={150}
                  placeholder="Student full name"
                  disabled={saving}
                />
              </label>

              <div className="students-form-grid">
                <label className="field">
                  <span className="field-label">Email</span>

                  <input
                    className="input"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={updateField}
                    maxLength={150}
                    placeholder="student@example.com"
                    disabled={saving}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Phone</span>

                  <input
                    className="input"
                    name="phone"
                    value={form.phone}
                    onChange={updateField}
                    maxLength={20}
                    placeholder="Phone number"
                    disabled={saving}
                  />
                </label>
              </div>

              <div className="students-form-grid">
                <label className="field">
                  <span className="field-label">Program</span>

                  <select
                    className="input"
                    name="programId"
                    value={form.programId}
                    onChange={updateField}
                    disabled={saving}
                  >
                    <option value="">No program assigned</option>

                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {getProgramLabel(program)}
                      </option>
                    ))}
                  </select>

                  {programs.length === 0 && (
                    <small className="field-hint">
                      No program records were returned. Check the programs
                      endpoint and database records.
                    </small>
                  )}
                </label>

                <label className="field">
                  <span className="field-label">Year of study *</span>

                  <select
                    className="input"
                    name="year"
                    value={form.year}
                    onChange={updateField}
                    required
                    disabled={saving}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((year) => (
                      <option key={year} value={year}>
                        Year {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span className="field-label">Academic status</span>

                <select
                  className="input"
                  name="status"
                  value={form.status}
                  onChange={updateField}
                  disabled={saving}
                >
                  {[
                    'active',
                    'inactive',
                    'graduated',
                    'suspended',
                  ].map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="students-modal-actions">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={closeStudentForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving…'
                    : editingStudent
                      ? 'Save changes'
                      : 'Register student'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedStudent && (
        <div
          className="students-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !enrollmentSaving
            ) {
              setSelectedStudent(null);
            }
          }}
        >
          <section
            className="students-modal students-enrollment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enrollment-title"
          >
            <div className="students-modal-header">
              <div>
                <span className="students-eyebrow">
                  COURSE REGISTRATION
                </span>

                <h2 id="enrollment-title">Manage enrollments</h2>

                <p>
                  {selectedStudent.fullName} ·{' '}
                  {selectedStudent.studentNumber}
                </p>
              </div>

              <button
                className="btn btn-icon"
                type="button"
                aria-label="Close enrollments"
                onClick={() => setSelectedStudent(null)}
                disabled={enrollmentSaving}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="students-add-enrollment"
              onSubmit={addEnrollment}
            >
              <label className="field">
                <span className="field-label">
                  Available course section
                </span>

                <select
                  className="input"
                  value={sectionId}
                  onChange={(event) => setSectionId(event.target.value)}
                  required
                  disabled={enrollmentSaving}
                >
                  <option value="">Select a section…</option>

                  {availableSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.course?.code || 'Course'} —{' '}
                      {section.course?.title || 'Untitled course'}
                      {' · Section '}
                      {section.sectionName || section.section || '—'}
                      {' · Seats '}
                      {Math.max(
                        0,
                        Number(section.capacity || 0) -
                        Number(section.enrolledCount || 0)
                      )}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={!sectionId || enrollmentSaving}
              >
                <Plus size={16} />
                {enrollmentSaving ? 'Enrolling…' : 'Enroll student'}
              </button>
            </form>

            <div className="students-enrollment-list">
              <h3>Current and previous enrollments</h3>

              {enrollmentLoading ? (
                <div className="students-loading">
                  <span className="spinner" />
                  Loading enrollments…
                </div>
              ) : enrollments.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <BookOpen size={22} />
                  </div>

                  <div className="empty-state-title">
                    No enrollments yet
                  </div>

                  <p>
                    Select an available section to enroll this student.
                  </p>
                </div>
              ) : (
                enrollments.map((enrollment) => (
                  <article
                    className="students-enrollment-item"
                    key={enrollment.id}
                  >
                    <div className="students-enrollment-icon">
                      <BookOpen size={18} />
                    </div>

                    <div className="students-enrollment-info">
                      <strong>
                        {enrollment.section?.course?.code || 'Course'} —{' '}
                        {enrollment.section?.course?.title ||
                          'Untitled course'}
                      </strong>

                      <span>
                        Section{' '}
                        {enrollment.section?.sectionName ||
                          enrollment.section?.section ||
                          '—'}
                        {enrollment.section?.term
                          ? ` · ${enrollment.section.term}`
                          : ''}
                      </span>

                      <StatusBadge status={enrollment.status} />
                    </div>

                    {enrollment.status === 'enrolled' && (
                      <div className="students-enrollment-actions">
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() =>
                            changeEnrollmentStatus(
                              enrollment,
                              'completed'
                            )
                          }
                        >
                          Complete
                        </button>

                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() =>
                            changeEnrollmentStatus(enrollment, 'dropped')
                          }
                        >
                          Drop
                        </button>
                      </div>
                    )}

                    {enrollment.status === 'dropped' && (
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() =>
                          changeEnrollmentStatus(enrollment, 'enrolled')
                        }
                      >
                        Re-enroll
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
