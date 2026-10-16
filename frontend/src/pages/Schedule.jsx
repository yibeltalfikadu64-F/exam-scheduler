
import { useSearchParams } from 'react-router-dom';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';

import {
  Calendar,
  dateFnsLocalizer,
} from 'react-big-calendar';

import {
  format,
  parse,
  startOfWeek,
  getDay,
  set,
  parseISO,
} from 'date-fns';

import { enUS } from 'date-fns/locale/en-US';

import api from '../services/api';
import './Schedule.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const STATUSES = [
  'all',
  'draft',
  'generated',
  'reviewed',
  'published',
  'cancelled',
  'archived',
];

function unwrap(response) {
  let result = response?.data ?? response ?? {};

  for (let i = 0; i < 5; i += 1) {
    if (
      result &&
      typeof result === 'object' &&
      !Array.isArray(result) &&
      result.data &&
      typeof result.data === 'object' &&
      !Array.isArray(result.data) &&
      !Array.isArray(result.items) &&
      !Array.isArray(result.schedules) &&
      !Array.isArray(result.details) &&
      !Array.isArray(result.allocations) &&
      !result.schedule
    ) {
      result = result.data;
    } else {
      break;
    }
  }

  return result;
}

function getErrorMessage(error) {
  const status =
    error?.response?.status ??
    error?.status;

  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }

  const payload = error?.response?.data;

  const validationMessages = (
    payload?.details ??
    payload?.errors ??
    []
  )
    .map?.((item) => item?.message)
    .filter(Boolean)
    .join(' ');

  return (
    validationMessages ||
    payload?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

function parseExamDate(dateValue, timeValue = '00:00:00') {
  if (!dateValue) return null;

  const dateString =
    dateValue instanceof Date
      ? format(dateValue, 'yyyy-MM-dd')
      : String(dateValue).slice(0, 10);

  const parsed = parseISO(`${dateString}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const timeString = String(timeValue || '00:00:00');
  const match = timeString.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return parsed;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return set(parsed, {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  });
}

function formatTime(value) {
  if (!value) return 'Time unavailable';

  const match = String(value).match(/^(\d{1,2}):(\d{2})/);

  if (!match) return String(value);

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return String(value);
  }

  return format(
    set(new Date(2000, 0, 1), {
      hours,
      minutes,
      seconds: 0,
      milliseconds: 0,
    }),
    'h:mm a',
  );
}

function eventTitle(detail) {
  const course = detail?.course;
  const exam = detail?.exam;

  const courseLabel = course
    ? `${course.code ? `${course.code} — ` : ''}${course.title || ''}`.trim()
    : exam?.title ||
      detail?.courseTitle ||
      detail?.courseCode ||
      'Scheduled examination';

  return courseLabel || 'Scheduled examination';
}

function canEditSchedule(schedule) {
  return ['draft', 'generated', 'reviewed'].includes(
    schedule?.status,
  );
}

function getScheduleList(response) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.schedules)) return response.schedules;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data?.schedules)) {
    return response.data.schedules;
  }

  return [];
}

function getScheduleDetails(response) {
  const details =
    response?.details ??
    response?.schedule?.details ??
    response?.data?.details ??
    response?.data?.schedule?.details ??
    [];

  return Array.isArray(details) ? details : [];
}

function getScheduleConflicts(response) {
  const conflicts =
    response?.conflicts ??
    response?.schedule?.conflicts ??
    response?.data?.conflicts ??
    response?.data?.schedule?.conflicts ??
    [];

  return Array.isArray(conflicts) ? conflicts : [];
}

function getScheduleObject(response) {
  return (
    response?.schedule ??
    response?.data?.schedule ??
    (response?.id ? response : null)
  );
}

function getScheduleDate(detail) {
  return (
    detail?.examDate ??
    detail?.date ??
    detail?.exam?.examDate ??
    detail?.exam?.date ??
    detail?.timeSlot?.examDate ??
    null
  );
}

function getStartTime(detail) {
  return (
    detail?.startTime ??
    detail?.timeSlot?.startTime ??
    detail?.timeSlot?.start_time ??
    detail?.exam?.startTime ??
    null
  );
}

function getEndTime(detail) {
  return (
    detail?.endTime ??
    detail?.timeSlot?.endTime ??
    detail?.timeSlot?.end_time ??
    detail?.exam?.endTime ??
    null
  );
}

export default function Schedule() {
  const [searchParams] = useSearchParams();
  const requestedScheduleId = searchParams.get('scheduleId');

  const [schedules, setSchedules] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [scheduleData, setScheduleData] = useState(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [calendarView, setCalendarView] = useState('week');
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        page: 1,
        limit: 100,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const apiResponse = await api.get(
        '/scheduling/schedules',
        { params },
      );

      const response = unwrap(apiResponse);
      const result = getScheduleList(response);

      setSchedules(result);

      setSelectedId((current) => {
        if (
          requestedScheduleId &&
          result.some(
            (item) =>
              String(item.id) === String(requestedScheduleId),
          )
        ) {
          return String(requestedScheduleId);
        }

        if (
          current &&
          result.some(
            (item) => String(item.id) === String(current),
          )
        ) {
          return current;
        }

        return result.length ? String(result[0].id) : '';
      });

      if (result.length === 0) {
        setScheduleData(null);
      }
    } catch (err) {
      console.error('Loading schedules failed:', err);
      setSchedules([]);
      setSelectedId('');
      setScheduleData(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, requestedScheduleId]);

  const loadScheduleDetails = useCallback(async () => {
    if (!selectedId) {
      setScheduleData(null);
      setDetailLoading(false);
      return null;
    }

    setDetailLoading(true);
    setError('');

    try {
      const apiResponse = await api.get(
        `/scheduling/schedules/${encodeURIComponent(selectedId)}`,
      );

      const response = unwrap(apiResponse);

      const schedule = getScheduleObject(response);
      const details = getScheduleDetails(response);
      const conflicts = getScheduleConflicts(response);

      const nextData = {
        schedule,
        details,
        conflicts,
      };

      setScheduleData(nextData);

      return nextData;
    } catch (err) {
      console.error('Loading schedule details failed:', err);
      setScheduleData(null);
      setError(getErrorMessage(err));
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    loadScheduleDetails();
  }, [loadScheduleDetails]);

  const selectedSchedule =
    scheduleData?.schedule ||
    schedules.find(
      (item) => String(item.id) === String(selectedId),
    ) ||
    null;

  const details = scheduleData?.details || [];
  const conflicts = scheduleData?.conflicts || [];

  const events = useMemo(
    () =>
      details
        .filter((detail) => detail.status !== 'cancelled')
        .map((detail) => {
          const examDate = getScheduleDate(detail);
          const startTime = getStartTime(detail);
          const endTime = getEndTime(detail);

          const start = parseExamDate(examDate, startTime);
          const end = parseExamDate(examDate, endTime);

          if (!start || !end || end <= start) {
            return null;
          }

          return {
            id: detail.id,
            title: eventTitle(detail),
            start,
            end,
            resource: detail,
          };
        })
        .filter(Boolean),
    [details],
  );

  // Navigate to the earliest exam whenever the selected timetable changes.
  useEffect(() => {
    if (!events.length) return;

    const earliestExam = events.reduce(
      (earliest, event) =>
        event.start < earliest ? event.start : earliest,
      events[0].start,
    );

    setCalendarDate((currentDate) => {
      if (
        currentDate &&
        currentDate.getTime() === earliestExam.getTime()
      ) {
        return currentDate;
      }

      return earliestExam;
    });
  }, [selectedId, events]);

  async function refresh() {
    setNotice('');
    setError('');

    await loadSchedules();

    // loadScheduleDetails uses the currently selected schedule ID.
    await loadScheduleDetails();
  }

  async function runScheduleAction(action, label) {
    if (!selectedId) return;

    setActionLoading(action);
    setError('');
    setNotice('');

    try {
      const apiResponse = await api.post(
        `/scheduling/schedules/${encodeURIComponent(selectedId)}/${action}`,
      );

      const response = unwrap(apiResponse);

      setNotice(response?.message || label);

      // Reload the backend's schedule list and selected timetable.
      await loadSchedules();
      await loadScheduleDetails();
    } catch (err) {
      console.error(`Schedule action ${action} failed:`, err);
      setError(getErrorMessage(err));

      // Validation can save conflict records even when it fails.
      // Reload details so the user can see the latest conflict state.
      try {
        await loadScheduleDetails();
      } catch (refreshError) {
        console.error(
          'Refreshing schedule details failed:',
          refreshError,
        );
      }
    } finally {
      setActionLoading('');
    }
  }

  function handleSelectEvent(event) {
    const detail = event.resource;

    const room =
      detail.room?.name ||
      detail.roomName ||
      'Room not assigned';

    const section =
      detail.section?.sectionName ||
      detail.section?.section ||
      'Section not specified';

    setNotice(
      `${event.title} | ${format(event.start, 'PPP')} | ${formatTime(
        getStartTime(detail),
      )}–${formatTime(
        getEndTime(detail),
      )} | ${room} | ${section}`,
    );
  }

  function eventStyle(event) {
    const status = event.resource?.status;

    const backgroundColor =
      status === 'cancelled'
        ? '#64748b'
        : status === 'completed'
          ? '#15803d'
          : '#4f46e5';

    return {
      style: {
        backgroundColor,
        border: 'none',
        borderRadius: '6px',
        color: '#fff',
        padding: '3px 5px',
      },
    };
  }

  const busy = loading || detailLoading;
  const editable = canEditSchedule(selectedSchedule);
  const hasConflicts = conflicts.length > 0;

  return (
    <main className="schedule-page">
      <header className="schedule-header">
        <div>
          <div className="schedule-eyebrow">
            <CalendarDays size={16} />
            EXAM MANAGEMENT
          </div>

          <h1>Schedule Calendar</h1>

          <p>
            Review examination dates, rooms, time slots, and schedule
            validation results.
          </p>
        </div>

        <button
          className="schedule-button schedule-button-secondary"
          onClick={refresh}
          disabled={busy || Boolean(actionLoading)}
          type="button"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          className="schedule-alert schedule-alert-error"
          role="alert"
        >
          <ShieldAlert size={19} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          className="schedule-alert schedule-alert-info"
          role="status"
        >
          <CheckCircle2 size={19} />
          <span>{notice}</span>
        </div>
      )}

      <section className="schedule-toolbar">
        <label className="schedule-control">
          <span>Schedule</span>

          <select
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setNotice('');
              setScheduleData(null);
            }}
            disabled={loading}
          >
            {!schedules.length && (
              <option value="">No schedules available</option>
            )}

            {schedules.map((schedule) => (
              <option
                key={schedule.id}
                value={String(schedule.id)}
              >
                {schedule.name || `Schedule #${schedule.id}`}
                {' · '}
                {schedule.status}
                {' · '}
                {schedule.period?.name || 'Exam period'}
              </option>
            ))}
          </select>
        </label>

        <label className="schedule-control">
          <span>Status filter</span>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === 'all'
                  ? 'All statuses'
                  : status.charAt(0).toUpperCase() +
                    status.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <div className="schedule-summary">
          <span className="schedule-summary-label">
            Exams scheduled
          </span>
          <strong>{details.length}</strong>
        </div>

        <div className="schedule-summary">
          <span className="schedule-summary-label">
            Open conflicts
          </span>
          <strong className={hasConflicts ? 'schedule-danger' : ''}>
            {conflicts.length}
          </strong>
        </div>
      </section>

      {selectedSchedule && (
        <section className="schedule-status-row">
          <div>
            <span className="schedule-status-caption">
              Current timetable
            </span>

            <h2>
              {selectedSchedule.name ||
                `Schedule #${selectedSchedule.id}`}
            </h2>

            <p>
              Version {selectedSchedule.version ?? '—'}
              {' · '}
              {selectedSchedule.period?.name ||
                'Exam period not specified'}
            </p>

            {selectedSchedule.published_at && (
              <p>
                Published: {String(selectedSchedule.published_at)}
              </p>
            )}
          </div>

          <span
            className={`schedule-status-badge status-${selectedSchedule.status}`}
          >
            {selectedSchedule.status}
          </span>

          {editable && (
            <div className="schedule-actions">
              <button
                className="schedule-button schedule-button-secondary"
                type="button"
                disabled={Boolean(actionLoading)}
                onClick={() =>
                  runScheduleAction(
                    'validate',
                    'Schedule validated.',
                  )
                }
              >
                <CheckCircle2 size={16} />
                {actionLoading === 'validate'
                  ? 'Validating…'
                  : 'Validate'}
              </button>

              <button
                className="schedule-button schedule-button-primary"
                type="button"
                disabled={
                  Boolean(actionLoading) ||
                  hasConflicts ||
                  details.length === 0
                }
                title={
                  details.length === 0
                    ? 'Add exams before publishing.'
                    : hasConflicts
                      ? 'Resolve reported conflicts before publishing.'
                      : 'Publish this schedule'
                }
                onClick={() => {
                  if (
                    window.confirm(
                      'Publish this examination schedule? The server will revalidate it before publishing.',
                    )
                  ) {
                    runScheduleAction(
                      'publish',
                      'Schedule published.',
                    );
                  }
                }}
              >
                {actionLoading === 'publish'
                  ? 'Publishing…'
                  : 'Publish schedule'}
              </button>
            </div>
          )}
        </section>
      )}

      {busy && (
        <div className="schedule-loading" role="status">
          <RefreshCw size={20} className="schedule-spin" />
          Loading schedule data…
        </div>
      )}

      {!busy && !error && !schedules.length && (
        <div className="schedule-empty">
          <CalendarDays size={42} />
          <h2>No schedules found</h2>
          <p>
            There are no schedules for this filter yet. Create a
            timetable using the scheduling workflow, then return
            here to review it.
          </p>
        </div>
      )}

      {!busy && selectedSchedule && (
        <>
          {hasConflicts && (
            <div className="schedule-alert schedule-alert-error">
              <ShieldAlert size={19} />

              <div>
                <strong>Schedule conflicts detected</strong>
                <p>
                  Review the {conflicts.length} reported conflict(s)
                  and resolve them before publishing.
                </p>

                <ul>
                  {conflicts.slice(0, 5).map((conflict, index) => (
                    <li key={conflict.id ?? `${conflict.type}-${index}`}>
                      {conflict.title
                        ? `${conflict.title}: `
                        : ''}
                      {conflict.description ||
                        conflict.message ||
                        conflict.type ||
                        'Schedule conflict'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <section className="schedule-calendar-card">
            <div className="schedule-calendar-heading">
              <div>
                <h2>Examination timetable</h2>
                <p>
                  Select an exam to inspect its room, section, and time.
                </p>
              </div>

              <div
                className="schedule-view-switch"
                aria-label="Calendar view"
              >
                {['month', 'week', 'day', 'agenda'].map((view) => (
                  <button
                    key={view}
                    type="button"
                    className={
                      calendarView === view ? 'active' : ''
                    }
                    onClick={() => setCalendarView(view)}
                  >
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {events.length ? (
              <div className="schedule-calendar">
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  titleAccessor="title"
                  date={calendarDate}
                  onNavigate={setCalendarDate}
                  view={calendarView}
                  onView={setCalendarView}
                  onSelectEvent={handleSelectEvent}
                  eventPropGetter={eventStyle}
                  popup
                  style={{ height: 650 }}
                  messages={{
                    noEventsInRange:
                      'No exams scheduled in this period.',
                  }}
                />
              </div>
            ) : (
              <div className="schedule-empty schedule-empty-compact">
                <Clock3 size={34} />
                <h3>No exam entries in this timetable</h3>
                <p>
                  This schedule has no active exam details to display.
                </p>
              </div>
            )}
          </section>

          <section className="schedule-details-card">
            <div className="schedule-calendar-heading">
              <div>
                <h2>Scheduled exams</h2>
                <p>
                  Exam assignments retrieved from the backend.
                </p>
              </div>

              <span className="schedule-count">
                {details.length} entries
              </span>
            </div>

            {details.length ? (
              <div className="schedule-table-wrap">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>Exam / Course</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Room</th>
                      <th>Section</th>
                      <th>Students</th>
                    </tr>
                  </thead>

                  <tbody>
                    {details.map((detail, index) => {
                      const examDate = getScheduleDate(detail);

                      return (
                        <tr key={detail.id ?? index}>
                          <td>
                            <strong>{eventTitle(detail)}</strong>
                            <span className="schedule-cell-subtitle">
                              {detail.exam?.examType ||
                                detail.examType ||
                                'Examination'}
                            </span>
                          </td>

                          <td>
                            {examDate
                              ? String(examDate).slice(0, 10)
                              : '—'}
                          </td>

                          <td>
                            {formatTime(getStartTime(detail))}
                            {' – '}
                            {formatTime(getEndTime(detail))}
                          </td>

                          <td>
                            {detail.room?.name ||
                              detail.roomName ||
                              'Unassigned'}

                            {(detail.room?.buildingName ||
                              detail.room?.buildingCode) && (
                              <span className="schedule-cell-subtitle">
                                {detail.room.buildingName ||
                                  detail.room.buildingCode}
                              </span>
                            )}
                          </td>

                          <td>
                            {detail.section?.sectionName ||
                              detail.section?.section ||
                              detail.section?.name ||
                              '—'}
                          </td>

                          <td>
                            <span className="schedule-student-count">
                              <Users size={14} />
                              {detail.totalStudents ??
                                detail.exam?.enrollmentCount ??
                                detail.candidateCount ??
                                0}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="schedule-table-empty">
                No scheduled exams are available.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
