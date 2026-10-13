import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

import timeSlotService from '../services/timeSlotService';
import '../styles/time-slots.css';

const emptyForm = {
  label: '',
  startTime: '08:30',
  endTime: '10:00',
  orderIndex: '0',
};

function unwrap(payload) {
  return payload?.data ?? payload;
}

function getItems(payload) {
  let current = unwrap(payload);

  for (let i = 0; i < 5 && current; i += 1) {
    if (Array.isArray(current)) return current;
    if (Array.isArray(current.items)) return current.items;
    current = current.data;
  }

  return [];
}

function formatTime(value) {
  if (!value) return '—';
  return String(value).slice(0, 5);
}

function formatDuration(minutes) {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function errorMessage(error) {
  if (error?.details?.length) {
    return error.details.map((item) => item.message).filter(Boolean).join(' ');
  }

  return error?.message || 'The request failed. Please try again.';
}

export default function TimeSlots() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notice, setNotice] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setNotice(null);

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

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const activeCount = slots.filter((slot) => slot.isActive).length;
  const inactiveCount = slots.length - activeCount;

  function openCreate() {
    setEditingSlot(null);
    setForm(emptyForm);
    setNotice(null);
    setFormOpen(true);
  }

  function openEdit(slot) {
    setEditingSlot(slot);
    setForm({
      label: slot.label ?? '',
      startTime: formatTime(slot.startTime),
      endTime: formatTime(slot.endTime),
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
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    const start = form.startTime;
    const end = form.endTime;

    if (!form.label.trim()) {
      setNotice({ type: 'error', text: 'Enter a name for this time slot.' });
      return;
    }

    if (!start || !end || start >= end) {
      setNotice({
        type: 'error',
        text: 'The end time must be later than the start time.',
      });
      return;
    }

    const payload = {
      label: form.label.trim(),
      startTime: start,
      endTime: end,
      orderIndex: Number(form.orderIndex),
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
      setNotice({ type: 'error', text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(slot) {
    const action = slot.isActive ? 'deactivate' : 'activate';

    if (!window.confirm(`Are you sure you want to ${action} "${slot.label}"?`)) {
      return;
    }

    setNotice(null);

    try {
      await timeSlotService.setStatus(slot.id, !slot.isActive);
      setNotice({
        type: 'success',
        text: `Time slot ${action}d successfully.`,
      });
      await loadSlots();
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error) });
    }
  }

  const totalDuration = slots.reduce(
    (total, slot) => total + (Number(slot.durationMinutes) || 0),
    0,
  );

  return (
    <main className="page time-slots-page">
      <header className="ts-heading">
        <div>
          <div className="ts-eyebrow">SCHEDULING RESOURCES</div>
          <h1>Time Slots &amp; Periods</h1>
          <p>Manage the daily time windows available for examinations.</p>
        </div>

        <button className="btn ts-primary" onClick={openCreate}>
          <Plus size={18} />
          Add time slot
        </button>
      </header>

      {notice && (
        <div
          className={`ts-notice ts-notice--${notice.type}`}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          {notice.type === 'error'
            ? <AlertCircle size={18} />
            : <CheckCircle2 size={18} />}
          <span>{notice.text}</span>
          <button
            type="button"
            className="ts-icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="ts-stats" aria-label="Time slot statistics">
        <article className="ts-stat-card">
          <span className="ts-stat-icon"><CalendarClock size={20} /></span>
          <div>
            <span className="ts-stat-label">Slots shown</span>
            <strong>{loading ? '—' : slots.length}</strong>
          </div>
        </article>

        <article className="ts-stat-card">
          <span className="ts-stat-icon ts-stat-icon--green"><CheckCircle2 size={20} /></span>
          <div>
            <span className="ts-stat-label">Active slots</span>
            <strong>{loading ? '—' : activeCount}</strong>
          </div>
        </article>

        <article className="ts-stat-card">
          <span className="ts-stat-icon ts-stat-icon--muted"><Clock3 size={20} /></span>
          <div>
            <span className="ts-stat-label">Inactive slots</span>
            <strong>{loading ? '—' : inactiveCount}</strong>
          </div>
        </article>

        <article className="ts-stat-card">
          <span className="ts-stat-icon"><Clock3 size={20} /></span>
          <div>
            <span className="ts-stat-label">Combined duration</span>
            <strong>{loading ? '—' : formatDuration(totalDuration)}</strong>
          </div>
        </article>
      </section>

      <section className="card ts-table-card">
        <div className="ts-toolbar">
          <div>
            <h2>Daily time windows</h2>
            <p>Changes are saved through the backend API.</p>
          </div>

          <button
            type="button"
            className="btn ts-secondary"
            onClick={loadSlots}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'ts-spinning' : ''} />
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
            <Search size={17} />
            <input
              aria-label="Search time slots"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by slot name..."
            />
          </div>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>

          <button type="submit" className="btn ts-secondary">Search</button>
        </form>

        {loading ? (
          <div className="ts-state">
            <span className="ts-loader" />
            <p>Loading time slots from the database...</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="ts-state">
            <CalendarClock size={34} />
            <h3>No time slots found</h3>
            <p>
              {search || statusFilter !== 'all'
                ? 'Try changing the search or status filter.'
                : 'Create a time slot to begin configuring exam sessions.'}
            </p>
            {!search && statusFilter === 'all' && (
              <button className="btn ts-primary" onClick={openCreate}>
                <Plus size={17} /> Create first slot
              </button>
            )}
          </div>
        ) : (
          <div className="ts-table-wrap">
            <table className="ts-table">
              <thead>
                <tr>
                  <th>Time slot</th>
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
                    <td>{formatTime(slot.startTime)}</td>
                    <td>{formatTime(slot.endTime)}</td>
                    <td>
                      <span className="ts-duration">
                        <Clock3 size={14} />
                        {formatDuration(slot.durationMinutes)}
                      </span>
                    </td>
                    <td>{slot.orderIndex}</td>
                    <td>
                      <span className={`ts-status ${slot.isActive ? 'is-active' : 'is-inactive'}`}>
                        <span />
                        {slot.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="ts-actions">
                        <button
                          type="button"
                          className="ts-action"
                          onClick={() => openEdit(slot)}
                          title={`Edit ${slot.label}`}
                          aria-label={`Edit ${slot.label}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="ts-status-action"
                          onClick={() => toggleStatus(slot)}
                        >
                          {slot.isActive ? 'Deactivate' : 'Activate'}
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
          <span>{loading ? 'Loading…' : `${slots.length} slot(s) in this result`}</span>
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
                  {editingSlot ? 'UPDATE SCHEDULE RESOURCE' : 'NEW SCHEDULE RESOURCE'}
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
                  <small>Lower numbers appear earlier in the ordering.</small>
                </label>

                <div className="ts-form-hint">
                  <Clock3 size={17} />
                  Duration: {formatDuration(
                    Math.max(
                      0,
                      (Number(form.endTime.slice(0, 2)) * 60 + Number(form.endTime.slice(3, 5))) -
                      (Number(form.startTime.slice(0, 2)) * 60 + Number(form.startTime.slice(3, 5))),
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
                <button type="submit" className="btn ts-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingSlot ? 'Save changes' : 'Create slot'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}