import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { setSidebarOpen } from '../../store/slices/uiSlice';

/**
 * Application shell: sidebar + topbar + routed page content.
 */
export default function DashboardLayout() {
  const dispatch = useDispatch();
  const { sidebarOpen, sidebarCollapsed } = useSelector((state) => state.ui);
  const location = useLocation();

  // Auto-close the mobile off-canvas sidebar after navigating.
  useEffect(() => {
    dispatch(setSidebarOpen(false));
  }, [location.pathname, dispatch]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <Sidebar open={sidebarOpen} />

      {sidebarOpen ? (
        <div
          className="sidebar-overlay"
          role="presentation"
          onClick={() => dispatch(setSidebarOpen(false))}
        />
      ) : null}

      <div className="main-area">
        <Topbar />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
