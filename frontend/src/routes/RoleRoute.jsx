import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Role-based route guard. Must be nested inside PrivateRoute.
 * Example: <RoleRoute roles={['admin', 'registrar']}><Settings /></RoleRoute>
 */
export default function RoleRoute({ roles = [], children }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (roles.length > 0 && !roles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
