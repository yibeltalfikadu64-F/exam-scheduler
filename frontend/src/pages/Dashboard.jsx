
import { useCallback, useEffect, useState } from 'react';

import StatCard from '../components/dashboard/StatCard';
import UpcomingExams from '../components/dashboard/UpcomingExams';
import ConflictAlerts from '../components/dashboard/ConflictAlerts';
import BackendStatus from '../components/dashboard/BackendStatus';

import dashboardService from '../services/dashboardService';
import healthService from '../services/healthService';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const EMPTY_DASHBOARD = {
  stats: [],
  upcomingExams: [],
  conflicts: [],
};

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);

  const [health, setHealth] = useState({
    state: 'loading',
    payload: null,
    error: null,
  });

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const response = await dashboardService.getDashboard();

      if (!response?.success || !response?.data) {
        throw new Error('The dashboard API returned an unexpected response.');
      }

      setDashboard({
        stats: response.data.stats || [],
        upcomingExams: response.data.upcomingExams || [],
        conflicts: response.data.conflicts || [],
      });
    } catch (error) {
      setDashboardError(error.message || 'Unable to load dashboard data.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setHealth((previous) => ({
      ...previous,
      state: 'loading',
      error: null,
    }));

    try {
      const response = await healthService.getHealth();

      setHealth({
        state: response?.data?.status === 'ok' ? 'online' : 'offline',
        payload: response.data,
        error:
          response?.data?.status === 'ok'
            ? null
            : 'The backend or database is reporting degraded health.',
      });
    } catch (error) {
      setHealth({
        state: 'offline',
        payload: error.details || null,
        error: error.message || 'Unable to reach the health endpoint.',
      });
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadHealth();
  }, [loadDashboard, loadHealth]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of the upcoming examination period.</p>
        </div>
        <span className="badge badge-neutral">Live database data</span>
      </div>

      {dashboardError && (
        <div className="panel" role="alert">
          <div className="panel-body">
            <p>Unable to load dashboard data: {dashboardError}</p>
            <button type="button" onClick={loadDashboard}>
              Retry dashboard data
            </button>
          </div>
        </div>
      )}

      <div className="stats-grid stagger">
        {dashboard.stats.map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}

        {dashboardLoading &&
          dashboard.stats.length === 0 &&
          [1, 2, 3, 4].map((item) => (
            <article className="stat-card" key={item}>
              <div className="stat-value">—</div>
              <div className="stat-label">Loading database data...</div>
            </article>
          ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>Upcoming exams</h3>
            <span className="badge badge-neutral">Database</span>
          </div>
          <div className="panel-body">
            <UpcomingExams
              exams={dashboard.upcomingExams}
              loading={dashboardLoading}
            />
          </div>
        </section>

        <div className="stack gap-5">
          <BackendStatus
            state={health.state}
            payload={health.payload}
            error={health.error}
            onRefresh={loadHealth}
            apiBaseUrl={API_BASE_URL}
          />

          <section className="panel">
            <div className="panel-header">
              <h3>Schedule conflicts</h3>
              <span className="badge badge-neutral">Database</span>
            </div>
            <div className="panel-body">
              <ConflictAlerts
                conflicts={dashboard.conflicts}
                loading={dashboardLoading}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
