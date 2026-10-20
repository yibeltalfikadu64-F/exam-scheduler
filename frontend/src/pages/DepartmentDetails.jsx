import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Layers,
  LayoutGrid,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';

import api from '../services/api';
import departmentService from '../services/departmentService';
import programService from '../services/programService';
import courseService from '../services/courseService';
import studentService from '../services/studentService';
import instructorService from '../services/instructorService';
import roomService from '../services/roomService';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import DepartmentResourceTable from '../components/departments/DepartmentResourceTable';
import { formatDateTime } from '../utils/userMeta';
import './DepartmentDetails.css';

/*
 * Department detail page (Phase 2 — department-centred navigation).
 *
 * Every figure and list on this page comes from the real database through the
 * existing feature endpoints (`/departments/:id/stats`, `/programs`,
 * `/courses`, `/sections`, `/students`, `/instructors`, `/rooms`, `/exams`),
 * all filtered by `departmentId`. Nothing here is hard-coded or demo data.
 *
 * Rooms/buildings are shared university facilities, not department-owned, so
 * the facilities tab is clearly labelled as shared.
 */

// Stable fetchers keep the table's effect dependencies stable across renders.
const fetchSections = (params) => api.get('/sections', { params });
const fetchExams = (params) => api.get('/exams', { params });

const STUDENT_STATUS_TONES = {
  active: 'success',
  graduated: 'info',
  suspended: 'warning',
  withdrawn: 'danger',
  inactive: 'neutral',
};

const EXAM_STATUS_TONES = {
  draft: 'neutral',
  scheduled: 'info',
  confirmed: 'success',
  completed: 'primary',
  cancelled: 'danger',
};

function humanize(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function ActiveBadge({ active }) {
  return (
    <Badge tone={active ? 'success' : 'neutral'}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

function StudentStatusBadge({ status }) {
  if (!status) return <Badge tone="neutral">Unknown</Badge>;
  return (
    <Badge tone={STUDENT_STATUS_TONES[status] || 'neutral'}>
      {humanize(status)}
    </Badge>
  );
}

function ExamStatusBadge({ status }) {
  if (!status) return <Badge tone="neutral">Unknown</Badge>;
  return (
    <Badge tone={EXAM_STATUS_TONES[status] || 'neutral'}>{humanize(status)}</Badge>
  );
}

/* ------------------------------- Tabs ------------------------------- */

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'programs', label: 'Programs', icon: BookOpen },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'sections', label: 'Sections', icon: Layers },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'instructors', label: 'Instructors', icon: Users },
  { id: 'rooms', label: 'Rooms & Facilities', icon: DoorOpen },
  { id: 'exams', label: 'Examinations', icon: ClipboardList },
];

/* --------------------------- Table columns -------------------------- */

const PROGRAM_COLUMNS = [
  { key: 'code', header: 'Code' },
  { key: 'name', header: 'Program' },
  { key: 'degreeType', header: 'Degree', render: (row) => humanize(row.degreeType) },
  {
    key: 'durationYears',
    header: 'Duration',
    render: (row) => (row.durationYears ? `${row.durationYears} yrs` : '—'),
  },
  { key: 'courseCount', header: 'Courses' },
  { key: 'isActive', header: 'Status', render: (row) => <ActiveBadge active={row.isActive} /> },
];

const COURSE_COLUMNS = [
  { key: 'code', header: 'Code' },
  { key: 'title', header: 'Course' },
  { key: 'credits', header: 'Credits', render: (row) => row.credits ?? '—' },
  { key: 'program', header: 'Program', render: (row) => row.program?.code || '—' },
  {
    key: 'prerequisiteCount',
    header: 'Prerequisites',
    render: (row) => row.prerequisiteCount ?? 0,
  },
  { key: 'isActive', header: 'Status', render: (row) => <ActiveBadge active={row.isActive} /> },
];

const SECTION_COLUMNS = [
  { key: 'section', header: 'Section' },
  {
    key: 'course',
    header: 'Course',
    render: (row) =>
      row.course ? `${row.course.code} — ${row.course.title}` : '—',
  },
  { key: 'term', header: 'Term', render: (row) => row.term || '—' },
  { key: 'capacity', header: 'Capacity', render: (row) => row.capacity ?? '—' },
  { key: 'enrolledCount', header: 'Enrolled', render: (row) => row.enrolledCount ?? 0 },
  {
    key: 'instructor',
    header: 'Instructor',
    render: (row) => row.instructor?.fullName || '—',
  },
  { key: 'isActive', header: 'Status', render: (row) => <ActiveBadge active={row.isActive} /> },
];

