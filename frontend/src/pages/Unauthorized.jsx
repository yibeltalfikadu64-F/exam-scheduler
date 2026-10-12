import { Link } from 'react-router-dom';
import { LayoutDashboard, ShieldAlert } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

/**
 * 403 page rendered by RoleRoute when the signed-in user's role is not allowed
 * to view a guarded route. Backend authorization is still the real check; this
 * gives the user a clear explanation instead of a silent redirect.
 */
export default function Unauthorized({ requiredRoles = [] }) {
  const { user } = useAuth();

  return (
    <div className="notfound">
      <div className="code">403</div>
      <h2>You do not have access to this area</h2>
      <p className="text-muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <ShieldAlert size={16} />
        Your account role <strong>{user?.role || 'guest'}</strong> is not permitted to view this page
        {requiredRoles.length > 0 ? <> (required: {requiredRoles.join(', ')})</> : null}.
      </p>
      <Link className="btn btn-primary" to="/">
        <LayoutDashboard size={16} /> Back to dashboard
      </Link>
    </div>
  );
}
