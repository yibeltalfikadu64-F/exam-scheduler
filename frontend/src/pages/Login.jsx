import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, ArrowRight, BarChart3, CalendarClock, GraduationCap, Lock, ShieldCheck, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const schema = z.object({
  username: z.string().min(3, 'Enter your username (at least 3 characters)'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  remember: z.boolean().optional(),
});

const WARNING_KINDS = new Set(['rate-limited', 'forbidden']);

/**
 * Login page.
 *
 * Submits to the real POST /auth/login endpoint and surfaces every outcome
 * honestly: loading, invalid credentials, inactive account, network failure and
 * server error. It never reports success when the API fails.
 */
export default function Login() {
  const { login, isLoading, isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);

  const redirectTo = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '', remember: true },
  });

  const onSubmit = async (values) => {
    setError(null);
    const result = await login({
      username: values.username,
      password: values.password,
      persist: Boolean(values.remember),
    });
    if (result.ok) {
      navigate(redirectTo, { replace: true });
    } else {
      setError({ kind: result.kind, message: result.message });
    }
  };

  // Already signed in (e.g. navigating back to /login) — send them through.
  if (isReady && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-hero-badge">
          <ShieldCheck size={14} /> University Exam Scheduling System
        </div>

        <div>
          <h1>Plan, generate and publish exam schedules with confidence.</h1>
          <p>
            A constraint-based scheduling platform for departments, rooms, time slots and invigilation —
            built for real institutional workloads.
          </p>
          <ul className="login-hero-list">
            <li>
              <CalendarClock size={16} /> Conflict-free timetabling across cohorts and rooms
            </li>
            <li>
              <ShieldCheck size={16} /> Role-based access for registrars, heads and instructors
            </li>
            <li>
              <BarChart3 size={16} /> Reports on room utilization and invigilation load
            </li>
          </ul>
        </div>

        <div className="text-xs" style={{ color: '#93a4bf' }}>
          © {new Date().getFullYear()} Exam Scheduler
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="brand">
            <span className="sidebar-brand-mark" aria-hidden="true">
              <GraduationCap size={22} />
            </span>
            <div className="stack">
              <strong style={{ fontSize: 'var(--fs-lg)' }}>Welcome back</strong>
              <span className="text-sm text-muted">Sign in to the administration console</span>
            </div>
          </div>

          {error ? (
            <div
              className={`notice ${WARNING_KINDS.has(error.kind) ? 'notice-warning' : 'notice-danger'}`}
              role="alert"
            >
              <AlertCircle size={16} />
              <span>{error.message}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="username">
                Username or email
              </label>
              <div className="search-box" style={{ width: '100%' }}>
                <User size={16} />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. admin"
                  aria-invalid={errors.username ? 'true' : 'false'}
                  style={{ width: '100%' }}
                  {...register('username')}
                />
              </div>
              {errors.username ? <span className="field-error">{errors.username.message}</span> : null}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <div className="search-box" style={{ width: '100%' }}>
                <Lock size={16} />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  style={{ width: '100%' }}
                  {...register('password')}
                />
              </div>
              {errors.password ? <span className="field-error">{errors.password.message}</span> : null}
            </div>

            <div className="login-form-footer">
              <label className="checkbox-row">
                <input type="checkbox" {...register('remember')} /> Remember me
              </label>
              <span
                className="text-sm text-muted"
                title="Password reset will be available in a later phase"
              >
                Forgot password? (coming later)
              </span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
            </button>
          </form>

          <details className="text-xs text-muted" style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer' }}>Development seed accounts</summary>
            <p style={{ marginTop: 8 }}>
              Local development only — change these before any real deployment.
            </p>
            <ul style={{ marginTop: 4, paddingLeft: 18 }}>
              <li>
                <code>admin</code> / <code>Admin@12345</code> — administrator
              </li>
              <li>
                <code>registrar</code>, <code>head_cs</code>, <code>instructor1</code>, <code>instructor2</code>,{' '}
                <code>student1</code> / <code>Demo@12345</code>
              </li>
            </ul>
          </details>

          <div className="text-xs text-muted" style={{ textAlign: 'center' }}>
            Back to <Link to="/">dashboard</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
