
import { Navigate, Route, Routes } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import PrivateRoute from './PrivateRoute';
import RoleRoute from './RoleRoute';

import Dashboard from '../pages/Dashboard';
import Departments from '../pages/Departments';
import DepartmentDetails from '../pages/DepartmentDetails';
import Programs from '../pages/Programs';
import Courses from '../pages/Courses';
import Sections from '../pages/Sections';
import Exams from '../pages/Exams';
import Students from '../pages/Students';
import Instructors from '../pages/Instructors';

import Rooms from '../pages/Rooms';
import TimeSlots from '../pages/TimeSlots';

import GenerateSchedule from '../pages/GenerateSchedule';
import Schedule from '../pages/Schedule';
import Conflicts from '../pages/Conflicts';
import Invigilation from '../pages/Invigilation';

import Notifications from '../pages/Notifications';
import ReportsAnalytics from '../pages/ReportsAnalytics';
import UsersPage from '../pages/Users';
import SystemSettings from '../pages/Settings';

import Login from '../pages/Login';
import NotFound from '../pages/NotFound';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected application routes */}
      <Route
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        {/* Dashboard */}
        <Route path="/" element={<Dashboard />} />

        {/* Academic management */}
        <Route
          path="/departments"
          element={<Departments />}
        />

        <Route
          path="/departments/:departmentId"
          element={<DepartmentDetails />}
        />

        <Route
          path="/programs"
          element={<Programs />}
        />

        <Route
          path="/courses"
          element={<Courses />}
        />

        <Route
          path="/sections"
          element={<Sections />}
        />

        <Route
          path="/exams"
          element={
            <RoleRoute
              roles={[
                'admin',
                'registrar',
                'department_head',
              ]}
            >
              <Exams />
            </RoleRoute>
          }
        />

        <Route
          path="/students"
          element={<Students />}
        />

        <Route
          path="/instructors"
          element={<Instructors />}
        />

        {/* Facilities management */}
        <Route
          path="/rooms"
          element={<Rooms />}
        />

        <Route
          path="/time-slots"
          element={<TimeSlots />}
        />

        {/* Examination scheduling */}
        <Route
          path="/generate-schedule"
          element={<GenerateSchedule />}
        />

        <Route
          path="/schedule"
          element={<Schedule />}
        />

        <Route
          path="/conflicts"
          element={<Conflicts />}
        />

        <Route
          path="/invigilation"
          element={<Invigilation />}
        />

        {/* Administration */}
        <Route
          path="/notifications"
          element={<Notifications />}
        />

        <Route
          path="/reports"
          element={<ReportsAnalytics />}
        />

        {/* User management — admin only */}
        <Route
          path="/users"
          element={
            <RoleRoute roles={['admin']}>
              <UsersPage />
            </RoleRoute>
          }
        />

        {/* System settings */}
        <Route
          path="/settings"
          element={<SystemSettings />}
        />

        {/* Administration — admin only */}
        <Route
          path="/admin"
          element={
            <RoleRoute roles={['admin']}>
              <div className="page">
                <div className="panel">
                  <div className="panel-body-padded">
                    <h2>Administration</h2>

                    <p
                      className="text-muted"
                      style={{ marginTop: 8 }}
                    >
                      This area is restricted to administrators.
                      Feature modules arrive in Phase 6.
                    </p>
                  </div>
                </div>
              </div>
            </RoleRoute>
          }
        />
      </Route>

      {/* Not found */}
      <Route
        path="/404"
        element={<NotFound />}
      />

      <Route
        path="*"
        element={<Navigate to="/404" replace />}
      />
    </Routes>
  );
}
