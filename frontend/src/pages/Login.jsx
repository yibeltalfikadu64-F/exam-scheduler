import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, BarChart3, CalendarClock, GraduationCap, Lock, ShieldCheck, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const schema = z.object({
  username: z.string().min(3, 'Enter your username (at least 3 characters)'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  remember: z.boolean().optional(),
});

/**
 * Login page.
 *
 * The form is fully validated client-side. Submitting performs a REAL call to
 * POST /auth/login — which currently returns 404 because authentication is
 * implemented in Phase 5. That is surfaced honestly rather than faked.
 */
export default function Login() {
  const { login, isLoading, isPrototype } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);

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
    setServerError(null);
    const result = await login({ username: values.username, password: values.password });
    if (result.ok) {
      navigate(redirectTo, { replace: true });
    } else {
      setServerError(result.message);
    }
  };

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

          <div className="notice notice-info">
            Authentication is enabled in Phase 5. The form below already validates input and calls the real
            API; because the endpoint does not exist yet it returns a clear message.
          </div>

          {serverError ? (
            <div className="notice notice-danger" role="alert">
              {serverError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="username">
                Username
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
                style={{ cursor: 'not-allowed' }}
                title="Password reset is added in Phase 5"
              >
                Forgot password?
              </span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
            </button>

            {isPrototype ? (
              <>
                <div className="divider">or</div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate('/', { replace: true })}
                >
                  Preview dashboard with prototype data
                </button>
              </>
            ) : null}
          </form>

          <div className="text-xs text-muted" style={{ textAlign: 'center' }}>
            Back to <Link to="/">dashboard</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
