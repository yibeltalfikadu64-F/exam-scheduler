import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { setCredentials, clearCredentials } from '../store/slices/authSlice';
import authService from '../services/authService';

/**
 * Authentication context.
 *
 * PHASE 4 NOTE: the backend login endpoint arrives in Phase 5. While
 * VITE_PROTOTYPE_MODE is "true" the provider seeds a clearly-labelled
 * prototype session so the dashboard shell can be reviewed. The prototype user
 * is flagged `isPrototype` and a visible banner is shown — it is never
 * presented as a real, database-backed login.
 */
const AuthContext = createContext(null);

const PROTOTYPE_MODE = String(import.meta.env.VITE_PROTOTYPE_MODE ?? 'true') === 'true';

const PROTOTYPE_USER = {
  id: 0,
  username: 'prototype',
  fullName: 'Prototype Viewer',
  role: 'admin',
  isPrototype: true,
};

export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (PROTOTYPE_MODE && !user && !token) {
      dispatch(setCredentials({ user: PROTOTYPE_USER, token: null }));
    }
  }, [dispatch, user, token]);

  const login = useCallback(
    async (credentials) => {
      setIsLoading(true);
      try {
        const response = await authService.login(credentials);
        const payload = response.data || response;
        dispatch(setCredentials({ user: payload.user, token: payload.token }));
        return { ok: true };
      } catch (error) {
        const message =
          error.status === 404
            ? 'Sign-in is not enabled yet (arrives in Phase 5). Prototype mode lets you preview the dashboard in the meantime.'
            : error.message;
        return { ok: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch]
  );

  const logout = useCallback(() => {
    dispatch(clearCredentials());
  }, [dispatch]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user || token),
      isLoading,
      isPrototype: Boolean(user && user.isPrototype),
      login,
      logout,
    }),
    [user, token, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
