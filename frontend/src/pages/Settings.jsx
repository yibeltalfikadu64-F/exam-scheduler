
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Settings as SettingsIcon,
  CalendarDays,
  Clock3,
  Bell,
  Palette,
  Info,
  RotateCcw,
  Save,
  ShieldCheck,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import api from '../services/api';
import settingsService, {
  getResetPreview,
  executeSystemReset,
} from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import '../styles/settings.css';

const RESET_CONFIRMATION = 'RESET OPERATIONAL DATA';

const RESET_TABLES = [
  'invigilations',
  'schedule_conflicts',
  'exam_schedule_details',
  'exam_schedules',
  'exams',
];

const CATEGORY_META = {
  branding: {
    title: 'Institution branding',
    description: 'Identity and appearance values shown across the application.',
    icon: Palette,
  },
  academic: {
    title: 'Academic defaults',
    description: 'Records pre-selected when creating exams and schedules.',
    icon: CalendarDays,
  },
  scheduling: {
    title: 'Scheduling constraints',
    description: 'Default limits applied by the scheduling engine.',
    icon: Clock3,
  },
  notifications: {
    title: 'Notification defaults',
    description: 'How and when the system produces notifications.',
    icon: Bell,
  },
  system: {
    title: 'System Reset',
    description: 'Administrative preview of operational scheduling data.',
    icon: RotateCcw,
  },
};

const CATEGORY_ORDER = [
  'branding',
  'academic',
  'scheduling',
  'notifications',
  'system',
];

const REFERENCE_OPTIONS = {
  'academic.default_academic_year_id': {
    source: 'academicYear',
    label: 'academic year',
  },
  'academic.default_semester_id': {
    source: 'semester',
    label: 'semester',
  },
  'academic.default_exam_period_id': {
    source: 'examPeriod',
    label: 'exam period',
  },
};

function getPayload(response) {
  return response?.data ?? response;
}

function errorText(error) {
  if (Array.isArray(error?.details)) {
    const messages = error.details
      .map((detail) => detail.message || detail.msg)
      .filter(Boolean);

    if (messages.length) return messages.join(' ');
  }

  return (
    error?.response?.data?.message ||
    error?.message ||
    'The request failed. Please try again.'
  );
}

function toDraft(setting, value) {
  if (setting.valueType === 'boolean') return Boolean(value);
  if (value === null || value === undefined) return '';
  return String(value);
}

function toPayload(setting, draftValue) {
  if (setting.valueType === 'boolean') return Boolean(draftValue);

  if (setting.valueType === 'number') {
    if (
      draftValue === '' ||
      draftValue === null ||
      draftValue === undefined
    ) {
      return null;
    }

    return Number(draftValue);
  }

  if (setting.valueType === 'json') return draftValue;

  return draftValue;
}

