import { useState } from 'react';
import {
  Settings as SettingsIcon,
  CalendarDays,
  Clock3,
  Bell,
  Palette,
  ShieldCheck,
  Info,
  RotateCcw,
} from 'lucide-react';
import '../styles/settings.css';

const plannedSettings = [
  {
    id: 'academic',
    icon: CalendarDays,
    title: 'Academic year and term',
    description: 'Configure the academic year, semester, and examination period.',
    items: ['Academic year', 'Semester or term', 'Examination period'],
  },
  {
    id: 'scheduling',
    icon: Clock3,
    title: 'Default scheduling constraints',
    description: 'Define the default rules used when generating examination schedules.',
    items: ['Exam duration defaults', 'Student rest intervals', 'Daily examination limits'],
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notification defaults',
    description: 'Plan default delivery methods and notification preferences.',
    items: ['Email notifications', 'SMS notifications', 'Schedule change alerts'],
  },
  {
    id: 'branding',
    icon: Palette,
    title: 'Institution branding',
    description: 'Plan university identity, appearance, and theme preferences.',
    items: ['University name and logo', 'Default theme', 'Institutional colors'],
  },
  {
    id: 'permissions',
    icon: ShieldCheck,
    title: 'Role permissions overview',
    description: 'Review the intended access levels for each system role.',
    items: ['Administrator', 'Registrar', 'Department head', 'Instructor', 'Student'],
  },
];

const roles = [
  ['Administrator', 'System-wide administration'],
  ['Registrar', 'Academic records and examination coordination'],
  ['Department head', 'Department-level academic coordination'],
  ['Instructor', 'Assigned teaching and invigilation information'],
  ['Student', 'Personal examination schedule information'],
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('overview');
  const [themePreview, setThemePreview] = useState('light');
  const [notice, setNotice] = useState('');

  function selectSection(section) {
    setActiveSection(section);
    setNotice('');
  }

  function resetPreview() {
    setThemePreview('light');
    setActiveSection('overview');
    setNotice('Local preview has been reset. No system settings were changed.');
  }

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

        <button className="settings-reset-button" onClick={resetPreview} type="button">
          <RotateCcw size={16} />
          Reset preview
        </button>
      </header>

      <section className="settings-notice" role="status">
        <Info size={21} />
        <div>
          <strong>Preview mode — settings are not saved</strong>
          <p>
            This page is a frontend-only prototype. It does not connect to the
            backend or database. Configuration changes will be implemented in a
            later phase.
          </p>
        </div>
      </section>

      {notice && (
        <p className="settings-feedback" role="status">
          {notice}
        </p>
      )}

      <div className="settings-layout">
        <aside className="settings-sidebar" aria-label="Settings sections">
          <p className="settings-sidebar-label">CONFIGURATION</p>

          <button
            type="button"
            className={`settings-nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => selectSection('overview')}
          >
            <SettingsIcon size={18} />
            Overview
          </button>

          {plannedSettings.map(({ id, icon: Icon, title }) => (
            <button
              type="button"
              key={id}
              className={`settings-nav-item ${activeSection === id ? 'active' : ''}`}
              onClick={() => selectSection(id)}
            >
              <Icon size={18} />
              {title}
            </button>
          ))}
        </aside>

        <section className="settings-content">
          {activeSection === 'overview' ? (
            <>
              <div className="settings-section-heading">
                <div>
                  <h2>Configuration overview</h2>
                  <p>Review the settings planned for a future implementation phase.</p>
                </div>
                <span className="settings-status">Not implemented</span>
              </div>

              <div className="settings-cards">
                {plannedSettings.map(({ id, icon: Icon, title, description, items }) => (
                  <article className="settings-card" key={id}>
                    <div className="settings-card-top">
                      <span className="settings-card-icon">
                        <Icon size={21} />
                      </span>
                      <span className="settings-planned-badge">Planned</span>
                    </div>

                    <h3>{title}</h3>
                    <p>{description}</p>

                    <ul>
                      {items.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className="settings-view-button"
                      onClick={() => selectSection(id)}
                    >
                      View overview
                      <span aria-hidden="true">→</span>
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            (() => {
              const section = plannedSettings.find((item) => item.id === activeSection);
              if (!section) return null;
              const Icon = section.icon;

              return (
                <div className="settings-detail">
                  <div className="settings-detail-icon">
                    <Icon size={25} />
                  </div>
                  <span className="settings-planned-badge">Planned functionality</span>
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>

                  <h3>Planned configuration items</h3>
                  <ul className="settings-detail-list">
                    {section.items.map((item) => (
                      <li key={item}>
                        <span>{item}</span>
                        <span className="settings-item-status">Not available yet</span>
                      </li>
                    ))}
                  </ul>

                  {section.id === 'branding' && (
                    <div className={`settings-theme-preview ${themePreview}`}>
                      <div>
                        <strong>Theme preview</strong>
                        <p>This preview changes locally only.</p>
                      </div>
                      <div className="settings-theme-controls">
                        <button
                          type="button"
                          className={themePreview === 'light' ? 'selected' : ''}
                          onClick={() => setThemePreview('light')}
                        >
                          Light
                        </button>
                        <button
                          type="button"
                          className={themePreview === 'dark' ? 'selected' : ''}
                          onClick={() => setThemePreview('dark')}
                        >
                          Dark
                        </button>
                      </div>
                    </div>
                  )}

                  {section.id === 'permissions' && (
                    <div className="settings-role-list">
                      <h3>Intended role overview</h3>
                      {roles.map(([role, description]) => (
                        <div className="settings-role-row" key={role}>
                          <strong>{role}</strong>
                          <span>{description}</span>
                        </div>
                      ))}
                      <p className="settings-role-disclaimer">
                        This is an informational preview, not an enforced permissions list.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    className="settings-back-button"
                    onClick={() => selectSection('overview')}
                  >
                    ← Back to overview
                  </button>
                </div>
              );
            })()
          )}
        </section>
      </div>

      <footer className="settings-footer">
        <span>Exam Scheduler</span>
        <span>System configuration · Future phase</span>
      </footer>
    </main>
  );
}
