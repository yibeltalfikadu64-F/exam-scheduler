import { Navigate, Route, Routes } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import PrivateRoute from './PrivateRoute';
import RoleRoute from './RoleRoute';
import Dashboard from '../pages/Dashboard';
import Departments from '../pages/Departments';
import Programs from '../pages/Programs';
import Courses from '../pages/Courses';
import Students from '../pages/Students';
import Instructors from '../pages/Instructors';
import Rooms from '../pages/Rooms';
import TimeSlots from '../pages/TimeSlots';
import Schedule from '../pages/Schedule';
import Conflicts from '../pages/Conflicts';
import Invigilation from '../pages/Invigilation';
import Notifications from '../pages/Notifications';
import ReportsAnalytics from '../pages/ReportsAnalytics';
import UsersPage from '../pages/Users';
import SystemSettings from '../pages/Settings';
import Login from '../pages/Login';
import NotFound from '../pages/NotFound';

/**
 * Central route table.
 *
 * Every sidebar entry resolves to a registered route. Dashboard and Users &
 * Roles render implemented pages; the remaining modules render honest
 * placeholder pages until their phases land. All authenticated routes sit
 * behind <PrivateRoute> + <DashboardLayout>; Users & Roles is additionally
 * admin-only through <RoleRoute> (the server enforces this too).
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />

        {/* Academic */}
        <Route path="/departments" element={<Departments />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/students" element={<Students />} />
        <Route path="/instructors" element={<Instructors />} />

        {/* Facilities */}
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/time-slots" element={<TimeSlots />} />

        {/* Scheduling */}
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/conflicts" element={<Conflicts />} />
        <Route path="/invigilation" element={<Invigilation />} />

        {/* Administration */}
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/reports" element={<ReportsAnalytics />} />

        {/* Users & Roles — admin only; server enforces it too. */}
        <Route
          path="/users"
          element={
            <RoleRoute roles={['admin']}>
              <UsersPage />
            </RoleRoute>
          }
        />
        <Route path="/settings" element={<SystemSettings />} />

        {/* Example of a role-guarded route, ready for Phase 6 onward. */}
        <Route
          path="/admin"
          element={
            <RoleRoute roles={['admin']}>
              <div className="page">
                <div className="panel">
                  <div className="panel-body-padded">
                    <h2>Administration</h2>
                    <p className="text-muted" style={{ marginTop: 8 }}>
                      This area is restricted to administrators. Feature modules arrive in Phase 6.
                    </p>
                  </div>
                </div>
              </div>
            </RoleRoute>
          }
        />
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