const STUDENT_COLUMNS = [
  { key: 'studentNumber', header: 'Student No.' },
  { key: 'fullName', header: 'Name' },
  { key: 'program', header: 'Program', render: (row) => row.program?.code || '—' },
  { key: 'year', header: 'Year', render: (row) => row.year ?? '—' },
  { key: 'enrolledCount', header: 'Enrolled', render: (row) => row.enrolledCount ?? 0 },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StudentStatusBadge status={row.status} />,
  },
];

const INSTRUCTOR_COLUMNS = [
  { key: 'staffNumber', header: 'Staff No.' },
  {
    key: 'user',
    header: 'Name',
    render: (row) => row.user?.fullName || row.user?.username || '—',
  },
  { key: 'title', header: 'Title', render: (row) => row.title || '—' },
  { key: 'expertise', header: 'Expertise', render: (row) => row.expertise || '—' },
  {
    key: 'maxLoadHours',
    header: 'Max load',
    render: (row) => (row.maxLoadHours != null ? `${row.maxLoadHours} h` : '—'),
  },
  { key: 'isActive', header: 'Status', render: (row) => <ActiveBadge active={row.isActive} /> },
];

const ROOM_COLUMNS = [
  { key: 'name', header: 'Room' },
  {
    key: 'building',
    header: 'Building',
    render: (row) => row.building?.name || row.building?.code || '—',
  },
  { key: 'type', header: 'Type', render: (row) => humanize(row.type) },
  { key: 'capacity', header: 'Capacity', render: (row) => row.capacity ?? '—' },
  { key: 'floor', header: 'Floor', render: (row) => row.floor ?? '—' },
  { key: 'isActive', header: 'Status', render: (row) => <ActiveBadge active={row.isActive} /> },
];

const EXAM_COLUMNS = [
  { key: 'title', header: 'Exam' },
  {
    key: 'course',
    header: 'Course',
    render: (row) => (row.course ? `${row.course.code} — ${row.course.title}` : '—'),
  },
  { key: 'examType', header: 'Type', render: (row) => humanize(row.examType) },
  {
    key: 'durationMinutes',
    header: 'Duration',
    render: (row) => (row.durationMinutes ? `${row.durationMinutes} min` : '—'),
  },
  { key: 'enrollmentCount', header: 'Students', render: (row) => row.enrollmentCount ?? 0 },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <ExamStatusBadge status={row.status} />,
  },
];

/* --------------------------- Overview stats -------------------------- */

const STAT_CONFIG = [
  { key: 'programs', label: 'Programs', icon: BookOpen, tone: 'primary' },
  { key: 'courses', label: 'Courses', icon: BookOpen, tone: 'info', hintKey: 'activeCourses', hintLabel: 'active' },
  { key: 'sections', label: 'Sections', icon: Layers, tone: 'info' },
  { key: 'students', label: 'Active students', icon: GraduationCap, tone: 'success' },
  { key: 'instructors', label: 'Instructors', icon: Users, tone: 'primary' },
  { key: 'invigilators', label: 'Invigilators', icon: Users, tone: 'info' },
  { key: 'exams', label: 'Exams', icon: ClipboardList, tone: 'warning', hintKey: 'unscheduledExams', hintLabel: 'unscheduled' },
  { key: 'scheduledExams', label: 'Scheduled exams', icon: CalendarClock, tone: 'success' },
  { key: 'schedules', label: 'Exam schedules', icon: CalendarClock, tone: 'primary' },
  { key: 'openConflicts', label: 'Open conflicts', icon: ShieldAlert, tone: 'danger' },
];

