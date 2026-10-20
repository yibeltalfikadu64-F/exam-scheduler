import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import api from '../services/api';
import courseService from '../services/courseService';
import { useAuth } from '../context/AuthContext';
import './Exams.css';

const EXAM_TYPE_LABELS = {
  midterm: 'Midterm Exam',
  final: 'Final Exam',
  quiz: 'Quiz',
  practical: 'Practical Exam',
  supplementary: 'Supplementary Exam',
  other: 'Other Exam',
};

const EXAM_STATUS_VALUES = [
  'draft',
  'scheduled',
  'published',
  'cancelled',
  'completed',
];

// Backend-supported enumerations (mirrors exam.validator.js / the exams table).
// These are fallbacks; the live lists come from GET /exams/options.
const EXAM_TYPE_VALUES = [
  'midterm',
  'final',
  'supplementary',
  'quiz',
  'practical',
  'other',
];

const ROOM_TYPE_VALUES = ['lecture', 'lab', 'hall', 'seminar', 'other'];

const ROOM_TYPE_LABELS = {
  lecture: 'Lecture Room',
  lab: 'Laboratory',
  hall: 'Examination Hall',
  seminar: 'Seminar Room',
  other: 'Other',
};

// Exam list page size (backend default is 10; max 100).
const PAGE_SIZE = 10;

const initialForm = {
  courseId: '',
  sectionId: '',
  examPeriodId: '',
  academicYearId: '',
  semesterId: '',
  examType: 'final',
  durationMinutes: 120,
  requiredRoomType: 'lecture',
  requiredCapacity: '',
  notes: '',
};

function getItems(response, keys = []) {
  const body = response?.data ?? response;

  if (Array.isArray(body)) return body;

  const candidates = [body, body?.data, body?.data?.data];
  const arrayKeys = [...keys, 'items', 'results'];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;

    if (!candidate || typeof candidate !== 'object') continue;

    for (const key of arrayKeys) {
      if (Array.isArray(candidate[key])) return candidate[key];
    }
  }

  return [];
}

