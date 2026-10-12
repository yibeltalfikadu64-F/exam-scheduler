import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * Route guard for authenticated areas.
 * Backend authorization is the real check; this only improves UX.
 */
export default function PrivateRoute({ children }) {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();

  // Wait while a persisted session is validated so a refresh does not bounce
  // the user to the login page before restoration finishes.
  if (!isReady) {
    return <LoadingSpinner label="Restoring your session…" size="lg" />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
