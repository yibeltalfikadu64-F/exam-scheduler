import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { setCredentials, clearCredentials } from '../store/slices/authSlice';
import authService from '../services/authService';

/**
 * Authentication context backed by the real API (Phase 5).
 *
 * Token storage: the access token is a short-lived JWT sent in the
 * `Authorization: Bearer` header (see services/api.js) and persisted in
 * localStorage so a refresh keeps the session. This matches the existing
 * header-based architecture. A hardened production deployment should serve the
 * app and API same-site and move the token to an HttpOnly, Secure, SameSite
 * cookie (see docs/API_DOCUMENTATION.md → "Token storage trade-offs").
 */
const AuthContext = createContext(null);

const TOKEN_KEY = 'es_token';

/** The token lives in localStorage ("remember me") or sessionStorage. */
function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch (error) {
    return null;
  }
}

/**
 * Map a normalized API/network error to a friendly message + machine-readable
 * `kind` so the UI can describe each failure state distinctly and honestly.
 */
export function describeAuthError(error) {
  const status = error?.status ?? 0;

  if (status === 0) {
    return {
      kind: 'network',
      message: 'Cannot reach the server. Check your connection and try again.',
    };
  }
  if (status === 400) {
    return { kind: 'validation', message: error?.message || 'Please check the submitted details.' };
  }
  if (status === 401) {
    return { kind: 'invalid-credentials', message: 'Invalid username or password. Please try again.' };
  }
  if (status === 403) {
    return {
      kind: 'forbidden',
      message: error?.message || 'This account is not allowed to sign in. Contact an administrator.',
    };
  }
  if (status === 429) {
    return { kind: 'rate-limited', message: 'Too many attempts. Please wait a few minutes and try again.' };
  }
  if (status >= 500) {
    return { kind: 'server', message: 'The server could not sign you in. Please try again shortly.' };
  }
  return { kind: 'unknown', message: error?.message || 'Sign-in failed. Please try again.' };
}

export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);

  const [isLoading, setIsLoading] = useState(false);
  // `isReady` is false only while an existing session is being restored, so
  // route guards can wait instead of bouncing the user to /login on refresh.
  const [isReady, setIsReady] = useState(() => !readStoredToken());
  const restoredRef = useRef(false);

  // Restore a persisted session by validating the stored token with the API.
  useEffect(() => {
    if (restoredRef.current) return undefined;
    restoredRef.current = true;

    const storedToken = readStoredToken();
    if (!storedToken) {
      setIsReady(true);
      return undefined;
    }

    // restoredRef guarantees a single restore run even under React StrictMode's
    // double-invoked effects; the promise is intentionally not guarded by an
    // `active` flag (that would leave isReady stuck when the second, skipped
    // run's cleanup flips it), because the provider lives for the app's lifetime.
    setIsLoading(true);
    authService
      .me()
      .then((response) => {
        const payload = response.data || response;
        dispatch(setCredentials({ user: payload.user, token: storedToken }));
      })
      .catch(() => {
        // Invalid or expired token — drop it silently.
        dispatch(clearCredentials());
      })
      .finally(() => {
        setIsLoading(false);
        setIsReady(true);
      });
  }, [dispatch]);

  // React to a 401 from any later API call (expired/revoked token).
  useEffect(() => {
    const handleUnauthorized = () => dispatch(clearCredentials());
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [dispatch]);

  const login = useCallback(
    // `persist` picks the storage (localStorage vs sessionStorage) and is not
    // sent to the API.
    async ({ persist = true, ...credentials }) => {
      setIsLoading(true);
      try {
        const response = await authService.login(credentials);
        const payload = response.data || response;
        if (!payload?.token) {
          return { ok: false, kind: 'server', message: 'The server did not return a session token.' };
        }
        dispatch(setCredentials({ user: payload.user, token: payload.token, persist }));
        return { ok: true };
      } catch (error) {
        return { ok: false, ...describeAuthError(error) };
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch]
  );

  const logout = useCallback(async () => {
    try {
      if (readStoredToken()) {
        // Stateless JWT: this is a courtesy call; the token is discarded below.
        await authService.logout();
      }
    } catch (error) {
      // Ignore — the local session is cleared regardless.
    } finally {
      dispatch(clearCredentials());
    }
  }, [dispatch]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      isReady,
      login,
      logout,
    }),
    [user, token, isLoading, isReady, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
