import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen: false, // mobile off-canvas
  sidebarCollapsed: false, // desktop icon-only
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action) {
      state.sidebarOpen = Boolean(action.payload);
    },
    toggleCollapsed(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
});

export const { toggleSidebar, setSidebarOpen, toggleCollapsed } = uiSlice.actions;
export default uiSlice.reducer;
