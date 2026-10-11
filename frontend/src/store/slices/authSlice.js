import { createSlice } from '@reduxjs/toolkit';

const TOKEN_KEY = 'es_token';
const USER_KEY = 'es_user';

function readPersistedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

const initialState = {
  user: readPersistedUser(),
  token: localStorage.getItem(TOKEN_KEY) || null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      const { user = null, token = null } = action.payload || {};
      state.user = user;
      state.token = token;
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    },
    clearCredentials(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
