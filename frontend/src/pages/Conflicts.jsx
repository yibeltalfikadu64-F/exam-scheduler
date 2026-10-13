import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import api from '../services/api';
import './Conflicts.css';

function unwrap(response) {
  return response?.data ?? response ?? {};
}

function errorMessage(error) {
  if (error?.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (error?.status === 403) {
    return 'Your role does not have permission to validate schedules.';
  }

  return error?.message || 'Unable to load conflict information.';
}

function formatLabel(value) {
  return String(value || 'unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function Conflicts() {
  const [schedules, setSchedules] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = unwrap(
        await api.get('/scheduling/schedules', {
          params: { page: 1, limit: 100 },
        })
      );

      const items = Array.isArray(response.items)
        ? response.items
        : [];

      setSchedules(items);

      setSelectedId((current) => {
        if (current && items.some(
          (schedule) => String(schedule.id) === String(current)
        )) {
          return current;
        }

        return items.length ? String(items[0].id) : '';
      });
    } catch (err) {
      setSchedules([]);
      setSelectedId('');
      setConflicts([]);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSelectedSchedule = useCallback(async () => {
    if (!selectedId) {
      setConflicts([]);
      return;
    }

    setError('');

    try {
      const response = unwrap(
        await api.get(`/scheduling/schedules/${selectedId}`)
      );

      setConflicts(
        Array.isArray(response.conflicts)
          ? response.conflicts
          : []
      );
    } catch (err) {
      setConflicts([]);
      setError(errorMessage(err));
    }
  }, [selectedId]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    loadSelectedSchedule();
  }, [loadSelectedSchedule]);

  async function validateSchedule() {
    if (!selectedId || validating) return;

    setValidating(true);
    setError('');
    setNotice('');

    try {
      const response = unwrap(
        await api.post(
          `/scheduling/schedules/${selectedId}/validate`
        )
      );

      // Validation returns freshly detected conflicts.
      // Reload the schedule to display persisted open conflicts.
      const refreshed = unwrap(
        await api.get(`/scheduling/schedules/${selectedId}`)
      );

      const storedConflicts = Array.isArray(refreshed.conflicts)
        ? refreshed.conflicts
        : [];

      setConflicts(storedConflicts);

      const count = Number(
        response.conflictCount ?? response.conflicts?.length ?? 0
      );

      setNotice(
        response.valid === true
          ? 'Validation completed. No conflicts were detected.'
          : `Validation completed. ${count} conflict(s) detected.`
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setValidating(false);
    }
  }

  const visibleConflicts = conflicts.filter((conflict) => {
    if (filter === 'all') return true;

    return String(conflict.severity || '').toLowerCase() === filter;
  });

  const criticalCount = conflicts.filter(
    (conflict) => String(conflict.severity).toLowerCase() === 'critical'
  ).length;

  const warningCount = conflicts.filter(
    (conflict) => String(conflict.severity).toLowerCase() === 'warning'
  ).length;

  const selectedSchedule = schedules.find(
    (schedule) => String(schedule.id) === String(selectedId)
  );

  return (
    <main className="conflicts-page">
      <header className="conflicts-header">
        <div>
          <div className="conflicts-eyebrow">
            <ShieldAlert size={16} />
            EXAM MANAGEMENT
          </div>

          <h1>Schedule Conflicts</h1>

          <p>
            Review stored conflicts and validate examination timetables
            using the backend scheduling engine.
          </p>
        </div>

        <button
          className="conflicts-button conflicts-button-secondary"
          type="button"
          onClick={async () => {
            setNotice('');
            await loadSchedules();
          }}
          disabled={loading || validating}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="conflicts-alert conflicts-alert-error" role="alert">
          <AlertTriangle size={19} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="conflicts-alert conflicts-alert-success" role="status">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
        </div>
      )}

      <section className="conflicts-toolbar">
        <label className="conflicts-field">
          <span>Examination schedule</span>

          <select
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setNotice('');
            }}
            disabled={loading || !schedules.length}
          >
            {!schedules.length && (
              <option value="">No schedules available</option>
            )}

            {schedules.map((schedule) => (
              <option key={schedule.id} value={String(schedule.id)}>
                {schedule.name || `Schedule #${schedule.id}`}
                {' — '}
                {schedule.status}
              </option>
            ))}
          </select>
        </label>

        <label className="conflicts-field">
          <span>Severity</span>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
          </select>
        </label>

        <button
          className="conflicts-button conflicts-button-primary"
          type="button"
          onClick={validateSchedule}
          disabled={!selectedId || loading || validating}
        >
          <RefreshCw
            size={16}
            className={validating ? 'conflicts-spin' : ''}
          />
          {validating ? 'Validating…' : 'Validate schedule'}
        </button>
      </section>

      <section className="conflicts-stats">
        <article className="conflicts-stat-card">
          <span>Open conflicts</span>
          <strong>{conflicts.length}</strong>
        </article>

        <article className="conflicts-stat-card">
          <span>Critical</span>
          <strong className={criticalCount ? 'conflicts-critical' : ''}>
            {criticalCount}
          </strong>
        </article>

        <article className="conflicts-stat-card">
          <span>Warnings</span>
          <strong>{warningCount}</strong>
        </article>
      </section>

      {selectedSchedule && (
        <div className="conflicts-schedule-info">
          <div>
            <span>Selected timetable</span>
            <strong>
              {selectedSchedule.name || `Schedule #${selectedSchedule.id}`}
            </strong>
          </div>

          <span className={`conflicts-status status-${selectedSchedule.status}`}>
            {formatLabel(selectedSchedule.status)}
          </span>
        </div>
      )}

      {loading ? (
        <div className="conflicts-empty">
          <RefreshCw size={25} className="conflicts-spin" />
          <p>Loading examination schedules…</p>
        </div>
      ) : !error && !selectedSchedule ? (
        <div className="conflicts-empty">
          <Clock size={32} />
          <h2>No schedules available</h2>
          <p>Create or generate an examination schedule before reviewing conflicts.</p>
        </div>
      ) : !error && visibleConflicts.length === 0 ? (
        <div className="conflicts-empty">
          <CheckCircle2 size={36} />

          <h2>
            {conflicts.length === 0
              ? 'No open conflicts recorded'
              : 'No conflicts match this filter'}
          </h2>

          <p>
            {conflicts.length === 0
              ? 'This means no open conflicts are currently stored for this schedule. Run validation to check its current state.'
              : 'Try selecting another severity.'}
          </p>
        </div>
      ) : !error ? (
        <section className="conflicts-list">
          {visibleConflicts.map((conflict) => (
            <article className="conflicts-item" key={conflict.id}>
              <div className="conflicts-item-icon">
                <AlertTriangle size={21} />
              </div>

              <div className="conflicts-item-content">
                <div className="conflicts-item-heading">
                  <h2>{conflict.title || formatLabel(conflict.type)}</h2>

                  <span
                    className={`conflicts-severity severity-${String(
                      conflict.severity || 'unknown'
                    ).toLowerCase()}`}
                  >
                    {formatLabel(conflict.severity)}
                  </span>
                </div>

                <p>{conflict.description || 'No additional description available.'}</p>

                <div className="conflicts-item-meta">
                  <span>Type: {formatLabel(conflict.type)}</span>
                  <span>Status: {formatLabel(conflict.status)}</span>
                  {conflict.id != null && <span>Conflict #{conflict.id}</span>}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
