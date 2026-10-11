import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="notfound">
      <div className="code">404</div>
      <h2>Page not found</h2>
      <p className="text-muted">The page you are looking for does not exist or has moved.</p>
      <Link className="btn btn-primary" to="/">
        <Home size={16} /> Back to dashboard
      </Link>
    </div>
  );
}
