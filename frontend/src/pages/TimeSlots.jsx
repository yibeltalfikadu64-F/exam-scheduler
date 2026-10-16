
import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import timeSlotService from '../services/timeSlotService';
import examPeriodService from '../services/examPeriodService';
import { useAuth } from '../context/AuthContext';
import '../styles/time-slots.css';

const emptySlotForm = {
  label: '',
  startTime: '08:30',
  endTime: '10:00',
  orderIndex: '0',
};

const emptyPeriodForm = {
  name: '',
  term: '',
  startDate: '',
  endDate: '',
  status: 'draft',
  description: '',
};

const PERIOD_STATUSES = [
  'draft',
  'open',
  'published',
  'closed',
  'archived',
];

const PERIOD_STATUS_LABELS = {
  draft: 'Draft',
  open: 'Open',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived',
};

function getItems(payload) {
  let current = payload;

  for (let i = 0; i < 6 && current; i += 1) {
    if (Array.isArray(current)) return current;
    if (Array.isArray(current.items)) return current.items;
    if (Array.isArray(current.examPeriods)) return current.examPeriods;

    if (current.data && typeof current.data === 'object') {
      current = current.data;
    } else {
      break;
    }
  }

  return [];
}

function formatDuration(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value < 0) return '—';

  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;

  return `${mins}m`;
}

function errorMessage(error) {
  if (Array.isArray(error?.details) && error.details.length) {
    return error.details
      .map((detail) => detail.message || detail.msg || String(detail))
      .filter(Boolean)
      .join(' ');
  }

  return error?.message || 'The request failed. Please try again.';
}

function toDateInput(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return '';
}

