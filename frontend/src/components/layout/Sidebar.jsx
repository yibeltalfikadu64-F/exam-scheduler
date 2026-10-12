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

import { useAuth } from '../../context/AuthContext';

/**
 * Sidebar navigation.
 *
 * Every entry links to a registered route. Implemented modules (Dashboard,
 * Users & Roles) render real pages; the remaining modules route to clear
 * placeholder pages until their phases land. `roles` still restricts an item
 * to specific account roles, mirroring the server-side authorization.
 */
const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Academic',
    items: [
      { label: 'Departments & Programs', to: '/departments', icon: Building2 },
      { label: 'Courses & Sections', to: '/courses', icon: BookOpen },
      { label: 'Students & Enrollments', to: '/students', icon: GraduationCap },
      { label: 'Instructors & Duties', to: '/instructors', icon: Users },
    ],
  },
  {
    label: 'Facilities',
    items: [
      { label: 'Buildings & Rooms', to: '/rooms', icon: DoorOpen },
      { label: 'Time Slots & Periods', to: '/time-slots', icon: CalendarClock },
    ],
  },
  {
    label: 'Scheduling',
    items: [
      { label: 'Schedule Calendar', to: '/schedule', icon: CalendarDays },
      { label: 'Conflicts', to: '/conflicts', icon: AlertTriangle },
      { label: 'Invigilation', to: '/invigilation', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Notifications', to: '/notifications', icon: Bell },
      { label: 'Reports & Analytics', to: '/reports', icon: BarChart3 },
      { label: 'Users & Roles', to: '/users', icon: ShieldCheck, roles: ['admin'] },
      { label: 'System Settings', to: '/settings', icon: Settings },
    ],
  },
];

export default function Sidebar({ open = false }) {
  const { user } = useAuth();

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
              {section.items
                .filter((item) => !item.roles || item.roles.includes(user?.role))
                .map((item) => {
                  const Icon = item.icon;

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
        <div style={{ opacity: 0.7 }}>All modules navigable · CRUD in progress</div>
      </div>
    </aside>
  );
}
