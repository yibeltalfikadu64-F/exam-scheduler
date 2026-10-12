import { useCallback, useEffect, useState } from 'react';
import { Info } from 'lucide-react';

import StatCard from '../components/dashboard/StatCard';
import UpcomingExams from '../components/dashboard/UpcomingExams';
import ConflictAlerts from '../components/dashboard/ConflictAlerts';
import BackendStatus from '../components/dashboard/BackendStatus';
import { mockStats } from '../data/mockData';
import healthService from '../services/healthService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

/**
 * Dashboard shell.
 *
 * - Stat cards, upcoming exams and conflicts use SAMPLE data (clearly
 *   labelled) until the feature APIs exist.
 * - The backend status panel is a LIVE call to /api/v1/health.
 */
export default function Dashboard() {
  const [health, setHealth] = useState({ state: 'loading', payload: null, error: null });

  const loadHealth = useCallback(async () => {
    setHealth((previous) => ({ ...previous, state: 'loading' }));
    try {
      const response = await healthService.getHealth();
      setHealth({ state: 'online', payload: response.data, error: null });
    } catch (error) {
      setHealth({ state: 'offline', payload: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  return (
    <div className="page">
      <div className="prototype-banner">
        <Info size={16} />
        <span>
          The figures and lists below are sample data, not database records — the feature modules arrive in
          later phases. The <strong>Backend status</strong> panel is a live call to the API.
        </span>
      </div>

      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of the upcoming examination period.</p>
        </div>
        <span className="badge badge-warning">Sample data</span>
      </div>

      <div className="stats-grid stagger">
        {mockStats.map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>Upcoming exams</h3>
            <span className="badge badge-neutral">Sample data</span>
          </div>
          <div className="panel-body">
            <UpcomingExams />
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
              <span className="badge badge-neutral">Sample data</span>
            </div>
            <ConflictAlerts />
          </section>
        </div>
      </div>
    </div>
  );
}