function getErrorMessage(error) {
  // api.js normalizes errors to { message, status, code, details }.
  const details = error?.details;

  if (Array.isArray(details) && details.length) {
    const messages = details
      .map((item) => {
        const field = item?.field ? `${item.field}: ` : '';
        return `${field}${item?.message ?? item?.msg ?? ''}`;
      })
      .filter((message) => message.trim() !== '');

    if (messages.length) {
      return `${error?.message ?? 'Validation failed.'} ${messages.join(' ')}`;
    }
  }

  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const messages = Object.entries(details).map(([field, message]) => {
      const value = Array.isArray(message)
        ? message.join(', ')
        : String(message);

      return `${field}: ${value}`;
    });

    if (messages.length) {
      return `${error?.message ?? 'Request failed.'} ${messages.join(' ')}`;
    }
  }

  return (
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

function getId(item) {
  return item?.id ?? item?.value ?? item?.uuid ?? '';
}

function getCourseLabel(course) {
  const code =
    course?.course_code ??
    course?.courseCode ??
    course?.code ??
    '';

  const title =
    course?.course_title ??
    course?.courseTitle ??
    course?.courseName ??
    course?.title ??
    course?.name ??
    '';

  return (
    [code, title].filter(Boolean).join(' — ') ||
    `Course ${getId(course)}`
  );
}

function getSectionLabel(section) {
  const name =
    section?.name ??
    section?.section_name ??
    section?.sectionName ??
    section?.section_code ??
    section?.sectionCode ??
    section?.code ??
    '';

  const program =
    section?.program?.name ??
    section?.program_name ??
    section?.programName ??
    '';

  const year =
    section?.year_level ??
    section?.yearLevel ??
    section?.year ??
    '';

  const labelParts = [name || `Section ${getId(section)}`];

  if (program) labelParts.push(program);
  if (year !== '') labelParts.push(`Year ${year}`);

  return labelParts.join(' — ');
}

function getAcademicYearLabel(year) {
  return (
    year?.name ??
    year?.code ??
    year?.academicYear ??
    year?.academic_year ??
    `Academic Year ${getId(year)}`
  );
}

function getSemesterSequence(semester) {
  const sequence =
    semester?.sequence ??
    semester?.semester_number ??
    semester?.semesterNumber ??
    semester?.semester_order ??
    semester?.semesterOrder;

  if (sequence !== undefined && sequence !== null && sequence !== '') {
    const number = Number(sequence);

    if (number === 1 || number === 2) return number;
  }

  const name = String(
    semester?.name ??
    semester?.semester_name ??
    semester?.semesterName ??
    semester?.title ??
    semester?.semester ??
    ''
  ).toLowerCase();

  if (
    name.includes('first') ||
    name.includes('semester 1') ||
    name.includes('semester one') ||
    name === '1'
  ) {
    return 1;
  }

  if (
    name.includes('second') ||
    name.includes('semester 2') ||
    name.includes('semester two') ||
    name === '2'
  ) {
    return 2;
  }

  return null;
}

function getSemesterLabel(semester) {
  const sequence = getSemesterSequence(semester);

  if (sequence === 1) return 'First Semester';
  if (sequence === 2) return 'Second Semester';

  return (
    semester?.name ??
    semester?.semester_name ??
    semester?.semesterName ??
    semester?.title ??
    'Semester'
  );
}

function getExamPeriodLabel(period) {
  return (
    period?.name ??
    period?.periodName ??
    period?.period_name ??
    period?.title ??
    period?.term ??
    `Exam Period ${getId(period)}`
  );
}

function getExamId(exam) {
  return exam?.id ?? exam?.uuid;
}

function getExamCourseLabel(exam) {
  if (exam?.course) return getCourseLabel(exam.course);

  return (
    exam?.courseTitle ??
    exam?.course_title ??
    exam?.course_code ??
    '—'
  );
}

function getExamType(exam) {
  return exam?.examType ?? exam?.exam_type ?? '—';
}

function getExamDuration(exam) {
  return exam?.durationMinutes ?? exam?.duration_minutes ?? '—';
}

function getExamSemesterLabel(exam) {
  if (exam?.semester && typeof exam.semester === 'object') {
    return getSemesterLabel(exam.semester);
  }

  return exam?.semesterName ?? exam?.semester_name ?? '—';
}

function getExamAcademicYearLabel(exam) {
  const year = exam?.academicYear ?? exam?.academic_year;

  if (year && typeof year === 'object') {
    return year.name ?? year.code ?? '—';
  }

  return exam?.academicYearName ?? exam?.academic_year_name ?? '—';
}

export default function Exams() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // Exam writes are admin-only. This mirrors the backend authorization policy
  // (exam.routes.js: CAN_WRITE = ['admin']), so the UI never offers an action
  // the API would reject with 403.
  const canWrite = isAdmin;

  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [exams, setExams] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [examPeriods, setExamPeriods] = useState([]);
  const [examOptions, setExamOptions] = useState(null);

  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const [editingExam, setEditingExam] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [actionId, setActionId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadExams = useCallback(async () => {
    const params = {
      page,
      limit: PAGE_SIZE,
      sort: 'created_at',
      order: 'desc',
    };

    if (appliedSearch) {
      params.search = appliedSearch;
    }

    const response = await api.get('/exams', { params });

    setExams(getItems(response, ['exams']));
    setPagination(response?.data?.pagination ?? null);
  }, [page, appliedSearch]);

  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);

    try {
      const response = await courseService.options({ limit: 100 });
      const items = getItems(response, ['courses']);

      setCourses(items);

      if (!items.length) {
        console.warn('Course options API returned no courses.', response);
      }
    } catch (err) {
      setCourses([]);
      throw err;
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  const loadSections = useCallback(async (courseId) => {
    if (!courseId) {
      setSections([]);
      return;
    }

    setSectionsLoading(true);

    try {
      const response = await api.get('/sections', {
        params: {
          courseId,
          limit: 100,
          isActive: true,
          order: 'asc',
        },
      });

      const items = getItems(response, ['sections']);

      setSections(
        items.filter(
          (section) =>
            section &&
            getId(section) !== '' &&
            section.isActive !== false &&
            section.is_active !== false
        )
      );
    } catch (err) {
      setSections([]);
      throw err;
    } finally {
      setSectionsLoading(false);
    }
  }, []);

  const loadExamOptions = useCallback(async () => {
    const response = await api.get('/exams/options');
    const options = response?.data ?? response;

    if (options && typeof options === 'object') {
      setExamOptions({
        examTypes: Array.isArray(options.examTypes) ? options.examTypes : null,
        roomTypes: Array.isArray(options.roomTypes) ? options.roomTypes : null,
      });
    }
  }, []);

  const loadAcademicDetails = useCallback(async () => {
    const [yearsResponse, periodsResponse] = await Promise.all([
      api.get('/academic-years'),
      api.get('/exam-periods'),
    ]);

    const years = getItems(yearsResponse, [
      'academicYears',
      'academic_years',
    ]);

    const periods = getItems(periodsResponse, [
      'examPeriods',
      'exam_periods',
      'periods',
    ]);

    setAcademicYears(years);
    setExamPeriods(periods);

    const semesterResponses = await Promise.all(
      years.map(async (year) => {
        try {
          const response = await api.get(
            `/academic-years/${getId(year)}/semesters`
          );

          return getItems(response, ['semesters']).map((semester) => ({
            ...semester,
            academicYearId:
              semester.academicYearId ??
              semester.academic_year_id ??
              semester.academicYear?.id ??
              semester.academic_year?.id ??
              getId(year),
          }));
        } catch (err) {
          console.error(
            `Unable to load semesters for academic year ${getId(year)}:`,
            err
          );

          return [];
        }
      })
    );

    const allSemesters = semesterResponses.flat();

    const uniqueSemesters = [
      ...new Map(
        allSemesters
          .filter((semester) => getSemesterSequence(semester) !== null)
          .map((semester) => [String(getId(semester)), semester])
      ).values(),
    ];

    setSemesters(uniqueSemesters);
  }, []);

  const loadReferenceData = useCallback(async () => {
    setError('');

    const results = await Promise.allSettled([
      loadCourses(),
      loadExamOptions(),
      loadAcademicDetails(),
    ]);

    const failed = results.find((result) => result.status === 'rejected');

    if (failed) {
      setError(getErrorMessage(failed.reason));
    }
  }, [loadCourses, loadExamOptions, loadAcademicDetails]);

  // Reference data (courses, options, calendar) loads once on mount.
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // The exam list reloads whenever the server-side page or applied search
  // changes, or when the user explicitly refreshes.
  useEffect(() => {
    let active = true;
    setLoading(true);

    loadExams()
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadExams, reloadKey]);

  // Debounce the search box into a server-side search term.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  // Load only the sections that belong to the selected course.
  useEffect(() => {
    if (!form.courseId) {
      setSections([]);
      return undefined;
    }

    let active = true;

    loadSections(form.courseId).catch((err) => {
      if (active) setError(getErrorMessage(err));
    });

    return () => {
      active = false;
    };
  }, [form.courseId, loadSections]);

  function handleRefresh() {
    setError('');
    loadReferenceData();
    setReloadKey((key) => key + 1);
  }

  const availableSemesters = useMemo(() => {
    if (!form.academicYearId) return [];

    return semesters.filter((semester) => {
      const yearId =
        semester.academicYearId ??
        semester.academic_year_id ??
        semester.academicYear?.id ??
        semester.academic_year?.id;

      return (
        yearId == null ||
        String(yearId) === String(form.academicYearId)
      );
    });
  }, [semesters, form.academicYearId]);

  const examTypeValues = useMemo(
    () =>
      examOptions?.examTypes?.length
        ? examOptions.examTypes
        : EXAM_TYPE_VALUES,
    [examOptions]
  );

  const roomTypeValues = useMemo(
    () =>
      examOptions?.roomTypes?.length
        ? examOptions.roomTypes
        : ROOM_TYPE_VALUES,
    [examOptions]
  );

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => {
      const next = { ...previous, [name]: value };

      if (name === 'academicYearId') {
        next.semesterId = '';
      }

      // A section belongs to exactly one course; drop an incompatible choice.
      if (name === 'courseId') {
        next.sectionId = '';
      }

      return next;
    });
  }

  function openCreateForm() {
    setError('');
    setMessage('');
    setForm({ ...initialForm });
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');
    setMessage('');

    if (!form.courseId) {
      setError('Please select a course.');
      return;
    }

    if (!form.sectionId) {
      setError('Please select a section.');
      return;
    }

    if (!form.academicYearId) {
      setError('Please select an academic year.');
      return;
    }

    if (!form.semesterId) {
      setError('Please select a semester.');
      return;
    }

    const duration = Number(form.durationMinutes);

    if (!Number.isInteger(duration) || duration <= 0) {
      setError('Duration must be a positive whole number.');
      return;
    }

    const capacity =
      form.requiredCapacity === ''
        ? null
        : Number(form.requiredCapacity);

    if (
      capacity !== null &&
      (!Number.isInteger(capacity) || capacity <= 0)
    ) {
      setError('Required capacity must be a positive whole number.');
      return;
    }

    const selectedCourse = courses.find(
      (course) => String(getId(course)) === String(form.courseId)
    );

    if (!selectedCourse) {
      setError(
        'The selected course is no longer available. Refresh and select it again.'
      );
      return;
    }

    const selectedSection = sections.find(
      (section) => String(getId(section)) === String(form.sectionId)
    );

    if (!selectedSection) {
      setError(
        'The selected section is no longer available. Refresh and select it again.'
      );
      return;
    }

    const courseTitle = getCourseLabel(selectedCourse);

    const title = `${courseTitle} — ${
      EXAM_TYPE_LABELS[form.examType] ?? 'Exam'
    }`;

    const payload = {
      title,
      courseId: Number(form.courseId),
      sectionId: Number(form.sectionId),
      academicYearId: Number(form.academicYearId),
      semesterId: Number(form.semesterId),
      examType: form.examType,
      durationMinutes: duration,
      requiredRoomType: form.requiredRoomType || null,
      requiredCapacity: capacity,
      notes: form.notes.trim() || null,
    };

    if (form.examPeriodId) {
      payload.examPeriodId = Number(form.examPeriodId);
    }

    setSaving(true);

    try {
      await api.post('/exams', payload);

      setMessage('Exam created successfully.');
      setShowForm(false);
      setForm({ ...initialForm });

      await loadExams();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openEditExam(exam) {
    setError('');
    setMessage('');
    setEditingExam(exam);
    setEditForm({
      examType: exam?.examType ?? 'final',
      durationMinutes: String(exam?.durationMinutes ?? 120),
      requiredRoomType: exam?.requiredRoomType ?? 'lecture',
      requiredCapacity:
        exam?.requiredCapacity != null ? String(exam.requiredCapacity) : '',
      notes: exam?.notes ?? '',
    });
  }

  function closeEditExam() {
    if (saving) return;
    setEditingExam(null);
    setEditForm(null);
  }

  function updateEditField(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!editingExam) return;

    const duration = Number(editForm.durationMinutes);

    if (!Number.isInteger(duration) || duration <= 0 || duration > 1440) {
      setError('Duration must be a whole number between 1 and 1440 minutes.');
      return;
    }

    const capacity =
      editForm.requiredCapacity === '' ? null : Number(editForm.requiredCapacity);

    if (
      capacity !== null &&
      (!Number.isInteger(capacity) || capacity <= 0 || capacity > 100000)
    ) {
      setError('Required capacity must be a positive whole number.');
      return;
    }

    const title = `${getExamCourseLabel(editingExam)} — ${
      EXAM_TYPE_LABELS[editForm.examType] ?? 'Exam'
    }`;

    const payload = {
      title,
      examType: editForm.examType,
      durationMinutes: Number(editForm.durationMinutes),
      requiredRoomType: editForm.requiredRoomType || null,
      requiredCapacity: capacity,
      notes: editForm.notes.trim() || null,
    };

    setSaving(true);
    try {
      await api.patch(`/exams/${getExamId(editingExam)}`, payload);
      setMessage('Exam updated successfully.');
      setEditingExam(null);
      setEditForm(null);
      await loadExams();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeExamStatus(exam, status) {
    if (status === exam.status) return;

    const id = getExamId(exam);
    setError('');
    setMessage('');
    setActionId(id);

    try {
      await api.patch(`/exams/${id}/status`, { status });
      setMessage(`Exam marked as ${status}.`);
      await loadExams();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  async function deleteExamRecord(exam) {
    const id = getExamId(exam);
    const label = exam.title || getExamCourseLabel(exam);

    if (!window.confirm(`Delete exam "${label}"? This cannot be undone.`)) {
      return;
    }

    setError('');
    setMessage('');
    setActionId(id);

    try {
      await api.delete(`/exams/${id}`);
      setMessage('Exam deleted successfully.');
      await loadExams();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="exams-page">
      <div className="exams-header">
        <div>
          <h1>
            <ClipboardList size={25} />
            Exams
          </h1>
          <p>
            Create and manage examinations before generating the schedule.
          </p>
        </div>

        <div className="exams-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {canWrite && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateForm}
            >
              <Plus size={16} />
              Create Exam
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="exams-alert exams-alert-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {message && (
        <div className="exams-alert exams-alert-success" role="status">
          <span>{message}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setMessage('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showForm && (
        <section className="exams-form-card">
          <div className="exams-form-header">
            <div>
              <h2>Create an exam</h2>
              <p>
                Select a course, section, academic year, semester, and exam
                requirements.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
            >
              <X size={16} />
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="exams-form">
              <div className="form-group">
                <label htmlFor="courseId">Course *</label>
                <select
                  id="courseId"
                  name="courseId"
                  value={form.courseId}
                  onChange={updateField}
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={getId(course)} value={getId(course)}>
                      {getCourseLabel(course)}
                    </option>
                  ))}
                </select>

                {coursesLoading && <small>Loading courses…</small>}

                {!coursesLoading && courses.length === 0 && (
                  <small>
                    No courses available. Refresh or check the browser console.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="sectionId">Section *</label>
                <select
                  id="sectionId"
                  name="sectionId"
                  value={form.sectionId}
                  onChange={updateField}
                  required
                >
                  <option value="">Select a section</option>
                  {sections.map((section) => (
                    <option key={getId(section)} value={getId(section)}>
                      {getSectionLabel(section)}
                    </option>
                  ))}
                </select>

                {sectionsLoading && <small>Loading sections…</small>}

                {!sectionsLoading && sections.length === 0 && (
                  <small>
                    No active sections available. Create or activate a section
                    before creating an exam.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="academicYearId">Academic Year *</label>
                <select
                  id="academicYearId"
                  name="academicYearId"
                  value={form.academicYearId}
                  onChange={updateField}
                  required
                >
                  <option value="">Select an academic year</option>
                  {academicYears.map((year) => (
                    <option key={getId(year)} value={getId(year)}>
                      {getAcademicYearLabel(year)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="semesterId">Semester *</label>
                <select
                  id="semesterId"
                  name="semesterId"
                  value={form.semesterId}
                  onChange={updateField}
                  required
                  disabled={!form.academicYearId}
                >
                  <option value="">Select a semester</option>
                  {availableSemesters.map((semester) => (
                    <option key={getId(semester)} value={getId(semester)}>
                      {getSemesterLabel(semester)}
                    </option>
                  ))}
                </select>

                {form.academicYearId &&
                  availableSemesters.length === 0 && (
                    <small>
                      No semester records found for this academic year.
                    </small>
                  )}
              </div>

              <div className="form-group">
                <label htmlFor="examPeriodId">Exam Period</label>
                <select
                  id="examPeriodId"
                  name="examPeriodId"
                  value={form.examPeriodId}
                  onChange={updateField}
                >
                  <option value="">Select an exam period (optional)</option>
                  {examPeriods.map((period) => (
                    <option key={getId(period)} value={getId(period)}>
                      {getExamPeriodLabel(period)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="examType">Exam Type *</label>
                <select
                  id="examType"
                  name="examType"
                  value={form.examType}
                  onChange={updateField}
                  required
                >
                  {examTypeValues.map((value) => (
                    <option key={value} value={value}>
                      {EXAM_TYPE_LABELS[value] ?? value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="durationMinutes">Duration (minutes) *</label>
                <input
                  id="durationMinutes"
                  name="durationMinutes"
                  type="number"
                  min="1"
                  step="1"
                  value={form.durationMinutes}
                  onChange={updateField}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="requiredRoomType">Required Room Type</label>
                <select
                  id="requiredRoomType"
                  name="requiredRoomType"
                  value={form.requiredRoomType}
                  onChange={updateField}
                >
                  {roomTypeValues.map((value) => (
                    <option key={value} value={value}>
                      {ROOM_TYPE_LABELS[value] ?? value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="requiredCapacity">Required Capacity</label>
                <input
                  id="requiredCapacity"
                  name="requiredCapacity"
                  type="number"
                  min="1"
                  step="1"
                  value={form.requiredCapacity}
                  onChange={updateField}
                  placeholder="Optional"
                />
              </div>

              <div className="form-group exams-form-full">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={form.notes}
                  onChange={updateField}
                  rows="3"
                  placeholder="Optional exam notes"
                />
              </div>
            </div>

            <div className="exams-form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || sections.length === 0}
              >
                {saving ? 'Saving…' : 'Create Exam'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="exams-table-card">
        <div className="exams-table-header">
          <h2>Examination List</h2>

          <div className="exams-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search exams..."
              aria-label="Search exams"
            />
          </div>
        </div>

        {loading ? (
          <p className="exams-empty">Loading exams…</p>
        ) : exams.length === 0 ? (
          <p className="exams-empty">No exams found.</p>
        ) : (
          <div className="exams-table-wrapper">
            <table className="exams-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Exam Type</th>
                  <th>Academic Year</th>
                  <th>Semester</th>
                  <th>Duration</th>
                  <th>Students</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredExams.map((exam, index) => {
                  const examId = getExamId(exam);
                  const busy = actionId === examId;

                  return (
                    <tr key={examId ?? index}>
                      <td>{getExamCourseLabel(exam)}</td>
                      <td>{getExamType(exam)}</td>
                      <td>{getExamAcademicYearLabel(exam)}</td>
                      <td>{getExamSemesterLabel(exam)}</td>
                      <td>{getExamDuration(exam)} min</td>
                      <td>
                        {exam.enrollmentCount ?? exam.enrollment_count ?? 0}
                      </td>
                      <td>
                        <span
                          className={`exam-status exam-status-${String(
                            exam.status ?? 'draft'
                          ).toLowerCase()}`}
                        >
                          {exam.status ?? 'draft'}
                        </span>
                      </td>
                      <td>
                        <div className="exams-row-actions">
                          {canWrite && (
                            <button
                              type="button"
                              className="exams-icon-btn"
                              onClick={() => openEditExam(exam)}
                              title="Edit exam"
                              aria-label={`Edit ${exam.title ?? examId}`}
                              disabled={busy}
                            >
                              <Pencil size={15} />
                            </button>
                          )}

                          {canWrite && (
                            <select
                              className="exams-status-select"
                              value={exam.status ?? 'draft'}
                              onChange={(event) =>
                                changeExamStatus(exam, event.target.value)
                              }
                              disabled={busy}
                              aria-label={`Change status for ${exam.title ?? examId}`}
                            >
                              {[
                                'draft',
                                'scheduled',
                                'published',
                                'cancelled',
                                'completed',
                              ].map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              className="exams-icon-btn exams-icon-btn-danger"
                              onClick={() => deleteExamRecord(exam)}
                              title="Delete exam"
                              aria-label={`Delete ${exam.title ?? examId}`}
                              disabled={busy}
                            >
                              <Trash2 size={15} />
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

      {editingExam && editForm && (
        <div
          className="exams-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) closeEditExam();
          }}
        >
          <section
            className="exams-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exams-edit-title"
          >
            <div className="exams-form-header">
              <div>
                <h2 id="exams-edit-title">Edit exam</h2>
                <p>
                  Update the exam type, duration, and room requirements. Course,
                  section, and calendar links stay fixed.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeEditExam}
                disabled={saving}
                aria-label="Close form"
              >
                <X size={16} />
                Close
              </button>
            </div>

            <div className="exams-edit-meta">
              <span>
                <strong>Course:</strong> {getExamCourseLabel(editingExam)}
              </span>
              <span>
                <strong>Academic year:</strong> {getExamAcademicYearLabel(editingExam)}
              </span>
              <span>
                <strong>Semester:</strong> {getExamSemesterLabel(editingExam)}
              </span>
              <span>
                <strong>Exam period:</strong>{' '}
                {editingExam.examPeriod
                  ? getExamPeriodLabel(editingExam.examPeriod)
                  : 'Not set'}
              </span>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="exams-form">
                <div className="form-group">
                  <label htmlFor="editExamType">Exam Type *</label>
                  <select
                    id="editExamType"
                    name="examType"
                    value={editForm.examType}
                    onChange={updateEditField}
                    required
                  >
                    {examTypeValues.map((value) => (
                      <option key={value} value={value}>
                        {EXAM_TYPE_LABELS[value] ?? value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="editDuration">Duration (minutes) *</label>
                  <input
                    id="editDuration"
                    name="durationMinutes"
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    value={editForm.durationMinutes}
                    onChange={updateEditField}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="editRoomType">Required Room Type</label>
                  <select
                    id="editRoomType"
                    name="requiredRoomType"
                    value={editForm.requiredRoomType}
                    onChange={updateEditField}
                  >
                    {roomTypeValues.map((value) => (
                      <option key={value} value={value}>
                        {ROOM_TYPE_LABELS[value] ?? value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="editCapacity">Required Capacity</label>
                  <input
                    id="editCapacity"
                    name="requiredCapacity"
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    value={editForm.requiredCapacity}
                    onChange={updateEditField}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-group exams-form-full">
                  <label htmlFor="editNotes">Notes</label>
                  <textarea
                    id="editNotes"
                    name="notes"
                    value={editForm.notes}
                    onChange={updateEditField}
                    rows="3"
                    maxLength={5000}
                    placeholder="Optional exam notes"
                  />
                </div>
              </div>

              {error && (
                <div className="exams-alert exams-alert-error" role="alert">
                  <span>{error}</span>
                </div>
              )}

              <div className="exams-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeEditExam}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}