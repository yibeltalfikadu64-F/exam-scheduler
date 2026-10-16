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
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import '../styles/settings.css';

/**
 * System Settings (Phase 7).
 *
 * Reads the real `system_settings` catalogue from the backend and persists
 * administrator edits. Only administrators may save; everyone else sees the
 * current values read-only. No values are invented on the client.
 */

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
};

const CATEGORY_ORDER = ['branding', 'academic', 'scheduling', 'notifications'];

// Settings whose value is a reference id rendered as a dropdown.
const REFERENCE_OPTIONS = {
  'academic.default_academic_year_id': { source: 'academicYear', label: 'academic year' },
  'academic.default_semester_id': { source: 'semester', label: 'semester' },
  'academic.default_exam_period_id': { source: 'examPeriod', label: 'exam period' },
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
  return error?.message || 'The request failed. Please try again.';
}

/** Convert a stored (coerced) value into the UI draft representation. */
function toDraft(setting, value) {
  if (setting.valueType === 'boolean') return Boolean(value);
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Convert a UI draft value into the payload value for the API. */
function toPayload(setting, draftValue) {
  if (setting.valueType === 'boolean') return Boolean(draftValue);
  if (setting.valueType === 'number') {
    if (draftValue === '' || draftValue === null || draftValue === undefined) return null;
    return Number(draftValue);
  }
  if (setting.valueType === 'json') return draftValue;
  return draftValue;
}

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState([]);
  const [categories, setCategories] = useState({});
  const [draft, setDraft] = useState({});
  const [activeSection, setActiveSection] = useState('overview');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [references, setReferences] = useState({ academicYear: [], semester: [], examPeriod: [] });

  const applyCatalogue = useCallback((data) => {
    const list = Array.isArray(data?.settings) ? data.settings : [];
    const grouped = data?.categories && typeof data.categories === 'object' ? data.categories : {};

    setSettings(list);
    setCategories(grouped);
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
      setCategories({});
    } finally {
      setLoading(false);
    }
  }, [applyCatalogue]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Reference data for the academic default dropdowns. Failures are non-fatal:
  // the field simply falls back to a free number input.
  useEffect(() => {
    let active = true;

    (async () => {
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
              const response = await api.get(`/academic-years/${year.id}/semesters`);
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
                academicYearName: year.name || year.code || `Year ${year.id}`,
              }));
            } catch (semesterError) {
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
            label: `${semester.name || semester.semester_name || `Semester ${semester.id}`}${
              semester.academicYearName ? ` — ${semester.academicYearName}` : ''
            }`,
          })),
          examPeriod: periods.map((period) => ({
            id: period.id,
            label: period.name
              ? `${period.name}${period.term ? ` (${period.term})` : ''}`
              : `Exam period ${period.id}`,
          })),
        });
      } catch (optionsError) {
        // Non-fatal: dropdowns are a convenience over the raw id value.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const changedKeys = useMemo(
    () =>
      settings
        .filter((setting) => {
          const next = toPayload(setting, draft[setting.key]);
          const current = setting.value === null || setting.value === undefined ? null : setting.value;
          if (setting.valueType === 'number') {
            const a = next === null ? null : Number(next);
            const b = current === null ? null : Number(current);
            return a !== b;
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
            onChange={(event) => updateValue(setting.key, event.target.checked)}
          />
          <span className="settings-toggle-track" aria-hidden="true" />
          <span className="settings-toggle-text">{value ? 'Enabled' : 'Disabled'}</span>
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

    if (reference && referenceItems && referenceItems.length > 0) {
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
    const extra = Object.keys(grouped).filter((key) => !CATEGORY_ORDER.includes(key));
    return [...CATEGORY_ORDER, ...extra].filter((key) => grouped[key]?.length);
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
              {saving ? <LoaderCircle className="settings-spinner" size={16} /> : <Save size={16} />}
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
              System settings can only be changed by an administrator. The values
              shown below are loaded live from the database.
            </p>
          </div>
        </section>
      )}

      {isAdmin && changedKeys.length > 0 && (
        <section className="settings-notice settings-notice-warning" role="status">
          <Info size={21} />
          <div>
            <strong>
              {changedKeys.length} unsaved {changedKeys.length === 1 ? 'change' : 'changes'}
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
            className={`settings-nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            <SettingsIcon size={18} />
            Overview
          </button>

          {orderedCategories.map((category) => {
            const meta = CATEGORY_META[category] || { title: category, icon: SettingsIcon };
            const Icon = meta.icon;
            return (
              <button
                type="button"
                key={category}
                className={`settings-nav-item ${activeSection === category ? 'active' : ''}`}
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
              <LoaderCircle className="settings-spinner settings-state-spinner" size={30} />
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
              <button type="button" className="settings-reset-button" onClick={loadSettings}>
                <RotateCcw size={16} />
                Try again
              </button>
            </div>
          ) : activeSection === 'overview' ? (
            <>
              <div className="settings-section-heading">
                <div>
                  <h2>Configuration overview</h2>
                  <p>{settings.length} settings across {orderedCategories.length} categories.</p>
                </div>
                <span className="settings-status">Live</span>
              </div>

              <div className="settings-cards">
                {orderedCategories.map((category) => {
                  const meta = CATEGORY_META[category] || { title: category, description: '', icon: SettingsIcon };
                  const Icon = meta.icon;
                  const items = grouped[category];
                  return (
                    <article className="settings-card" key={category}>
                      <div className="settings-card-top">
                        <span className="settings-card-icon">
                          <Icon size={21} />
                        </span>
                        <span className="settings-planned-badge">
                          {items.length} {items.length === 1 ? 'setting' : 'settings'}
                        </span>
                      </div>

                      <h3>{meta.title}</h3>
                      <p>{meta.description}</p>

                      <ul>
                        {items.slice(0, 3).map((item) => (
                          <li key={item.key}>{item.label}</li>
                        ))}
                        {items.length > 3 && <li>…and {items.length - 3} more</li>}
                      </ul>

                      <button
                        type="button"
                        className="settings-view-button"
                        onClick={() => setActiveSection(category)}
                      >
                        Configure
                        <span aria-hidden="true">→</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="settings-detail">
              <div className="settings-detail-icon">
                <ActiveIcon size={25} />
              </div>
              <span className="settings-planned-badge">
                {activeSettings.length} {activeSettings.length === 1 ? 'setting' : 'settings'}
              </span>
              <h2>{activeMeta.title}</h2>
              <p>{activeMeta.description}</p>

              <h3>Configuration</h3>
              <ul className="settings-detail-list">
                {activeSettings.map((setting) => (
                  <li key={setting.key}>
                    <div className="settings-field">
                      <span className="settings-field-label">{setting.label}</span>
                      {setting.description && (
                        <small className="settings-field-hint">{setting.description}</small>
                      )}
                      <small className="settings-field-key">{setting.key}</small>
                    </div>
                    <div className="settings-field-control">{renderControl(setting)}</div>
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
