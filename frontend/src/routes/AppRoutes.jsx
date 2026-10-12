import { Navigate, Route, Routes } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import PrivateRoute from './PrivateRoute';
import RoleRoute from './RoleRoute';
import Dashboard from '../pages/Dashboard';
import UsersPage from '../pages/Users';
import Login from '../pages/Login';
import NotFound from '../pages/NotFound';

/**
 * Central route table.
 *
 * Feature routes (departments, courses, scheduling, ...) are added in later
 * phases. The guard components are already wired so those routes can be
 * protected consistently.
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

        {/* Phase 2 — user management (admin only; server enforces it too). */}
        <Route
          path="/users"
          element={
            <RoleRoute roles={['admin']}>
              <UsersPage />
            </RoleRoute>
          }
        />

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
