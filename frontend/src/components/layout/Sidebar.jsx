
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
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  WandSparkles,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

/**
 * Sidebar navigation.
 *
 * Every entry links to a registered route.
 * Role restrictions are applied to navigation items when required.
 */
const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        to: '/',
        icon: LayoutDashboard,
        end: true,
      },
    ],
  },

  {
    label: 'Academic',
    items: [
      {
        label: 'Departments',
        to: '/departments',
        icon: Building2,
      },
      {
        label: 'Programs',
        to: '/programs',
        icon: BookOpen,
      },
      {
        label: 'Courses',
        to: '/courses',
        icon: BookOpen,
      },
      {
        label: 'Sections',
        to: '/sections',
        icon: Layers,
      },
      {
        label: 'Exams',
        to: '/exams',
        icon: ClipboardList,
        roles: ['admin', 'registrar', 'department_head'],
      },
      {
        label: 'Students & Enrollments',
        to: '/students',
        icon: GraduationCap,
      },
      {
        label: 'Instructors & Duties',
        to: '/instructors',
        icon: Users,
      },
    ],
  },

  {
    label: 'Facilities',
    items: [
      {
        label: 'Buildings & Rooms',
        to: '/rooms',
        icon: DoorOpen,
      },
      {
        label: 'Time Slots & Periods',
        to: '/time-slots',
        icon: CalendarClock,
      },
    ],
  },

  {
    label: 'Scheduling',
    items: [
      {
        label: 'Generate Schedule',
        to: '/generate-schedule',
        icon: WandSparkles,
      },
      {
        label: 'Schedule Calendar',
        to: '/schedule',
        icon: CalendarDays,
      },
      {
        label: 'Conflicts',
        to: '/conflicts',
        icon: AlertTriangle,
      },
      {
        label: 'Invigilation',
        to: '/invigilation',
        icon: ClipboardCheck,
      },
    ],
  },

  {
    label: 'Administration',
    items: [
      {
        label: 'Notifications',
        to: '/notifications',
        icon: Bell,
      },
      {
        label: 'Reports & Analytics',
        to: '/reports',
        icon: BarChart3,
      },
      {
        label: 'Users & Roles',
        to: '/users',
        icon: ShieldCheck,
        roles: ['admin'],
      },
      {
        label: 'System Settings',
        to: '/settings',
        icon: Settings,
      },
    ],
  },
];

export default function Sidebar({ open = false }) {
  const { user } = useAuth();

  return (
    <aside
      className={`sidebar ${open ? 'open' : ''}`}
      aria-label="Main navigation"
    >
      {/* Sidebar brand */}
      <div className="sidebar-brand">
        <span
          className="sidebar-brand-mark"
          aria-hidden="true"
        >
          <GraduationCap size={22} />
        </span>

        <span className="sidebar-brand-text">
          <span className="sidebar-brand-name">
            Exam Scheduler
          </span>

          <span className="sidebar-brand-sub">
            University Administration
          </span>
        </span>
      </div>

      {/* Navigation sections */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            (item) =>
              !item.roles ||
              item.roles.includes(user?.role)
          );

          // Hide a section if the current user has no
          // navigation items available within it.
          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div key={section.label}>
              <div className="sidebar-section-label">
                {section.label}
              </div>

              <div className="sidebar-nav">
                {visibleItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `nav-item ${
                          isActive ? 'active' : ''
                        }`
                      }
                    >
                      <Icon size={18} />

                      <span className="nav-item-label">
                        {item.label}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Sidebar footer */}
      <div className="sidebar-footer">
        <div>Version 1.0.0</div>

        <div style={{ opacity: 0.7 }}>
          All modules navigable · live data
        </div>
      </div>
    </aside>
  );
}
