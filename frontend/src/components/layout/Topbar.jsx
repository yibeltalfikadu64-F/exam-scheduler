import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { toggleCollapsed, toggleSidebar } from '../../store/slices/uiSlice';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', subtitle: 'Exam schedule overview' },
  '/departments': { title: 'Departments & Programs', subtitle: 'Faculties, departments and programs' },
  '/courses': { title: 'Courses & Sections', subtitle: 'Course catalogue and sections' },
  '/students': { title: 'Students & Enrollments', subtitle: 'Student records and enrolments' },
  '/instructors': { title: 'Instructors & Duties', subtitle: 'Teaching staff and invigilation' },
  '/rooms': { title: 'Buildings & Rooms', subtitle: 'Facilities and capacity' },
  '/time-slots': { title: 'Time Slots & Periods', subtitle: 'Exam periods and daily sessions' },
  '/schedule': { title: 'Schedule Calendar', subtitle: 'Exam timetable' },
  '/conflicts': { title: 'Conflicts', subtitle: 'Constraint violations' },
  '/invigilation': { title: 'Invigilation', subtitle: 'Duty assignment and rosters' },
  '/notifications': { title: 'Notifications', subtitle: 'Alerts and preferences' },
  '/reports': { title: 'Reports & Analytics', subtitle: 'Insights and exports' },
  '/users': { title: 'Users & Roles', subtitle: 'Accounts and permissions' },
  '/settings': { title: 'System Settings', subtitle: 'Configuration and defaults' },
  '/admin': { title: 'Administration', subtitle: 'Restricted area' },
};

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function Topbar() {
  const dispatch = useDispatch();
  const { sidebarCollapsed } = useSelector((state) => state.ui);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const heading = PAGE_TITLES[location.pathname] || { title: 'Exam Scheduler', subtitle: 'University administration' };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="topbar">
      <button
        type="button"
        className="btn btn-icon sidebar-toggle"
        onClick={() => dispatch(toggleSidebar())}
        aria-label="Open navigation"
        title="Open navigation"
      >
        <Menu size={18} />
      </button>

      <button
        type="button"
        className="btn btn-icon sidebar-toggle-desktop"
        onClick={() => dispatch(toggleCollapsed())}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{ display: 'inline-flex' }}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      <div className="topbar-title">
        <h1>{heading.title}</h1>
        <span>{heading.subtitle}</span>
      </div>

      <div className="topbar-spacer" />

      <div className="topbar-actions">
        <div className="search-box">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search (coming soon)"
            aria-label="Search"
            disabled
            title="Global search is added in a later phase"
          />
        </div>

        <button
          type="button"
          className="btn btn-icon"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          type="button"
          className="btn btn-icon"
          disabled
          aria-label="Notifications (coming soon)"
          title="Notifications are added in a later phase"
        >
          <Bell size={18} />
        </button>

        <div className="user-chip">
          <span className="user-avatar" aria-hidden="true">
            {initials(user?.fullName || user?.username || 'User')}
          </span>
          <span className="user-meta">
            <strong>{user?.fullName || user?.username || 'Guest'}</strong>
            <span>{user?.role || 'guest'}</span>
          </span>
        </div>

        <button
          type="button"
          className="btn btn-icon"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
