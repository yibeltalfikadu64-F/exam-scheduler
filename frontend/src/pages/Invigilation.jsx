import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';

import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/invigilation.css';

/**
 * API response helpers.
 *
 * Supports:
 * 1. Axios interceptor returning { success, data, message }
 * 2. Direct arrays
 * 3. Paginated objects such as { items, pagination }
 */
const unwrap = (response) => response?.data ?? response;

const payload = (response) => {
  const result = unwrap(response);

  if (
    result &&
    !Array.isArray(result) &&
    typeof result === 'object' &&
    Object.prototype.hasOwnProperty.call(result, 'data')
  ) {
    return result.data;
  }

  return result;
};

const getItems = (value, keys = []) => {
  if (Array.isArray(value)) return value;

  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }

  return [];
};

const errorText = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  'The request failed. Please try again.';

const dateText = (value) => {
  if (!value) return '—';

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
};

const timeText = (value) => String(value || '').slice(0, 5) || '—';

const initialFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  status: '',
  publishStatus: '',
};

const initialAssignment = {
  detailId: '',
  invigilatorId: '',
  role: 'invigilator',
  notes: '',
};

const initialAutoForm = {
  examPeriodId: '',
  scheduleId: '',
  detailId: '',
  dateFrom: '',
  dateTo: '',
};

