import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

/**
 * Sidebar navigation.
 *
 * Only the Dashboard route exists in Phase 4. The remaining items are shown
 * as explicitly DISABLED (with a "Soon" tag) so nothing looks clickable while
 * leading nowhere — they become real links as their phases land.
 */
const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Academic',
    items: [
      { label: 'Departments & Programs', icon: Building2 },
      { label: 'Courses & Sections', icon: BookOpen },
      { label: 'Students & Enrollments', icon: GraduationCap },
      { label: 'Instructors & Duties', icon: Users },
    ],
  },
  {
    label: 'Facilities',
    items: [
      { label: 'Buildings & Rooms', icon: DoorOpen },
      { label: 'Time Slots & Periods', icon: CalendarClock },
    ],
  },
  {
    label: 'Scheduling',
    items: [
      { label: 'Schedule Calendar', icon: CalendarDays },
      { label: 'Conflicts', icon: AlertTriangle },
      { label: 'Invigilation', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Notifications', icon: Bell },
      { label: 'Reports & Analytics', icon: BarChart3 },
      { label: 'Users & Roles', icon: ShieldCheck },
      { label: 'System Settings', icon: Settings },
    ],
  },
];

export default function Sidebar({ open = false }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">
          <GraduationCap size={22} />
        </span>
        <span className="sidebar-brand-text">
          <span className="sidebar-brand-name">Exam Scheduler</span>
          <span className="sidebar-brand-sub">University Administration</span>
        </span>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            <div className="sidebar-nav">
              {section.items.map((item) => {
                const Icon = item.icon;

                if (item.disabled || !item.to) {
                  return (
                    <span
                      key={item.label}
                      className="nav-item is-disabled"
                      title="This module is added in a later phase"
                      aria-disabled="true"
                    >
                      <Icon size={18} />
                      <span className="nav-item-label">{item.label}</span>
                      <span className="nav-item-tag">Soon</span>
                    </span>
                  );
                }

                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} />
                    <span className="nav-item-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div>Version 1.0.0</div>
        <div style={{ opacity: 0.7 }}>Phase 4 · foundation</div>
      </div>
    </aside>
  );
}
