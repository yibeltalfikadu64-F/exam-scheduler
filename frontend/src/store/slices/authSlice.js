import { createSlice } from '@reduxjs/toolkit';

/**
 * Auth state + token persistence.
 *
 * "Remember me" selects the storage: checked -> localStorage (survives browser
 * restarts), unchecked -> sessionStorage (cleared when the tab closes). Only
 * exactly one storage holds the token at a time.
 */
const TOKEN_KEY = 'es_token';
const USER_KEY = 'es_user';

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch (error) {
    return null;
  }
}

function readValue(key) {
  return safeGet(localStorage, key) ?? safeGet(sessionStorage, key);
}

function readPersistedUser() {
  const raw = readValue(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writeValue(key, value, persist) {
  const target = persist ? localStorage : sessionStorage;
  const other = persist ? sessionStorage : localStorage;
  try {
    target.setItem(key, value);
    other.removeItem(key);
  } catch (error) {
    // Ignore storage failures (private mode, quota).
  }
}

function removeValue(key) {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch (error) {
    // Ignore.
  }
}

const initialState = {
  user: readPersistedUser(),
  token: readValue(TOKEN_KEY) || null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      const { user = null, token = null, persist = true } = action.payload || {};
      state.user = user;
      state.token = token;
      if (token) writeValue(TOKEN_KEY, token, persist);
      else removeValue(TOKEN_KEY);
      if (user) writeValue(USER_KEY, JSON.stringify(user), persist);
      else removeValue(USER_KEY);
    },
    clearCredentials(state) {
      state.user = null;
      state.token = null;
      removeValue(TOKEN_KEY);
      removeValue(USER_KEY);
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