function toTimeInput(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function periodStatusLabel(status) {
  return PERIOD_STATUS_LABELS[status] || status || 'draft';
}

export default function TimeSlots() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('slots');

  // Time slots state.
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Exam periods state.
  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [periodSearchInput, setPeriodSearchInput] = useState('');
  const [periodSearch, setPeriodSearch] = useState('');
  const [periodStatusFilter, setPeriodStatusFilter] = useState('all');

  // Shared state.
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  // Time slot form state.
  const [formOpen, setFormOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [form, setForm] = useState(emptySlotForm);

  // Exam period form state.
  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [periodForm, setPeriodForm] = useState(emptyPeriodForm);

  const loadSlots = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        page: 1,
        limit: 100,
        sort: 'order_index',
        order: 'asc',
      };

      if (search.trim()) params.search = search.trim();

      if (statusFilter !== 'all') {
        params.isActive = statusFilter === 'active';
      }

      const result = await timeSlotService.list(params);
      setSlots(getItems(result));
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const loadPeriods = useCallback(async () => {
    setPeriodsLoading(true);

    try {
      const params = { page: 1, limit: 100 };

      if (periodSearch.trim()) {
        params.search = periodSearch.trim();
      }

      if (periodStatusFilter !== 'all') {
        params.status = periodStatusFilter;
      }

      const result = await examPeriodService.list(params);
      setPeriods(getItems(result));
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error) });
    } finally {
      setPeriodsLoading(false);
    }
  }, [periodSearch, periodStatusFilter]);

  useEffect(() => {
    if (tab === 'slots') loadSlots();
  }, [tab, loadSlots]);

  useEffect(() => {
    if (tab === 'periods') loadPeriods();
  }, [tab, loadPeriods]);

  function switchTab(nextTab) {
    if (nextTab === tab) return;

    setNotice(null);
    setTab(nextTab);
  }

  /* ----------------------------- Time slots ----------------------------- */

  function openCreate() {
    setEditingSlot(null);
    setForm({ ...emptySlotForm });
    setNotice(null);
    setFormOpen(true);
  }

  function openEdit(slot) {
    setEditingSlot(slot);

    setForm({
      label: slot.label || '',
      startTime: toTimeInput(slot.startTime),
      endTime: toTimeInput(slot.endTime),
      orderIndex: String(slot.orderIndex ?? 0),
    });

    setNotice(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (!saving) setFormOpen(false);
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    const start = form.startTime;
    const end = form.endTime;

    if (!form.label.trim()) {
      setNotice({
        type: 'error',
        text: 'Enter a name for this time slot.',
      });
      return;
    }

    if (!start || !end || start >= end) {
      setNotice({
        type: 'error',
        text: 'The end time must be later than the start time.',
      });
      return;
    }

    const orderIndex = Number(form.orderIndex);

    if (!Number.isInteger(orderIndex) || orderIndex < 0) {
      setNotice({
        type: 'error',
        text: 'Display order must be a non-negative whole number.',
      });
      return;
    }

    const payload = {
      label: form.label.trim(),
      startTime: start,
      endTime: end,
      orderIndex,
    };

    setSaving(true);

    try {
      if (editingSlot) {
        await timeSlotService.update(editingSlot.id, payload);
      } else {
        await timeSlotService.create(payload);
      }

      setFormOpen(false);

      setNotice({
        type: 'success',
        text: editingSlot
          ? 'Time slot updated successfully.'
          : 'Time slot created successfully.',
      });

      await loadSlots();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleSlotStatus(slot) {
    const nextActive = slot.isActive === false;
    const action = nextActive ? 'activate' : 'deactivate';

    if (
      !window.confirm(
        `${nextActive ? 'Activate' : 'Deactivate'} "${slot.label}"?`,
      )
    ) {
      return;
    }

    setNotice(null);

    try {
      await timeSlotService.setStatus(slot.id, nextActive);

      setNotice({
        type: 'success',
        text: `Time slot ${action}d successfully.`,
      });

      await loadSlots();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    }
  }

  /* ---------------------------- Exam periods ---------------------------- */

  function requireAdmin() {
    if (isAdmin) return true;

    setNotice({
      type: 'error',
      text: 'Only administrators can manage exam periods.',
    });

    return false;
  }

  function openCreatePeriod() {
    if (!requireAdmin()) return;

    setEditingPeriod(null);
    setPeriodForm({ ...emptyPeriodForm });
    setNotice(null);
    setPeriodFormOpen(true);
  }

  function openEditPeriod(period) {
    if (!requireAdmin()) return;

    setEditingPeriod(period);

    setPeriodForm({
      name: period.name || '',
      term: period.term || '',
      startDate: toDateInput(period.startDate),
      endDate: toDateInput(period.endDate),
      status: period.status || 'draft',
      description: period.description || '',
    });

    setNotice(null);
    setPeriodFormOpen(true);
  }

  function closePeriodForm() {
    if (!saving) {
      setPeriodFormOpen(false);
      setEditingPeriod(null);
    }
  }

  function updatePeriodField(event) {
    const { name, value } = event.target;

    setPeriodForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handlePeriodSubmit(event) {
    event.preventDefault();
    setNotice(null);

    // Protect the submit handler as well as the visible controls.
    if (!requireAdmin()) return;

    if (!periodForm.name.trim()) {
      setNotice({
        type: 'error',
        text: 'Enter a name for this exam period.',
      });
      return;
    }

    if (!periodForm.term.trim()) {
      setNotice({
        type: 'error',
        text: 'Enter a term for this exam period.',
      });
      return;
    }

    if (!periodForm.startDate || !periodForm.endDate) {
      setNotice({
        type: 'error',
        text: 'Select a start and end date.',
      });
      return;
    }

    if (periodForm.endDate < periodForm.startDate) {
      setNotice({
        type: 'error',
        text: 'The end date must be on or after the start date.',
      });
      return;
    }

    if (!PERIOD_STATUSES.includes(periodForm.status)) {
      setNotice({
        type: 'error',
        text: 'Select a valid exam period status.',
      });
      return;
    }

    const payload = {
      name: periodForm.name.trim(),
      term: periodForm.term.trim(),
      startDate: periodForm.startDate,
      endDate: periodForm.endDate,
      status: periodForm.status,
      description: periodForm.description.trim() || null,
    };

    setSaving(true);

    try {
      if (editingPeriod) {
        await examPeriodService.update(editingPeriod.id, payload);
      } else {
        await examPeriodService.create(payload);
      }

      setPeriodFormOpen(false);
      setEditingPeriod(null);

      setNotice({
        type: 'success',
        text: editingPeriod
          ? 'Exam period updated successfully.'
          : 'Exam period created successfully.',
      });

      await loadPeriods();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  async function changePeriodStatus(period, status) {
    if (!requireAdmin()) {
      await loadPeriods();
      return;
    }

    if (status === period.status) return;

    if (!PERIOD_STATUSES.includes(status)) {
      setNotice({
        type: 'error',
        text: 'Select a valid exam period status.',
      });
      await loadPeriods();
      return;
    }

    setNotice(null);

    try {
      await examPeriodService.setStatus(period.id, status);

      setNotice({
        type: 'success',
        text: `Exam period marked as ${periodStatusLabel(status).toLowerCase()}.`,
      });

      await loadPeriods();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });

      await loadPeriods();
    }
  }

  async function deletePeriod(period) {
    if (!requireAdmin()) return;

    const confirmed = window.confirm(
      `Delete exam period "${period.name}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setNotice(null);

    try {
      await examPeriodService.remove(period.id);

      setNotice({
        type: 'success',
        text: 'Exam period deleted successfully.',
      });

      await loadPeriods();
    } catch (error) {
      setNotice({
        type: 'error',
        text: errorMessage(error),
      });
    }
  }

  /* ------------------------------- Counts -------------------------------- */

  const totalSlotDuration = slots.reduce(
    (total, slot) => total + (Number(slot.durationMinutes) || 0),
    0,
  );

  const activeSlotCount = slots.filter(
    (slot) => slot.isActive !== false,
  ).length;

  const inactiveSlotCount = slots.length - activeSlotCount;

  const openPeriodCount = periods.filter(
    (item) => item.status === 'open',
  ).length;

  const publishedPeriodCount = periods.filter(
    (item) => item.status === 'published',
  ).length;

  const draftPeriodCount = periods.filter(
    (item) => item.status === 'draft',
  ).length;

  const isSlotsTab = tab === 'slots';

  return (
    <main className="page time-slots-page">
      <header className="ts-heading">
        <div>
          <div className="ts-eyebrow">SCHEDULING RESOURCES</div>

          <h1>Time Slots &amp; Periods</h1>

          <p>
            {isSlotsTab
              ? 'Manage the daily time windows used when generating exam schedules.'
              : 'Manage the exam periods (term windows) that group examination sessions.'}
          </p>
        </div>

        {isSlotsTab ? (
          <button
            type="button"
            className="btn ts-primary"
            onClick={openCreate}
          >
            <Plus size={17} /> Add time slot
          </button>
        ) : (
          isAdmin && (
            <button
              type="button"
              className="btn ts-primary"
              onClick={openCreatePeriod}
            >
              <Plus size={17} /> Add exam period
            </button>
          )
        )}
      </header>

      <nav className="ts-tabs" aria-label="Scheduling resource type">
        <button
          type="button"
          className={`ts-tab ${isSlotsTab ? 'is-active' : ''}`}
          onClick={() => switchTab('slots')}
        >
          <CalendarClock size={17} /> Time slots
        </button>

        <button
          type="button"
          className={`ts-tab ${!isSlotsTab ? 'is-active' : ''}`}
          onClick={() => switchTab('periods')}
        >
          <CalendarRange size={17} /> Exam periods
        </button>
      </nav>

      {notice && (
        <div
          className={`ts-notice ts-notice--${notice.type}`}
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
            className="ts-icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {isSlotsTab ? (
        <>
          <section className="ts-stats" aria-label="Time slot statistics">
            <article className="ts-stat-card">
              <span className="ts-stat-icon">
                <CalendarClock size={20} />
              </span>
              <div>
                <span className="ts-stat-label">Slots shown</span>
                <strong>{loading ? '—' : slots.length}</strong>
              </div>
            </article>

            <article className="ts-stat-card">
              <span className="ts-stat-icon ts-stat-icon--green">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <span className="ts-stat-label">Active slots</span>
                <strong>{loading ? '—' : activeSlotCount}</strong>
              </div>
            </article>

            <article className="ts-stat-card">
              <span className="ts-stat-icon ts-stat-icon--muted">
                <Clock3 size={20} />
              </span>
              <div>
                <span className="ts-stat-label">Inactive slots</span>
                <strong>{loading ? '—' : inactiveSlotCount}</strong>
              </div>
            </article>

            <article className="ts-stat-card">
              <span className="ts-stat-icon">
                <Clock3 size={20} />
              </span>
              <div>
                <span className="ts-stat-label">Combined duration</span>
                <strong>
                  {loading ? '—' : formatDuration(totalSlotDuration)}
                </strong>
              </div>
            </article>
          </section>

          <section className="card ts-table-card">
            <div className="ts-toolbar">
              <div>
                <h2>Daily time windows</h2>
                <p>
                  Each slot is stored in the database through the backend API.
                </p>
              </div>

              <button
                type="button"
                className="btn ts-secondary"
                onClick={() => {
                  setNotice(null);
                  loadSlots();
                }}
                disabled={loading}
              >
                <RefreshCw
                  size={16}
                  className={loading ? 'ts-spinning' : ''}
                />
                Refresh
              </button>
            </div>

            <form
              className="ts-filters"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput);
              }}
            >
              <div className="ts-search">
                <Search size={18} />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search time slots…"
                  aria-label="Search time slots"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button type="submit" className="btn ts-secondary">
                Search
              </button>
            </form>

            {loading ? (
              <div className="ts-state">
                <span className="ts-loader" />
                <h3>Loading time slots</h3>
                <p>
                  Please wait while time slots are retrieved from the database.
                </p>
              </div>
            ) : slots.length === 0 ? (
              <div className="ts-state">
                <CalendarClock size={36} />
                <h3>No time slots found</h3>
                <p>
                  {search || statusFilter !== 'all'
                    ? 'Try a different search term or status filter.'
                    : 'Create your first time slot to begin defining exam sessions.'}
                </p>

                <button
                  type="button"
                  className="btn ts-primary"
                  onClick={openCreate}
                >
                  <Plus size={17} /> Add time slot
                </button>
              </div>
            ) : (
              <div className="ts-table-wrap">
                <table className="ts-table">
                  <thead>
                    <tr>
                      <th>Slot</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Duration</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {slots.map((slot) => (
                      <tr key={slot.id}>
                        <td>
                          <div className="ts-slot-name">{slot.label}</div>
                          <div className="ts-slot-id">Slot #{slot.id}</div>
                        </td>

                        <td>{stringTime(slot.startTime)}</td>
                        <td>{stringTime(slot.endTime)}</td>

                        <td>
                          <span className="ts-duration">
                            <Clock3 size={15} />{' '}
                            {formatDuration(slot.durationMinutes)}
                          </span>
                        </td>

                        <td>{slot.orderIndex ?? '—'}</td>

                        <td>
                          <span
                            className={`ts-status ${
                              slot.isActive !== false
                                ? 'is-active'
                                : 'is-inactive'
                            }`}
                          >
                            <span />
                            {slot.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td>
                          <div className="ts-actions">
                            <button
                              type="button"
                              className="ts-action"
                              onClick={() => openEdit(slot)}
                              title="Edit slot"
                              aria-label={`Edit ${slot.label}`}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              type="button"
                              className="ts-status-action"
                              onClick={() => toggleSlotStatus(slot)}
                            >
                              {slot.isActive !== false
                                ? 'Deactivate'
                                : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="ts-table-footer">
              <span>
                {loading ? 'Loading…' : `${slots.length} slot(s) in this result`}
              </span>
              <span>Times are displayed in 24-hour format.</span>
            </footer>
          </section>

          {formOpen && (
            <div
              className="ts-modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeForm();
              }}
            >
              <section
                className="ts-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ts-modal-title"
              >
                <header className="ts-modal-heading">
                  <div>
                    <span className="ts-eyebrow">
                      {editingSlot
                        ? 'UPDATE SCHEDULE RESOURCE'
                        : 'NEW SCHEDULE RESOURCE'}
                    </span>

                    <h2 id="ts-modal-title">
                      {editingSlot ? 'Edit time slot' : 'Create time slot'}
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="ts-icon-button"
                    aria-label="Close form"
                    onClick={closeForm}
                    disabled={saving}
                  >
                    <X size={20} />
                  </button>
                </header>

                <form onSubmit={handleSubmit}>
                  <div className="ts-form-body">
                    <label className="ts-field">
                      <span>Slot name <b>*</b></span>
                      <input
                        name="label"
                        value={form.label}
                        onChange={updateField}
                        maxLength={50}
                        placeholder="e.g. Morning Session 1"
                        required
                        autoFocus
                      />
                    </label>

                    <div className="ts-form-grid">
                      <label className="ts-field">
                        <span>Start time <b>*</b></span>
                        <input
                          type="time"
                          name="startTime"
                          value={form.startTime}
                          onChange={updateField}
                          required
                        />
                      </label>

                      <label className="ts-field">
                        <span>End time <b>*</b></span>
                        <input
                          type="time"
                          name="endTime"
                          value={form.endTime}
                          onChange={updateField}
                          min={form.startTime}
                          required
                        />
                      </label>
                    </div>

                    <label className="ts-field">
                      <span>Display order</span>
                      <input
                        type="number"
                        name="orderIndex"
                        value={form.orderIndex}
                        onChange={updateField}
                        min="0"
                        max="60000"
                        step="1"
                        required
                      />
                      <small>
                        Lower numbers appear earlier in the ordering.
                      </small>
                    </label>

                    <div className="ts-form-hint">
                      <Clock3 size={17} />
                      Duration:{' '}
                      {formatDuration(
                        Math.max(
                          0,
                          Number(form.endTime.slice(0, 2)) * 60 +
                            Number(form.endTime.slice(3, 5)) -
                            (Number(form.startTime.slice(0, 2)) * 60 +
                              Number(form.startTime.slice(3, 5))),
                        ),
                      )}
                      <span>•</span>
                      Times must not overlap another slot.
                    </div>
                  </div>

                  <footer className="ts-modal-footer">
                    <button
                      type="button"
                      className="btn ts-secondary"
                      onClick={closeForm}
                      disabled={saving}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="btn ts-primary"
                      disabled={saving}
                    >
                      {saving
                        ? 'Saving…'
                        : editingSlot
                          ? 'Save changes'
                          : 'Create slot'}
                    </button>
                  </footer>
                </form>
              </section>
            </div>
          )}
        </>
      ) : (
        <>
          <section className="ts-stats" aria-label="Exam period statistics">
            <article className="ts-stat-card">
              <span className="ts-stat-icon">
                <CalendarRange size={20} />
              </span>
              <div>
                <span className="ts-stat-label">Periods shown</span>
                <strong>{periodsLoading ? '—' : periods.length}</strong>
              </div>
            </article>

            <article className="ts-stat-card">
              <span className="ts-stat-icon ts-stat-icon--green">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <span className="ts-stat-label">Open</span>
                <strong>{periodsLoading ? '—' : openPeriodCount}</strong>
              </div>
            </article>

            <article className="ts-stat-card">
              <span className="ts-stat-icon">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <span className="ts-stat-label">Published</span>
                <strong>{periodsLoading ? '—' : publishedPeriodCount}</strong>
              </div>
            </article>

            <article className="ts-stat-card">
              <span className="ts-stat-icon ts-stat-icon--muted">
                <Clock3 size={20} />
              </span>
              <div>
                <span className="ts-stat-label">Draft</span>
                <strong>{periodsLoading ? '—' : draftPeriodCount}</strong>
              </div>
            </article>
          </section>

          <section className="card ts-table-card">
            <div className="ts-toolbar">
              <div>
                <h2>Exam periods</h2>
                <p>
                  Exam periods group sessions for a term and can be opened or
                  published.
                </p>
              </div>

              <button
                type="button"
                className="btn ts-secondary"
                onClick={() => {
                  setNotice(null);
                  loadPeriods();
                }}
                disabled={periodsLoading}
              >
                <RefreshCw
                  size={16}
                  className={periodsLoading ? 'ts-spinning' : ''}
                />
                Refresh
              </button>
            </div>

            <form
              className="ts-filters"
              onSubmit={(event) => {
                event.preventDefault();
                setPeriodSearch(periodSearchInput);
              }}
            >
              <div className="ts-search">
                <Search size={18} />
                <input
                  type="search"
                  value={periodSearchInput}
                  onChange={(event) => setPeriodSearchInput(event.target.value)}
                  placeholder="Search exam periods…"
                  aria-label="Search exam periods"
                />
              </div>

              <select
                value={periodStatusFilter}
                onChange={(event) => setPeriodStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {PERIOD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {periodStatusLabel(status)}
                  </option>
                ))}
              </select>

              <button type="submit" className="btn ts-secondary">
                Search
              </button>
            </form>

            {periodsLoading ? (
              <div className="ts-state">
                <span className="ts-loader" />
                <h3>Loading exam periods</h3>
                <p>
                  Please wait while exam periods are retrieved from the
                  database.
                </p>
              </div>
            ) : periods.length === 0 ? (
              <div className="ts-state">
                <CalendarRange size={36} />
                <h3>No exam periods found</h3>
                <p>
                  {periodSearch || periodStatusFilter !== 'all'
                    ? 'Try a different search term or status filter.'
                    : 'Create your first exam period to group examination sessions.'}
                </p>

                {isAdmin && (
                  <button
                    type="button"
                    className="btn ts-primary"
                    onClick={openCreatePeriod}
                  >
                    <Plus size={17} /> Add exam period
                  </button>
                )}
              </div>
            ) : (
              <div className="ts-table-wrap">
                <table className="ts-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Term</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {periods.map((period) => (
                      <tr key={period.id}>
                        <td>
                          <div className="ts-slot-name">{period.name}</div>

                          {period.description && (
                            <div className="ts-slot-id">
                              {period.description}
                            </div>
                          )}
                        </td>

                        <td>{period.term || '—'}</td>
                        <td>{toDateInput(period.startDate) || '—'}</td>
                        <td>{toDateInput(period.endDate) || '—'}</td>

                        <td>
                          <span
                            className={`ts-status ts-status--${
                              period.status || 'draft'
                            }`}
                          >
                            <span />
                            {periodStatusLabel(period.status)}
                          </span>
                        </td>

                        <td>
                          <div className="ts-actions">
                            {isAdmin ? (
                              <>
                                <button
                                  type="button"
                                  className="ts-action"
                                  onClick={() => openEditPeriod(period)}
                                  title="Edit exam period"
                                  aria-label={`Edit ${period.name}`}
                                >
                                  <Pencil size={16} />
                                </button>

                                <select
                                  className="ts-period-status-select"
                                  value={period.status || 'draft'}
                                  onChange={(event) =>
                                    changePeriodStatus(
                                      period,
                                      event.target.value,
                                    )
                                  }
                                  aria-label={`Change status for ${period.name}`}
                                  title="Change exam period status"
                                >
                                  {PERIOD_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {periodStatusLabel(status)}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  className="ts-action ts-action--danger"
                                  onClick={() => deletePeriod(period)}
                                  title="Delete exam period"
                                  aria-label={`Delete ${period.name}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            ) : (
                              <span className="ts-slot-id">
                                View only
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="ts-table-footer">
              <span>
                {periodsLoading
                  ? 'Loading…'
                  : `${periods.length} period(s) in this result`}
              </span>
              <span>Dates use the YYYY-MM-DD format.</span>
            </footer>
          </section>

          {periodFormOpen && isAdmin && (
            <div
              className="ts-modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closePeriodForm();
                }
              }}
            >
              <section
                className="ts-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ts-period-modal-title"
              >
                <header className="ts-modal-heading">
                  <div>
                    <span className="ts-eyebrow">
                      {editingPeriod
                        ? 'UPDATE EXAM PERIOD'
                        : 'NEW EXAM PERIOD'}
                    </span>

                    <h2 id="ts-period-modal-title">
                      {editingPeriod
                        ? 'Edit exam period'
                        : 'Create exam period'}
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="ts-icon-button"
                    aria-label="Close form"
                    onClick={closePeriodForm}
                    disabled={saving}
                  >
                    <X size={20} />
                  </button>
                </header>

                <form onSubmit={handlePeriodSubmit}>
                  <div className="ts-form-body">
                    <label className="ts-field">
                      <span>Period name <b>*</b></span>
                      <input
                        name="name"
                        value={periodForm.name}
                        onChange={updatePeriodField}
                        maxLength={150}
                        placeholder="e.g. Final Examinations — First Semester"
                        required
                        autoFocus
                      />
                    </label>

                    <label className="ts-field">
                      <span>Term <b>*</b></span>
                      <input
                        name="term"
                        value={periodForm.term}
                        onChange={updatePeriodField}
                        maxLength={30}
                        placeholder="e.g. 2025/2026 Semester 1"
                        required
                      />
                    </label>

                    <div className="ts-form-grid">
                      <label className="ts-field">
                        <span>Start date <b>*</b></span>
                        <input
                          type="date"
                          name="startDate"
                          value={periodForm.startDate}
                          onChange={updatePeriodField}
                          max={periodForm.endDate || undefined}
                          required
                        />
                      </label>

                      <label className="ts-field">
                        <span>End date <b>*</b></span>
                        <input
                          type="date"
                          name="endDate"
                          value={periodForm.endDate}
                          onChange={updatePeriodField}
                          min={periodForm.startDate || undefined}
                          required
                        />
                      </label>
                    </div>

                    <label className="ts-field">
                      <span>Status</span>
                      <select
                        name="status"
                        value={periodForm.status}
                        onChange={updatePeriodField}
                      >
                        {PERIOD_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {periodStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                      <small>
                        Only published periods should be visible to students.
                      </small>
                    </label>

                    <label className="ts-field">
                      <span>Description</span>
                      <textarea
                        name="description"
                        value={periodForm.description}
                        onChange={updatePeriodField}
                        rows={3}
                        maxLength={2000}
                        placeholder="Optional notes about this exam period"
                      />
                    </label>
                  </div>

                  <footer className="ts-modal-footer">
                    <button
                      type="button"
                      className="btn ts-secondary"
                      onClick={closePeriodForm}
                      disabled={saving}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="btn ts-primary"
                      disabled={saving}
                    >
                      {saving
                        ? 'Saving…'
                        : editingPeriod
                          ? 'Save changes'
                          : 'Create period'}
                    </button>
                  </footer>
                </form>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function stringTime(value) {
  if (!value) return '—';
  return String(value).slice(0, 5);
}
