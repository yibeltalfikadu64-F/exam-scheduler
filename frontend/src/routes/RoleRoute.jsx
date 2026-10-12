import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Unauthorized from '../pages/Unauthorized';

/**
 * Role-based route guard. Must be nested inside PrivateRoute.
 * Example: <RoleRoute roles={['admin', 'registrar']}><Settings /></RoleRoute>
 *
 * When the user is signed in but lacks the required role, a clear 403 page is
 * shown rather than silently redirecting them away.
 */
export default function RoleRoute({ roles = [], children }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (roles.length > 0 && !roles.includes(user?.role)) {
    return <Unauthorized requiredRoles={roles} />;
  }
  return children;
}