function readResetCounts(response) {
  let data = response;

  for (let i = 0; i < 3; i += 1) {
    if (data?.counts) break;
    if (!data?.data) break;
    data = data.data;
  }

  const counts = data?.counts;

  if (
    !counts ||
    typeof counts !== 'object' ||
    Array.isArray(counts) ||
    !RESET_TABLES.every((table) =>
      Object.prototype.hasOwnProperty.call(counts, table)
    )
  ) {
    throw new Error(
      'The reset preview did not return counts for all five approved tables. Check the backend response.'
    );
  }

  return counts;
}

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  const [settings, setSettings] = useState([]);
  const [draft, setDraft] = useState({});
  const [activeSection, setActiveSection] = useState('overview');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [references, setReferences] = useState({
    academicYear: [],
    semester: [],
    examPeriod: [],
  });

  const [resetPreview, setResetPreview] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetExecuting, setResetExecuting] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  const applyCatalogue = useCallback((data) => {
    const list = Array.isArray(data?.settings) ? data.settings : [];

    setSettings(list);
    setDraft(
      list.reduce((acc, setting) => {
        acc[setting.key] = toDraft(setting, setting.value);
        return acc;
      }, {})
    );
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await settingsService.list();
      applyCatalogue(getPayload(response));
    } catch (loadError) {
      setError(errorText(loadError));
      setSettings([]);
    } finally {
      setLoading(false);
    }
  }, [applyCatalogue]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      try {
        const [yearsResponse, periodsResponse] = await Promise.all([
          api.get('/academic-years'),
          api.get('/exam-periods/options'),
        ]);

        const yearsPayload = getPayload(yearsResponse);
        const periodsPayload = getPayload(periodsResponse);

        const years = Array.isArray(yearsPayload?.items)
          ? yearsPayload.items
          : Array.isArray(yearsPayload?.academicYears)
            ? yearsPayload.academicYears
            : Array.isArray(yearsPayload)
              ? yearsPayload
              : [];

        const periods = Array.isArray(periodsPayload?.examPeriods)
          ? periodsPayload.examPeriods
          : Array.isArray(periodsPayload?.items)
            ? periodsPayload.items
            : [];

        const semesterLists = await Promise.all(
          years.map(async (year) => {
            try {
              const response = await api.get(
                `/academic-years/${year.id}/semesters`
              );

              const payload = getPayload(response);

              const items = Array.isArray(payload?.semesters)
                ? payload.semesters
                : Array.isArray(payload?.items)
                  ? payload.items
                  : Array.isArray(payload)
                    ? payload
                    : [];

              return items.map((semester) => ({
                ...semester,
                academicYearName:
                  year.name || year.code || `Year ${year.id}`,
              }));
            } catch {
              return [];
            }
          })
        );

        if (!active) return;

        setReferences({
          academicYear: years.map((year) => ({
            id: year.id,
            label: year.name || year.code || `Academic year ${year.id}`,
          })),
          semester: semesterLists.flat().map((semester) => ({
            id: semester.id,
            label: `${
              semester.name ||
              semester.semester_name ||
              `Semester ${semester.id}`
            }${
              semester.academicYearName
                ? ` — ${semester.academicYearName}`
                : ''
            }`,
          })),
          examPeriod: periods.map((period) => ({
            id: period.id,
            label: period.name
              ? `${period.name}${period.term ? ` (${period.term})` : ''}`
              : `Exam period ${period.id}`,
          })),
        });
      } catch {
        // Reference dropdowns are optional enhancements.
      }
    }

    loadReferences();

    return () => {
      active = false;
    };
  }, []);

  const changedKeys = useMemo(
    () =>
      settings
        .filter((setting) => {
          const next = toPayload(setting, draft[setting.key]);
          const current =
            setting.value === null || setting.value === undefined
              ? null
              : setting.value;

          if (setting.valueType === 'number') {
            return (
              (next === null ? null : Number(next)) !==
              (current === null ? null : Number(current))
            );
          }

          return next !== current;
        })
        .map((setting) => setting.key),
    [settings, draft]
  );

  function updateValue(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice('');
  }

  function resetDraft() {
    setDraft(
      settings.reduce((acc, setting) => {
        acc[setting.key] = toDraft(setting, setting.value);
        return acc;
      }, {})
    );

    setNotice('Unsaved changes were discarded.');
  }

  async function saveChanges() {
    setError('');
    setNotice('');

    if (changedKeys.length === 0) {
      setNotice('There are no changes to save.');
      return;
    }

    const payload = {};

    changedKeys.forEach((key) => {
      const setting = settings.find((item) => item.key === key);
      payload[key] = toPayload(setting, draft[key]);
    });

    setSaving(true);

    try {
      const response = await settingsService.update(payload);
      const data = getPayload(response);

      if (data?.settings) applyCatalogue(data);

      setNotice('Settings saved successfully.');
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function loadResetPreview() {
    if (!isAdmin || resetLoading || resetExecuting) return;

    setResetError('');
    setResetNotice('');
    setResetArmed(false);
    setResetPreview(null);
    setResetLoading(true);

    try {
      const response = await getResetPreview();
      const counts = readResetCounts(response);

      setResetPreview(counts);
      setResetNotice('Preview loaded successfully. No data has been deleted.');
    } catch (previewError) {
      setResetError(errorText(previewError));
      setResetPreview(null);
    } finally {
      setResetLoading(false);
    }
  }

  function handlePrepareReset() {
    setResetError('');
    setResetNotice('');

    if (!isAdmin) {
      setResetError('Only administrators can reset operational data.');
      return;
    }

    if (!resetPreview) {
      setResetError('Refresh the preview before proceeding.');
      return;
    }

    // Opening the review step does not execute the reset.
    // The confirmation phrase is checked by the final action.
    setResetArmed(true);
  }

  function handleCancelReset() {
    setResetArmed(false);
    setResetError('');
  }

  async function handleSystemReset() {
    if (!isAdmin || resetLoading || resetExecuting || !resetArmed) {
      return;
    }

    if (!resetPreview) {
      setResetError('Refresh the preview before proceeding.');
      setResetArmed(false);
      return;
    }

    if (resetConfirmation.trim() !== RESET_CONFIRMATION) {
      setResetError(`Type ${RESET_CONFIRMATION} exactly to continue.`);
      return;
    }

    const confirmed = window.confirm(
      'WARNING: This permanently deletes operational exam and scheduling records. ' +
        'Only the five approved tables will be cleared. Preserved data and existing ' +
        'audit logs must remain untouched. Continue only if you are authorized.'
    );

    if (!confirmed) return;

    setResetExecuting(true);
    setResetError('');
    setResetNotice('');

    try {
      const result = await executeSystemReset(RESET_CONFIRMATION);

      if (result?.success !== true) {
        throw new Error(
          'The server did not explicitly confirm a successful reset. Check the backend response before retrying.'
        );
      }

      setResetConfirmation('');
      setResetArmed(false);
      setResetNotice(
        'The server reported success. Refreshing the operational-data preview…'
      );

      // Never repeat the reset request if refreshing the preview fails.
      setResetLoading(true);

      try {
        const response = await getResetPreview();
        const counts = readResetCounts(response);

        setResetPreview(counts);
        setResetNotice(
          'Reset completed according to the server response. The preview has been refreshed.'
        );
      } catch (previewError) {
        setResetError(
          `The reset request reported success, but the preview could not be refreshed: ${errorText(previewError)}`
        );
      } finally {
        setResetLoading(false);
      }
    } catch (resetErrorValue) {
      setResetError(errorText(resetErrorValue));
    } finally {
      setResetExecuting(false);
    }
  }

  function renderControl(setting) {
    const value = draft[setting.key];
    const disabled = !isAdmin || saving;
    const reference = REFERENCE_OPTIONS[setting.key];
    const referenceItems = reference ? references[reference.source] : null;

    if (setting.valueType === 'boolean') {
      return (
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) =>
              updateValue(setting.key, event.target.checked)
            }
          />
          <span className="settings-toggle-track" aria-hidden="true" />
          <span className="settings-toggle-text">
            {value ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      );
    }

    if (setting.key === 'branding.default_theme') {
      return (
        <select
          className="settings-select"
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => updateValue(setting.key, event.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      );
    }

    if (reference && referenceItems?.length > 0) {
      return (
        <select
          className="settings-select"
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => updateValue(setting.key, event.target.value)}
        >
          <option value="">Not set</option>
          {referenceItems.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.label}
            </option>
          ))}
        </select>
      );
    }

    if (setting.valueType === 'number') {
      return (
        <input
          className="settings-input"
          type="number"
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => updateValue(setting.key, event.target.value)}
        />
      );
    }

    return (
      <input
        className="settings-input"
        type="text"
        value={value ?? ''}
        disabled={disabled}
        maxLength={500}
        onChange={(event) => updateValue(setting.key, event.target.value)}
      />
    );
  }

  const grouped = useMemo(() => {
    const result = {};

    settings.forEach((setting) => {
      const category = setting.category || 'general';

      if (!result[category]) result[category] = [];
      result[category].push(setting);
    });

    return result;
  }, [settings]);

  const orderedCategories = useMemo(() => {
    const extra = Object.keys(grouped).filter(
      (key) => !CATEGORY_ORDER.includes(key)
    );

    return [...CATEGORY_ORDER, ...extra].filter(
      (key) => key === 'system' || grouped[key]?.length
    );
  }, [grouped]);

  const activeSettings = grouped[activeSection] || [];
  const activeMeta = CATEGORY_META[activeSection] || {
    title: activeSection,
    description: 'Configuration values.',
    icon: SettingsIcon,
  };

  const ActiveIcon = activeMeta.icon;

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div className="settings-heading">
          <div className="settings-heading-icon">
            <SettingsIcon size={25} />
          </div>

          <div>
            <p className="settings-eyebrow">ADMINISTRATION</p>
            <h1>System Settings</h1>
            <p className="settings-subtitle">
              University-wide configuration and scheduling defaults.
            </p>
          </div>
        </div>

        <div className="settings-header-actions">
          <button
            className="settings-reset-button"
            onClick={resetDraft}
            type="button"
            disabled={loading || saving || changedKeys.length === 0}
          >
            <RotateCcw size={16} />
            Discard changes
          </button>

          {isAdmin && (
            <button
              className="settings-save-button"
              onClick={saveChanges}
              type="button"
              disabled={loading || saving || changedKeys.length === 0}
            >
              {saving ? (
                <LoaderCircle className="settings-spinner" size={16} />
              ) : (
                <Save size={16} />
              )}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </header>

      {!isAdmin && (
        <section className="settings-notice" role="status">
          <ShieldCheck size={21} />
          <div>
            <strong>Read-only view</strong>
            <p>
              System settings can only be changed by an administrator.
            </p>
          </div>
        </section>
      )}

      {isAdmin && changedKeys.length > 0 && (
        <section
          className="settings-notice settings-notice-warning"
          role="status"
        >
          <Info size={21} />
          <div>
            <strong>
              {changedKeys.length} unsaved{' '}
              {changedKeys.length === 1 ? 'change' : 'changes'}
            </strong>
            <p>Save your changes to persist them to the database.</p>
          </div>
        </section>
      )}

      {error && (
        <p className="settings-feedback settings-feedback-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </p>
      )}

      {notice && (
        <p className="settings-feedback settings-feedback-success" role="status">
          <CheckCircle2 size={16} />
          {notice}
        </p>
      )}

      <div className="settings-layout">
        <aside className="settings-sidebar" aria-label="Settings sections">
          <p className="settings-sidebar-label">CONFIGURATION</p>

          <button
            type="button"
            className={`settings-nav-item ${
              activeSection === 'overview' ? 'active' : ''
            }`}
            onClick={() => setActiveSection('overview')}
          >
            <SettingsIcon size={18} />
            Overview
          </button>

          {orderedCategories.map((category) => {
            const meta = CATEGORY_META[category] || {
              title: category,
              icon: SettingsIcon,
            };
            const Icon = meta.icon;

            return (
              <button
                type="button"
                key={category}
                className={`settings-nav-item ${
                  activeSection === category ? 'active' : ''
                }`}
                onClick={() => setActiveSection(category)}
              >
                <Icon size={18} />
                {meta.title}
              </button>
            );
          })}
        </aside>

        <section className="settings-content">
          {loading ? (
            <div className="settings-state">
              <LoaderCircle
                className="settings-spinner settings-state-spinner"
                size={30}
              />
              <h3>Loading settings</h3>
              <p>Retrieving configuration from the database…</p>
            </div>
          ) : settings.length === 0 ? (
            <div className="settings-state">
              <Info size={30} />
              <h3>No settings available</h3>
              <p>
                {error
                  ? 'The settings catalogue could not be loaded.'
                  : 'The settings catalogue is empty.'}
              </p>
              <button
                type="button"
                className="settings-reset-button"
                onClick={loadSettings}
              >
                <RotateCcw size={16} />
                Try again
              </button>
            </div>
          ) : activeSection === 'overview' ? (
            <>
              <div className="settings-section-heading">
                <div>
                  <h2>Configuration overview</h2>
                  <p>
                    {settings.length} settings across{' '}
                    {orderedCategories.filter((key) => key !== 'system').length}{' '}
                    categories.
                  </p>
                </div>
                <span className="settings-status">Live</span>
              </div>

              <div className="settings-cards">
                {orderedCategories.map((category) => {
                  const meta = CATEGORY_META[category] || {
                    title: category,
                    description: '',
                    icon: SettingsIcon,
                  };
                  const Icon = meta.icon;
                  const items = grouped[category] || [];

                  return (
                    <article className="settings-card" key={category}>
                      <div className="settings-card-top">
                        <span className="settings-card-icon">
                          <Icon size={21} />
                        </span>
                        <span className="settings-planned-badge">
                          {category === 'system'
                            ? 'ADMIN ONLY'
                            : `${items.length} ${
                                items.length === 1 ? 'setting' : 'settings'
                              }`}
                        </span>
                      </div>

                      <h3>{meta.title}</h3>
                      <p>{meta.description}</p>

                      {category !== 'system' && (
                        <ul>
                          {items.slice(0, 3).map((item) => (
                            <li key={item.key}>{item.label}</li>
                          ))}
                          {items.length > 3 && (
                            <li>…and {items.length - 3} more</li>
                          )}
                        </ul>
                      )}

                      <button
                        type="button"
                        className="settings-view-button"
                        onClick={() => setActiveSection(category)}
                      >
                        {category === 'system'
                          ? 'Open reset panel'
                          : 'Configure'}
                        <span aria-hidden="true">→</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          ) : activeSection === 'system' ? (
            <div className="settings-detail">
              <div className="settings-detail-icon">
                <RotateCcw size={25} />
              </div>

              <span className="settings-planned-badge">ADMIN ONLY</span>
              <h2>System Reset</h2>
              <p>
                Load the operational-data preview, review the affected records,
                and complete the confirmation steps if you are authorized.
              </p>

              <div
                className="settings-card settings-danger-card"
                style={{ marginTop: '16px' }}
              >
                <h3>Approved scope to clear</h3>
                <ul>
                  {RESET_TABLES.map((table) => (
                    <li key={table}>{table}</li>
                  ))}
                </ul>

                <p>
                  <strong>Preserved:</strong> users, roles, students,
                  instructors, invigilator profiles and availability, courses,
                  sections, enrollments, departments, programs, buildings,
                  rooms and capacities, academic years, semesters, academic
                  calendar, exam periods, time slots, scheduling constraints,
                  prerequisites, system settings, notifications, and existing
                  audit logs.
                </p>
              </div>

              {resetError && (
                <p
                  className="settings-feedback settings-feedback-error"
                  role="alert"
                >
                  <AlertCircle size={16} />
                  {resetError}
                </p>
              )}

              {resetNotice && (
                <p
                  className="settings-feedback settings-feedback-success"
                  role="status"
                >
                  <CheckCircle2 size={16} />
                  {resetNotice}
                </p>
              )}

              {isAdmin ? (
                <>
                  <button
                    type="button"
                    className="settings-reset-button"
                    onClick={loadResetPreview}
                    disabled={resetLoading || resetExecuting}
                  >
                    {resetLoading ? (
                      <LoaderCircle
                        className="settings-spinner"
                        size={16}
                      />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                    {resetLoading ? 'Loading preview…' : 'Refresh preview'}
                  </button>

                  {resetPreview && (
                    <div className="settings-reset-counts">
                      <h3>Current record counts</h3>
                      {RESET_TABLES.map((table) => (
                        <div className="settings-reset-count" key={table}>
                          <span className="settings-reset-count-label">
                            {table}
                          </span>
                          <span className="settings-reset-count-value">
                            {resetPreview[table] ?? '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!resetArmed ? (
                    <button
                      type="button"
                      className="settings-button-danger"
                      style={{
                        marginTop: '12px',
                        padding: '10px 16px',
                        borderRadius: '6px',
                        cursor:
                          resetLoading || resetExecuting || !resetPreview
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                      onClick={handlePrepareReset}
                      disabled={
                        !isAdmin || resetLoading || resetExecuting || !resetPreview
                      }
                      title={
                        !resetPreview
                          ? 'Load the reset preview first'
                          : 'Open the final confirmation step'
                      }
                    >
                      Review and confirm reset
                    </button>
                  ) : (
                    <div
                      className="settings-reset-final-confirmation"
                      style={{
                        marginTop: '16px',
                        padding: '16px',
                        border: '1px solid #dc2626',
                        borderRadius: '8px',
                      }}
                    >
                      <h3>Final confirmation</h3>
                      <p>
                        This action permanently deletes operational scheduling
                        records from all five approved tables. It must not
                        delete preserved records or existing audit logs.
                      </p>

                      <label
                        htmlFor="reset-confirmation"
                        className="settings-field-label"
                        style={{ display: 'block', marginTop: '12px' }}
                      >
                        Type {RESET_CONFIRMATION} to enable the final action
                      </label>

                      <input
                        id="reset-confirmation"
                        className="settings-input"
                        type="text"
                        value={resetConfirmation}
                        onChange={(event) => {
                          setResetConfirmation(event.target.value);
                          setResetError('');
                          setResetNotice('');
                        }}
                        placeholder={RESET_CONFIRMATION}
                        autoComplete="off"
                        disabled={resetExecuting}
                      />

                      <p className="settings-field-hint">
                        Confirm that you have reviewed the counts and have a
                        recoverable database backup. Opening this panel does
                        not delete any records.
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          flexWrap: 'wrap',
                          marginTop: '12px',
                        }}
                      >
                        <button
                          type="button"
                          className="settings-back-button"
                          onClick={handleCancelReset}
                          disabled={resetExecuting}
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          className="settings-button-danger"
                          style={{
                            padding: '10px 16px',
                            borderRadius: '6px',
                            cursor:
                              resetExecuting ||
                              resetConfirmation.trim() !== RESET_CONFIRMATION
                                ? 'not-allowed'
                                : 'pointer',
                          }}
                          onClick={handleSystemReset}
                          disabled={
                            !isAdmin ||
                            resetLoading ||
                            resetExecuting ||
                            resetConfirmation.trim() !== RESET_CONFIRMATION
                          }
                        >
                          {resetExecuting ? (
                            <>
                              <LoaderCircle
                                className="settings-spinner"
                                size={16}
                              />
                              Resetting…
                            </>
                          ) : (
                            'Confirm and reset operational data'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p>Only administrators can access this panel.</p>
              )}

              <button
                type="button"
                className="settings-back-button"
                onClick={() => setActiveSection('overview')}
                style={{ marginTop: '16px' }}
              >
                ← Back to overview
              </button>
            </div>
          ) : (
            <div className="settings-detail">
              <div className="settings-detail-icon">
                <ActiveIcon size={25} />
              </div>

              <span className="settings-planned-badge">
                {activeSettings.length}{' '}
                {activeSettings.length === 1 ? 'setting' : 'settings'}
              </span>

              <h2>{activeMeta.title}</h2>
              <p>{activeMeta.description}</p>

              <h3>Configuration</h3>

              <ul className="settings-detail-list">
                {activeSettings.map((setting) => (
                  <li key={setting.key}>
                    <div className="settings-field">
                      <span className="settings-field-label">
                        {setting.label}
                      </span>
                      {setting.description && (
                        <small className="settings-field-hint">
                          {setting.description}
                        </small>
                      )}
                      <small className="settings-field-key">
                        {setting.key}
                      </small>
                    </div>

                    <div className="settings-field-control">
                      {renderControl(setting)}
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="settings-back-button"
                onClick={() => setActiveSection('overview')}
              >
                ← Back to overview
              </button>
            </div>
          )}
        </section>
      </div>

      <footer className="settings-footer">
        <span>Exam Scheduler</span>
        <span>
          {isAdmin
            ? 'Administrator access · changes are audited'
            : 'Read-only · contact an administrator to change settings'}
        </span>
      </footer>
    </main>
  );
}