export default function Invigilation() {
  const { user } = useAuth();

  const role = String(user?.role || '').toLowerCase();

  const canManage = [
    'admin',
    'registrar',
    'department_head',
  ].includes(role);

  const canPublish = ['admin', 'registrar'].includes(role);

  const [duties, setDuties] = useState([]);
  const [unfilled, setUnfilled] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [details, setDetails] = useState([]);
  const [eligible, setEligible] = useState([]);

  const [filters, setFilters] = useState(initialFilters);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState('duties');

  const [assignment, setAssignment] = useState(initialAssignment);
  const [autoForm, setAutoForm] = useState(initialAutoForm);

  const [preview, setPreview] = useState(null);
  const [dutyAction, setDutyAction] = useState(null);
  const [replacementId, setReplacementId] = useState('');

  const [eligibleLoading, setEligibleLoading] = useState(false);

  /**
   * Load the duty roster and supporting reports.
   * Duties are required; supporting reports can fail independently.
   */
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    const params = {};

    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.status) params.status = filters.status;
    if (filters.publishStatus) {
      params.publishStatus = filters.publishStatus;
    }

    try {
      const results = await Promise.allSettled([
        api.get('/invigilation/duties', {
          params: { ...params, limit: 100 },
        }),

        api.get('/invigilation/unfilled', { params }),

        api.get('/invigilation/conflicts', { params }),

        api.get('/invigilation/workload', { params }),

        ...(canManage
          ? [
            api.get('/invigilation/details', {
              params: {
                dateFrom: filters.dateFrom || undefined,
                dateTo: filters.dateTo || undefined,
              },
            }),
          ]
          : []),
      ]);

      const [
        dutyResult,
        unfilledResult,
        conflictResult,
        workloadResult,
        detailResult,
      ] = results;

      if (dutyResult.status !== 'fulfilled') {
        throw dutyResult.reason;
      }

      const dutyData = payload(dutyResult.value);

      setDuties(
        getItems(dutyData, ['items', 'duties']),
      );

      setUnfilled(
        unfilledResult.status === 'fulfilled'
          ? getItems(payload(unfilledResult.value), [
            'items',
            'unfilled',
          ])
          : [],
      );

      setConflicts(
        conflictResult.status === 'fulfilled'
          ? getItems(payload(conflictResult.value), [
            'conflicts',
            'items',
          ])
          : [],
      );

      setWorkload(
        workloadResult.status === 'fulfilled'
          ? getItems(payload(workloadResult.value), [
            'items',
            'workload',
            'staff',
          ])
          : [],
      );

      if (canManage && detailResult) {
        setDetails(
          detailResult.status === 'fulfilled'
            ? getItems(payload(detailResult.value), [
              'items',
              'details',
            ])
            : [],
        );
      } else {
        setDetails([]);
      }

      const optionalErrors = results
        .slice(1)
        .filter((result) => result.status === 'rejected');

      if (optionalErrors.length > 0) {
        setNotice({
          type: 'warning',
          text:
            'The duty roster loaded, but one or more supporting reports could not be loaded.',
        });
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [
    canManage,
    filters.dateFrom,
    filters.dateTo,
    filters.status,
    filters.publishStatus,
  ]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /**
   * Local text search.
   * Date, duty status, and publication filters are sent to the backend.
   */
  const filteredDuties = useMemo(() => {
    const term = filters.search.trim().toLowerCase();

    return duties.filter((duty) => {
      const searchableText = [
        duty.exam?.title,
        duty.exam?.courseTitle,
        duty.exam?.courseCode,
        duty.room?.name,
        duty.room?.buildingCode,
        duty.invigilator?.fullName,
        duty.invigilator?.staffIdentifier,
        duty.invigilator?.email,
        duty.role,
        duty.status,
        duty.publishStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !term || searchableText.includes(term);
    });
  }, [duties, filters.search]);

  /**
   * Load staff eligibility for one exam detail.
   */
  const loadEligible = useCallback(async (detailId) => {
    setEligible([]);
    setEligibleLoading(false);

    setAssignment((current) => ({
      ...current,
      invigilatorId: '',
    }));

    if (!detailId) return;

    setEligibleLoading(true);

    try {
      const response = await api.get(
        `/invigilation/details/${detailId}/eligible-invigilators`,
      );

      setEligible(
        getItems(payload(response), [
          'items',
          'invigilators',
        ]),
      );
    } catch (err) {
      setNotice({
        type: 'error',
        text: errorText(err),
      });
    } finally {
      setEligibleLoading(false);
    }
  }, []);

  /**
   * Create a manual invigilation assignment.
   */
  const assignDuty = async (event) => {
    event.preventDefault();

    if (!assignment.detailId || !assignment.invigilatorId) {
      setNotice({
        type: 'error',
        text: 'Select an exam and an eligible invigilator.',
      });
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      await api.post('/invigilation/assign', {
        examScheduleDetailId: Number(assignment.detailId),
        invigilatorId: Number(assignment.invigilatorId),
        role: assignment.role,
        notes: assignment.notes.trim() || undefined,
      });

      setNotice({
        type: 'success',
        text: 'Invigilator assigned successfully.',
      });

      setAssignment({ ...initialAssignment });
      setEligible([]);

      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'error',
        text: errorText(err),
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Preview or commit the automatic assignment plan.
   */
  const runAutoAssign = async (dryRun = true) => {
    if (
      !autoForm.examPeriodId ||
      !autoForm.scheduleId ||
      !autoForm.dateFrom ||
      !autoForm.dateTo
    ) {
      setNotice({
        type: 'error',
        text:
          'Enter the exam period ID, schedule ID, start date, and end date.',
      });
      return;
    }

    if (autoForm.dateFrom > autoForm.dateTo) {
      setNotice({
        type: 'error',
        text: 'The start date must not be after the end date.',
      });
      return;
    }

    if (
      !dryRun &&
      !window.confirm(
        'Save the proposed invigilator assignments to the database?',
      )
    ) {
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const response = await api.post(
        '/invigilation/auto-assign',
        {
          examPeriodId: Number(autoForm.examPeriodId),
          scheduleId: Number(autoForm.scheduleId),
          detailId: autoForm.detailId
            ? Number(autoForm.detailId)
            : undefined,
          dateFrom: autoForm.dateFrom,
          dateTo: autoForm.dateTo,
          dryRun,
        },
      );

      const data = payload(response);

      setPreview(data);

      const savedCount =
        data?.assignedCount ?? data?.assigned?.length ?? 0;

      setNotice({
        type: 'success',
        text: dryRun
          ? 'Preview generated. No assignments have been saved.'
          : `Automatic assignment finished. ${savedCount} duty/duties saved.`,
      });

      if (!dryRun) {
        await loadDashboard();
      }
    } catch (err) {
      setNotice({
        type: 'error',
        text: errorText(err),
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Cancel or reassign a duty.
   *
   * Reassignment sends the current duty role so the role is preserved.
   * The modal itself is the confirmation step; no duplicate browser
   * confirmation is needed for cancellation.
   */
  const performDutyAction = async () => {
    if (!dutyAction) return;

    if (
      dutyAction.action === 'reassign' &&
      !replacementId
    ) {
      setNotice({
        type: 'error',
        text: 'Choose a replacement invigilator first.',
      });
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      if (dutyAction.action === 'cancel') {
        await api.post(
          `/invigilation/duties/${dutyAction.id}/cancel`,
          {},
        );

        setNotice({
          type: 'success',
          text: 'Duty cancelled successfully.',
        });
      } else if (dutyAction.action === 'reassign') {
        const currentDuty = duties.find(
          (duty) =>
            Number(duty.id) === Number(dutyAction.id),
        );

        await api.patch(
          `/invigilation/duties/${dutyAction.id}/reassign`,
          {
            invigilatorId: Number(replacementId),
            role: currentDuty?.role || 'invigilator',
          },
        );

        setNotice({
          type: 'success',
          text: 'Duty reassigned successfully.',
        });
      }

      setDutyAction(null);
      setReplacementId('');
      setEligible([]);

      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'error',
        text: errorText(err),
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Publish duties using the selected date range.
   *
   * Unpublish uses dutyIds because the backend's unpublish validator
   * accepts duty IDs or schedule/period scope, not dateFrom/dateTo.
   */
  const publishRoster = async (publish) => {
    if (!filters.dateFrom && !filters.dateTo) {
      setNotice({
        type: 'error',
        text:
          'Choose a start date or end date before publishing or unpublishing duties.',
      });
      return;
    }

    let body;

    if (publish) {
      body = {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      };
    } else {
      const publishedDutyIds = duties
        .filter(
          (duty) =>
            duty.publishStatus === 'published' &&
            duty.id != null,
        )
        .map((duty) => Number(duty.id))
        .filter(Number.isInteger);

      if (publishedDutyIds.length === 0) {
        setNotice({
          type: 'error',
          text:
            'No published duties are present in the currently loaded roster. Select a suitable date range and refresh.',
        });
        return;
      }

      body = {
        dutyIds: publishedDutyIds,
      };
    }

    const confirmed = window.confirm(
      publish
        ? 'Publish duties within the selected date range?'
        : 'Unpublish the published duties currently loaded for this date range?',
    );

    if (!confirmed) return;

    setBusy(true);
    setNotice(null);

    try {
      await api.post(
        `/invigilation/roster/${publish ? 'publish' : 'unpublish'}`,
        body,
      );

      setNotice({
        type: 'success',
        text: publish
          ? 'Roster published successfully.'
          : 'Roster unpublished successfully.',
      });

      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'error',
        text: errorText(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const resetFilters = () => {
    setFilters({ ...initialFilters });
  };

  const openReassign = async (duty) => {
    setDutyAction({
      action: 'reassign',
      id: duty.id,
      detailId: duty.detailId,
    });

    setReplacementId('');

    await loadEligible(duty.detailId);
  };

  return (
    <main className="invig-page">
      <header className="invig-header">
        <div>
          <span className="invig-eyebrow">
            EXAM OPERATIONS
          </span>

          <h1>Invigilation management</h1>

          <p>
            Assign examination supervisors, monitor coverage,
            and manage duty rosters.
          </p>
        </div>

        <button
          type="button"
          className="invig-btn invig-btn-secondary"
          onClick={loadDashboard}
          disabled={loading || busy}
        >
          {loading ? (
            <LoaderCircle
              className="invig-spin"
              size={17}
            />
          ) : (
            <RefreshCw size={17} />
          )}
          Refresh
        </button>
      </header>

      {notice && (
        <div
          className={`invig-notice invig-notice-${notice.type}`}
          role="status"
        >
          {notice.type === 'error' ||
            notice.type === 'warning' ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}

          <span>{notice.text}</span>

          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div
          className="invig-notice invig-notice-error"
          role="alert"
        >
          <AlertTriangle size={18} />
          <span>{error}</span>

          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError('')}
          >
            ×
          </button>
        </div>
      )}

      {/* Summary cards */}
      <section
        className="invig-stats"
        aria-label="Invigilation overview"
      >
        <article className="invig-stat">
          <span className="invig-stat-icon blue">
            <ClipboardCheck size={21} />
          </span>
          <span className="invig-stat-label">
            Duties loaded
          </span>
          <strong>{loading ? '—' : duties.length}</strong>
          <small>Matching the selected filters</small>
        </article>

        <article className="invig-stat">
          <span className="invig-stat-icon amber">
            <Users size={21} />
          </span>
          <span className="invig-stat-label">
            Unfilled exam slots
          </span>
          <strong>{loading ? '—' : unfilled.length}</strong>
          <small>Exams requiring more invigilators</small>
        </article>

        <article className="invig-stat">
          <span className="invig-stat-icon red">
            <AlertTriangle size={21} />
          </span>
          <span className="invig-stat-label">
            Reported conflicts
          </span>
          <strong>{loading ? '—' : conflicts.length}</strong>
          <small>Review before publishing</small>
        </article>

        <article className="invig-stat">
          <span className="invig-stat-icon green">
            <Activity size={21} />
          </span>
          <span className="invig-stat-label">
            Staff workload records
          </span>
          <strong>{loading ? '—' : workload.length}</strong>
          <small>Returned by the workload report</small>
        </article>
      </section>

      {/* Duty roster */}
      <section className="invig-panel">
        <div className="invig-panel-heading">
          <div>
            <h2>Duty roster</h2>
            <p>
              Filter current assignments and review who is
              supervising each exam.
            </p>
          </div>

          {canPublish && (
            <div className="invig-action-group">
              <button
                type="button"
                className="invig-btn invig-btn-primary"
                disabled={busy || loading}
                onClick={() => publishRoster(true)}
              >
                <ShieldCheck size={16} />
                Publish
              </button>

              <button
                type="button"
                className="invig-btn invig-btn-secondary"
                disabled={busy || loading}
                onClick={() => publishRoster(false)}
              >
                Unpublish
              </button>
            </div>
          )}
        </div>

        <div className="invig-filters">
          <label className="invig-search">
            <Search size={17} />

            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Search exam, room, or invigilator"
              aria-label="Search duties"
            />
          </label>

          <label>
            <span>From</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>To</span>
            <input
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom || undefined}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="">All statuses</option>
              <option value="assigned">Assigned</option>
              <option value="confirmed">Confirmed</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <label>
            <span>Publication</span>
            <select
              value={filters.publishStatus}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  publishStatus: event.target.value,
                }))
              }
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <button
            type="button"
            className="invig-btn invig-btn-secondary"
            onClick={resetFilters}
          >
            Clear
          </button>
        </div>

        <div className="invig-table-wrap">
          <table className="invig-table">
            <thead>
              <tr>
                <th>Exam / course</th>
                <th>Date &amp; time</th>
                <th>Room</th>
                <th>Invigilator</th>
                <th>Duty status</th>
                <th>Publication</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={canManage ? 7 : 6}
                    className="invig-table-message"
                  >
                    <LoaderCircle
                      className="invig-spin"
                      size={20}
                    />
                    Loading duties…
                  </td>
                </tr>
              ) : filteredDuties.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 7 : 6}
                    className="invig-table-message"
                  >
                    No duties match these filters.
                  </td>
                </tr>
              ) : (
                filteredDuties.map((duty) => (
                  <tr key={duty.id}>
                    <td>
                      <strong>
                        {duty.exam?.title ||
                          duty.exam?.courseTitle ||
                          `Exam #${duty.detailId}`}
                      </strong>

                      <small>
                        {duty.exam?.courseCode || 'Course'}
                        {' · '}
                        {duty.role || 'Invigilator'}
                      </small>
                    </td>

                    <td>
                      <span className="invig-date">
                        <CalendarDays size={14} />
                        {dateText(duty.examDate)}
                      </span>

                      <small>
                        <Clock3 size={13} />
                        {' '}
                        {timeText(duty.startTime)}
                        –
                        {timeText(duty.endTime)}
                      </small>
                    </td>

                    <td>
                      {duty.room?.name || 'Unassigned room'}
                    </td>

                    <td>
                      <strong>
                        {duty.invigilator?.fullName ||
                          'Unassigned'}
                      </strong>

                      <small>
                        {duty.invigilator?.staffIdentifier ||
                          duty.invigilator?.email ||
                          ''}
                      </small>
                    </td>

                    <td>
                      <span
                        className={`invig-badge status-${duty.status || 'unknown'
                          }`}
                      >
                        {duty.status || 'Unknown'}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`invig-badge publication-${duty.publishStatus || 'draft'
                          }`}
                      >
                        {duty.publishStatus || 'draft'}
                      </span>
                    </td>

                    {canManage && (
                      <td>
                        <div className="invig-row-actions">
                          <button
                            type="button"
                            className="invig-link-btn"
                            onClick={() => openReassign(duty)}
                            disabled={
                              busy ||
                              duty.status === 'cancelled'
                            }
                          >
                            Reassign
                          </button>

                          {duty.status !== 'cancelled' && (
                            <button
                              type="button"
                              className="invig-link-btn danger"
                              onClick={() =>
                                setDutyAction({
                                  action: 'cancel',
                                  id: duty.id,
                                  detailId: duty.detailId,
                                })
                              }
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="invig-table-footer">
          <span>
            {filteredDuties.length} displayed duty record(s)
          </span>

          <span>
            <span className="invig-dot" />
            {' '}
            Data supplied by the backend API
          </span>
        </div>
      </section>

      {/* Assignment tools */}
      {canManage && (
        <section className="invig-workspace">
          {/* Manual assignment */}
          <article className="invig-panel">
            <div className="invig-panel-heading">
              <div>
                <h2>
                  <UserPlus size={20} />
                  {' '}
                  Manual assignment
                </h2>
                <p>
                  Select an exam and an eligible staff member.
                </p>
              </div>
            </div>

            <form
              className="invig-form"
              onSubmit={assignDuty}
            >
              <label className="invig-field">
                <span>Exam / schedule detail</span>

                <select
                  required
                  value={assignment.detailId}
                  onChange={(event) => {
                    const detailId = event.target.value;

                    setAssignment((current) => ({
                      ...current,
                      detailId,
                      invigilatorId: '',
                    }));

                    loadEligible(detailId);
                  }}
                >
                  <option value="">Select an exam</option>

                  {details.map((detail) => (
                    <option
                      key={detail.detailId}
                      value={detail.detailId}
                    >
                      {detail.examTitle ||
                        `Exam ${detail.detailId}`}
                      {' — '}
                      {dateText(detail.examDate)}
                      {' ('}
                      {timeText(detail.startTime)}
                      –
                      {timeText(detail.endTime)}
                      {') · '}
                      {detail.missing ??
                        Math.max(
                          0,
                          (detail.requiredCount || 0) -
                          (detail.assignedCount || 0),
                        )}
                      {' needed'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="invig-field">
                <span>Eligible invigilator</span>

                <select
                  required
                  value={assignment.invigilatorId}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      invigilatorId: event.target.value,
                    }))
                  }
                  disabled={
                    !assignment.detailId ||
                    eligibleLoading
                  }
                >
                  <option value="">
                    {eligibleLoading
                      ? 'Loading eligible staff…'
                      : 'Select an eligible staff member'}
                  </option>

                  {eligible.map((person) => (
                    <option
                      key={person.invigilatorId}
                      value={person.invigilatorId}
                      disabled={!person.eligible}
                    >
                      {person.staffIdentifier ||
                        `Staff ${person.invigilatorId}`}
                      {person.eligible
                        ? ' — Eligible'
                        : ` — Not eligible: ${(person.reasons || [])
                          .map(
                            (reason) =>
                              reason.message ||
                              reason.code ||
                              reason,
                          )
                          .join(', ')
                        }`}
                    </option>
                  ))}
                </select>

                {assignment.detailId &&
                  !eligibleLoading &&
                  eligible.length === 0 && (
                    <small>
                      No eligible staff were returned for this exam.
                    </small>
                  )}
              </label>

              <label className="invig-field">
                <span>Duty role</span>

                <select
                  value={assignment.role}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                >
                  <option value="invigilator">
                    Invigilator
                  </option>
                  <option value="lead">
                    Lead invigilator
                  </option>
                </select>
              </label>

              <label className="invig-field">
                <span>Notes (optional)</span>

                <input
                  maxLength={500}
                  value={assignment.notes}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Additional instructions"
                />
              </label>

              <button
                type="submit"
                className="invig-btn invig-btn-primary"
                disabled={
                  busy ||
                  eligibleLoading ||
                  !assignment.detailId ||
                  !assignment.invigilatorId
                }
              >
                {busy ? (
                  <LoaderCircle
                    className="invig-spin"
                    size={17}
                  />
                ) : (
                  <UserPlus size={17} />
                )}
                Assign invigilator
              </button>
            </form>
          </article>

          {/* Automatic assignment */}
          <article className="invig-panel">
            <div className="invig-panel-heading">
              <div>
                <h2>
                  <Activity size={20} />
                  {' '}
                  Automatic assignment
                </h2>
                <p>
                  Preview proposed assignments before saving.
                </p>
              </div>
            </div>

            <form
              className="invig-form"
              onSubmit={(event) => {
                event.preventDefault();
                runAutoAssign(true);
              }}
            >
              <label className="invig-field">
                <span>Exam period ID</span>

                <input
                  type="number"
                  min="1"
                  required
                  value={autoForm.examPeriodId}
                  onChange={(event) =>
                    setAutoForm((current) => ({
                      ...current,
                      examPeriodId: event.target.value,
                    }))
                  }
                  placeholder="e.g. 1"
                />
              </label>

              <label className="invig-field">
                <span>Schedule ID</span>

                <input
                  type="number"
                  min="1"
                  required
                  value={autoForm.scheduleId}
                  onChange={(event) =>
                    setAutoForm((current) => ({
                      ...current,
                      scheduleId: event.target.value,
                    }))
                  }
                  placeholder="e.g. 1"
                />
              </label>

              <label className="invig-field">
                <span>Specific detail ID (optional)</span>

                <input
                  type="number"
                  min="1"
                  value={autoForm.detailId}
                  onChange={(event) =>
                    setAutoForm((current) => ({
                      ...current,
                      detailId: event.target.value,
                    }))
                  }
                  placeholder="Leave blank for date range"
                />
              </label>

              <div className="invig-date-fields">
                <label className="invig-field">
                  <span>Start date</span>

                  <input
                    type="date"
                    required
                    value={autoForm.dateFrom}
                    onChange={(event) =>
                      setAutoForm((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="invig-field">
                  <span>End date</span>

                  <input
                    type="date"
                    required
                    min={autoForm.dateFrom || undefined}
                    value={autoForm.dateTo}
                    onChange={(event) =>
                      setAutoForm((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <button
                type="submit"
                className="invig-btn invig-btn-primary"
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle
                    className="invig-spin"
                    size={17}
                  />
                ) : (
                  <Activity size={17} />
                )}
                Preview assignments
              </button>
            </form>

            {preview && (
              <div className="invig-preview">
                <h3>
                  {preview.dryRun
                    ? 'Preview — not saved'
                    : 'Assignment result'}
                </h3>

                <p>
                  <strong>
                    {preview.assignedCount ??
                      preview.assigned?.length ??
                      0}
                  </strong>
                  {' '}
                  proposed/created assignment(s),{' '}
                  <strong>
                    {preview.unfilledCount ??
                      preview.unfilled?.length ??
                      0}
                  </strong>
                  {' '}
                  unresolved item(s).
                </p>

                {preview.dryRun &&
                  preview.assigned?.length > 0 && (
                    <button
                      type="button"
                      className="invig-btn invig-btn-primary"
                      disabled={busy}
                      onClick={() => runAutoAssign(false)}
                    >
                      Confirm and save assignments
                    </button>
                  )}

                {preview.unfilled?.length > 0 && (
                  <details>
                    <summary>Review unfilled exams</summary>

                    <ul>
                      {preview.unfilled.map((item, index) => (
                        <li
                          key={`${item.detailId ?? 'item'}-${index}`}
                        >
                          {item.examTitle ||
                            `Exam ${item.detailId ?? ''}`}
                          {' — '}
                          {item.reasonMessage ||
                            item.reason ||
                            item.reasons?.[0]?.message ||
                            'No eligible invigilator'}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </article>
        </section>
      )}

      {/* Reports */}
      <section className="invig-panel invig-reports">
        <div className="invig-panel-heading">
          <div>
            <h2>Coverage and checks</h2>
            <p>
              Review reports returned by the scheduling service.
            </p>
          </div>

          <div className="invig-tabs">
            {[
              ['unfilled', 'Unfilled', unfilled.length],
              ['conflicts', 'Conflicts', conflicts.length],
              ['workload', 'Workload', workload.length],
            ].map(([key, label, count]) => (
              <button
                type="button"
                key={key}
                className={tab === key ? 'active' : ''}
                onClick={() => setTab(key)}
              >
                {label}
                {' '}
                <span>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === 'unfilled' &&
          (unfilled.length > 0 ? (
            <div className="invig-report-list">
              {unfilled.map((item, index) => (
                <div
                  className="invig-report-row"
                  key={`${item.detailId ?? 'item'}-${index}`}
                >
                  <AlertTriangle size={18} />

                  <div>
                    <strong>
                      {item.examTitle ||
                        `Exam detail ${item.detailId ?? ''}`}
                    </strong>

                    <small>
                      {dateText(item.examDate)}
                      {' · '}
                      {item.missing ?? 1}
                      {' duty/duties still needed'}
                    </small>

                    <small>
                      {item.reasonMessage ||
                        item.reason ||
                        item.reasons?.[0]?.message ||
                        'Review eligibility and availability.'}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="invig-empty">
              <CheckCircle2 size={18} />
              No unfilled items were returned.
            </p>
          ))}

        {tab === 'conflicts' &&
          (conflicts.length > 0 ? (
            <div className="invig-report-list">
              {conflicts.map((item, index) => (
                <div
                  className="invig-report-row"
                  key={item.id ?? index}
                >
                  <XCircle size={18} />

                  <div>
                    <strong>
                      {item.message ||
                        item.description ||
                        item.type ||
                        `Conflict ${index + 1}`}
                    </strong>

                    <small>
                      {item.examTitle ||
                        item.invigilatorName ||
                        item.roomName ||
                        'Review conflict details in the report.'}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="invig-empty">
              <CheckCircle2 size={18} />
              No conflicts were returned.
            </p>
          ))}

        {tab === 'workload' &&
          (workload.length > 0 ? (
            <div className="invig-table-wrap">
              <table className="invig-table">
                <thead>
                  <tr>
                    <th>Staff member</th>
                    <th>Assigned duties</th>
                    <th>Details</th>
                  </tr>
                </thead>

                <tbody>
                  {workload.map((item, index) => (
                    <tr
                      key={
                        item.invigilatorId ??
                        item.id ??
                        index
                      }
                    >
                      <td>
                        {item.fullName ||
                          item.name ||
                          item.staffIdentifier ||
                          `Staff ${index + 1}`}
                      </td>

                      <td>
                        {item.dutyCount ??
                          item.totalDuties ??
                          item.assignedCount ??
                          '—'}
                      </td>

                      <td>
                        {item.email ||
                          item.departmentName ||
                          item.staffIdentifier ||
                          '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="invig-empty">
              No workload records were returned.
            </p>
          ))}
      </section>

      {/* Duty action modal */}
      {dutyAction && (
        <div
          className="invig-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busy
            ) {
              setDutyAction(null);
              setReplacementId('');
              setEligible([]);
            }
          }}
        >
          <section
            className="invig-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invig-modal-title"
          >
            <h2 id="invig-modal-title">
              {dutyAction.action === 'cancel'
                ? 'Cancel duty'
                : 'Reassign duty'}
            </h2>

            {dutyAction.action === 'cancel' ? (
              <p>
                This duty will be cancelled. Continue?
              </p>
            ) : (
              <>
                <p>
                  Choose an eligible replacement for this exam.
                </p>

                <label className="invig-field">
                  <span>Replacement invigilator</span>

                  <select
                    value={replacementId}
                    onChange={(event) =>
                      setReplacementId(event.target.value)
                    }
                    disabled={eligibleLoading || busy}
                  >
                    <option value="">
                      {eligibleLoading
                        ? 'Loading eligible staff…'
                        : 'Select staff'}
                    </option>

                    {eligible
                      .filter((person) => person.eligible)
                      .map((person) => (
                        <option
                          key={person.invigilatorId}
                          value={person.invigilatorId}
                        >
                          {person.fullName ||
                            person.staffIdentifier ||
                            `Staff ${person.invigilatorId}`}
                        </option>
                      ))}
                  </select>

                  {!eligibleLoading &&
                    eligible.filter((person) => person.eligible)
                      .length === 0 && (
                      <small>
                        No eligible replacement was returned.
                      </small>
                    )}
                </label>
              </>
            )}

            <div className="invig-action-group">
              <button
                type="button"
                className="invig-btn invig-btn-secondary"
                onClick={() => {
                  setDutyAction(null);
                  setReplacementId('');
                  setEligible([]);
                }}
                disabled={busy}
              >
                Back
              </button>

              <button
                type="button"
                className="invig-btn invig-btn-primary"
                onClick={performDutyAction}
                disabled={
                  busy ||
                  (dutyAction.action === 'reassign' &&
                    (eligibleLoading || !replacementId))
                }
              >
                {busy ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