function StatCard({ config, value, hint }) {
  const Icon = config.icon;
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className={`stat-icon stat-icon-${config.tone}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className="stat-value">{value ?? 0}</p>
      <p className="stat-label">{config.label}</p>
      {hint ? <p className="stat-delta">{hint}</p> : null}
    </article>
  );
}

function OverviewTab({ department, stats }) {
  const shared = stats?.shared || {};

  return (
    <div className="dept-overview">
      <div className="dept-stat-grid">
        {STAT_CONFIG.map((config) => {
          const hint =
            config.hintKey && stats
              ? `${stats[config.hintKey] ?? 0} ${config.hintLabel}`
              : null;
          return (
            <StatCard
              key={config.key}
              config={config}
              value={stats ? stats[config.key] : 0}
              hint={hint}
            />
          );
        })}

        <StatCard
          config={{ label: 'Available rooms (shared)', icon: DoorOpen, tone: 'info' }}
          value={shared.activeRooms ?? 0}
          hint={`${shared.buildings ?? 0} buildings`}
        />
      </div>

      <div className="dept-overview-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>
              <Building2 size={18} /> Department record
            </h3>
          </div>
          <dl className="dept-info-list">
            <div className="dept-info-row">
              <dt>Code</dt>
              <dd>{department.code || '—'}</dd>
            </div>
            <div className="dept-info-row">
              <dt>Head</dt>
              <dd>
                {department.head?.fullName || department.head?.username || 'Not assigned'}
              </dd>
            </div>
            <div className="dept-info-row">
              <dt>Status</dt>
              <dd>
                <ActiveBadge active={department.isActive} />
              </dd>
            </div>
            <div className="dept-info-row">
              <dt>Created</dt>
              <dd>{formatDateTime(department.createdAt)}</dd>
            </div>
            <div className="dept-info-row">
              <dt>Last updated</dt>
              <dd>{formatDateTime(department.updatedAt)}</dd>
            </div>
            <div className="dept-info-row">
              <dt>Description</dt>
              <dd>{department.description || 'No description provided.'}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>
              <DoorOpen size={18} /> Shared university facilities
            </h3>
          </div>
          <div className="panel-body-padded dept-shared-note">
            <p>
              Buildings and rooms are shared across the university rather than
              owned by a single department. The numbers below are
              institution-wide and are shown for scheduling context only.
            </p>
            <div className="dept-shared-figures">
              <div>
                <span className="stat-value">{shared.activeRooms ?? 0}</span>
                <span className="stat-label">Active rooms</span>
              </div>
              <div>
                <span className="stat-value">{shared.buildings ?? 0}</span>
                <span className="stat-label">Buildings</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ----------------------------- Page shell ---------------------------- */

export default function DepartmentDetails() {
  const { departmentId } = useParams();
  const parsedId = Number(departmentId);
  const isValidId = Number.isInteger(parsedId) && parsedId > 0;

  const [state, setState] = useState({
    status: 'loading',
    department: null,
    stats: null,
    error: null,
  });
  const [activeTab, setActiveTab] = useState('overview');

  const load = useCallback(async () => {
    if (!isValidId) {
      setState({ status: 'invalid', department: null, stats: null, error: null });
      return;
    }

    setState({ status: 'loading', department: null, stats: null, error: null });

    try {
      const response = await departmentService.stats(parsedId);
      const payload = response?.data ?? {};
      setState({
        status: 'ready',
        department: payload.department,
        stats: payload.stats,
        error: null,
      });
    } catch (error) {
      setState({
        status: error?.status === 404 ? 'notfound' : 'error',
        department: null,
        stats: null,
        error: error?.message || 'Could not load this department.',
      });
    }
  }, [parsedId, isValidId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div className="page">
        <div className="loading-block">
          <span className="spinner spinner-lg" />
          <span>Loading department…</span>
        </div>
      </div>
    );
  }

  if (state.status === 'notfound' || state.status === 'invalid') {
    return (
      <div className="page">
        <EmptyState
          icon={Building2}
          title={
            state.status === 'invalid'
              ? 'Invalid department'
              : 'Department not found'
          }
          description={
            state.status === 'invalid'
              ? 'The department id in the address is not valid.'
              : 'This department does not exist or may have been removed.'
          }
          action={
            <Link className="btn btn-primary" to="/departments">
              <ArrowLeft size={16} /> Back to departments
            </Link>
          }
        />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="page">
        <div className="panel">
          <div className="panel-body-padded">
            <div className="notice notice-danger" role="alert">
              {state.error}
            </div>
            <div className="dept-error-actions">
              <button type="button" className="btn btn-ghost" onClick={load}>
                <RefreshCw size={16} /> Retry
              </button>
              <Link className="btn btn-ghost" to="/departments">
                <ArrowLeft size={16} /> Back to departments
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { department, stats } = state;

  return (
    <div className="page">
      <nav className="dept-breadcrumb" aria-label="Breadcrumb">
        <Link to="/departments">Departments</Link>
        <span className="dept-breadcrumb-sep">/</span>
        <span className="dept-breadcrumb-current">{department.code}</span>
        <span className="dept-breadcrumb-sep">/</span>
        <span className="dept-breadcrumb-muted">{department.name}</span>
      </nav>

      <header className="panel dept-hero">
        <span className="dept-hero-icon">
          <Building2 size={26} />
        </span>

        <div className="dept-hero-main">
          <div className="dept-hero-title-row">
            <h2>{department.name}</h2>
            <Badge tone="neutral">{department.code}</Badge>
            <ActiveBadge active={department.isActive} />
          </div>
          <p className="dept-hero-desc">
            {department.description || 'No description provided for this department.'}
          </p>
          <div className="dept-hero-meta">
            <span>
              <Users size={14} />
              Head:{' '}
              {department.head?.fullName || department.head?.username || 'Not assigned'}
            </span>
          </div>
        </div>

        <div className="dept-hero-actions">
          <Link className="btn btn-ghost" to="/departments">
            <ArrowLeft size={16} /> All departments
          </Link>
          <button
            type="button"
            className="btn btn-icon"
            onClick={load}
            title="Refresh"
            aria-label="Refresh department"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <div className="dept-tabs" role="tablist" aria-label="Department sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`dept-tab${selected ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="dept-tab-panel" role="tabpanel">
        {activeTab === 'overview' && (
          <OverviewTab department={department} stats={stats} />
        )}

        {activeTab === 'programs' && (
          <DepartmentResourceTable
            key="programs"
            fetcher={programService.list}
            params={{ departmentId: parsedId }}
            columns={PROGRAM_COLUMNS}
            title="Programs"
            icon={BookOpen}
            searchPlaceholder="Search programs…"
            emptyTitle="No programs in this department"
            emptyDescription="Programs added to this department will appear here."
          />
        )}

        {activeTab === 'courses' && (
          <DepartmentResourceTable
            key="courses"
            fetcher={courseService.list}
            params={{ departmentId: parsedId }}
            columns={COURSE_COLUMNS}
            title="Courses"
            icon={BookOpen}
            searchPlaceholder="Search courses…"
            emptyTitle="No courses in this department"
            emptyDescription="Courses added to this department will appear here."
          />
        )}

        {activeTab === 'sections' && (
          <DepartmentResourceTable
            key="sections"
            fetcher={fetchSections}
            params={{ departmentId: parsedId }}
            columns={SECTION_COLUMNS}
            title="Sections"
            icon={Layers}
            searchPlaceholder="Search sections…"
            emptyTitle="No sections in this department"
            emptyDescription="Sections for this department's courses will appear here."
          />
        )}

        {activeTab === 'students' && (
          <DepartmentResourceTable
            key="students"
            fetcher={studentService.list}
            params={{ departmentId: parsedId }}
            columns={STUDENT_COLUMNS}
            title="Students"
            icon={GraduationCap}
            searchPlaceholder="Search students…"
            emptyTitle="No students in this department"
            emptyDescription="Students enrolled through this department's programs will appear here."
          />
        )}

        {activeTab === 'instructors' && (
          <DepartmentResourceTable
            key="instructors"
            fetcher={instructorService.list}
            params={{ departmentId: parsedId }}
            columns={INSTRUCTOR_COLUMNS}
            title="Instructors"
            icon={Users}
            searchPlaceholder="Search instructors…"
            emptyTitle="No instructors in this department"
            emptyDescription="Instructors assigned to this department will appear here."
          />
        )}

        {activeTab === 'rooms' && (
          <>
            <div className="notice dept-shared-banner">
              <DoorOpen size={18} />
              <span>
                Rooms and buildings are shared university facilities. They are
                not owned by this department, so the list below shows all
                institution-wide rooms available for scheduling.
              </span>
            </div>
            <DepartmentResourceTable
              key="rooms"
              fetcher={roomService.list}
              columns={ROOM_COLUMNS}
              title="Rooms (shared)"
              icon={DoorOpen}
              searchPlaceholder="Search rooms…"
              emptyTitle="No rooms recorded"
              emptyDescription="Rooms added to the university will appear here."
            />
          </>
        )}

        {activeTab === 'exams' && (
          <DepartmentResourceTable
            key="exams"
            fetcher={fetchExams}
            params={{ departmentId: parsedId }}
            columns={EXAM_COLUMNS}
            title="Examinations"
            icon={ClipboardList}
            searchPlaceholder="Search examinations…"
            emptyTitle="No examinations in this department"
            emptyDescription="Examinations created for this department's courses will appear here."
          />
        )}
      </div>
    </div>
  );
}
