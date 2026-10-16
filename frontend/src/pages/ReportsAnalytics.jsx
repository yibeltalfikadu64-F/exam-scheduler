import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  RefreshCw,
  CalendarDays,
  DoorOpen,
  AlertTriangle,
  Users,
  LoaderCircle,
  Info,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import reportService from '../services/reportService';
import departmentService from '../services/departmentService';
import examPeriodService from '../services/examPeriodService';
import '../styles/reports-analytics.css';

/**
 * Reports & Analytics (Phase 7).
 *
 * Every figure on this page is computed live from the database by the reports
 * API. Nothing is sampled or invented client-side. Filters are limited to the
 * parameterized `departmentId` / `examPeriodId` query values the API accepts.
 */

const PIE_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

function getPayload(response) {
  return response?.data ?? response;
}

function errorText(error) {
  if (error?.status === 403) {
    return 'You do not have permission to view reports. Ask an administrator for access.';
  }
  if (error?.status === 0) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return error?.message || 'The report could not be loaded. Please try again.';
}

function downloadCSV(filename, rows) {
  if (!rows.length) return;

  const escapeCell = (value) => {
    const safeValue = String(value ?? '');
    return `"${safeValue.replace(/"/g, '""')}"`;
  };

  const csv = [
    Object.keys(rows[0]).map(escapeCell).join(','),
    ...rows.map((row) => Object.values(row).map(escapeCell).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, icon: Icon, variant, hint }) {
  return (
    <article className="reports-stat-card">
      <span className={`reports-stat-icon ${variant}`}>
        <Icon size={22} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

export default function ReportsAnalytics() {
  const [departmentId, setDepartmentId] = useState('');
  const [examPeriodId, setExamPeriodId] = useState('');
  const [report, setReport] = useState('departments');

  const [departments, setDepartments] = useState([]);
  const [examPeriods, setExamPeriods] = useState([]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const params = useMemo(() => {
    const query = {};
    if (departmentId) query.departmentId = departmentId;
    if (examPeriodId) query.examPeriodId = examPeriodId;
    return query;
  }, [departmentId, examPeriodId]);

  const loadSummary = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError('');

      try {
        const response = await reportService.summary(params);
        setData(getPayload(response));
      } catch (loadError) {
        setError(errorText(loadError));
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [params]
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await departmentService.options();
        const payload = getPayload(response);
        const items = Array.isArray(payload?.departments)
          ? payload.departments
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload)
              ? payload
              : [];
        if (active) setDepartments(items);
      } catch (optionsError) {
        if (active) setDepartments([]);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await examPeriodService.options();
        const payload = getPayload(response);
        const items = Array.isArray(payload?.examPeriods)
          ? payload.examPeriods
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        if (active) setExamPeriods(items);
      } catch (optionsError) {
        if (active) setExamPeriods([]);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const overview = data?.overview || null;
  const examLoad = Array.isArray(data?.examLoad) ? data.examLoad : [];
  const roomUtilization = Array.isArray(data?.roomUtilization) ? data.roomUtilization : [];
  const conflicts = data?.conflicts || { byType: [], bySeverity: [], byStatus: [] };
  const invigilation = data?.invigilation || { distribution: [], top: [], totalInvigilators: 0 };

  const averageUtilization = useMemo(() => {
    const active = roomUtilization.filter((room) => room.capacity > 0);
    if (!active.length) return 0;
    const sum = active.reduce((total, room) => total + room.utilizationPercent, 0);
    return Math.round(sum / active.length);
  }, [roomUtilization]);

  const totalConflicts = useMemo(
    () => conflicts.byType.reduce((sum, item) => sum + item.count, 0),
    [conflicts.byType]
  );

  const reportRows = useMemo(() => {
    if (report === 'rooms') {
      return roomUtilization.map((room) => ({
        room: room.room,
        building: room.building,
        type: room.type,
        capacity: room.capacity,
        peakStudents: room.peakStudents,
        utilizationPercent: room.utilizationPercent,
      }));
    }

    if (report === 'conflicts') {
      return conflicts.byType.map((item) => ({
        conflictType: item.type,
        conflicts: item.count,
      }));
    }

    if (report === 'invigilation') {
      return invigilation.top.map((item) => ({
        invigilator: item.name,
        department: item.department,
        duties: item.duties,
      }));
    }

    return examLoad.map((item) => ({
      code: item.code,
      department: item.department,
      courses: item.courses,
      sections: item.sections,
      exams: item.exams,
      students: item.students,
    }));
  }, [report, examLoad, roomUtilization, conflicts.byType, invigilation.top]);

  function exportCSV() {
    downloadCSV(`exam-${report}-report.csv`, reportRows);
  }

  return (
    <main className="reports-page">
      <header className="reports-header">
        <div className="reports-heading">
          <span className="reports-heading-icon">
            <BarChart3 size={27} />
          </span>
          <div>
            <h1>Reports &amp; Analytics</h1>
            <p>Live examination statistics computed from the database.</p>
          </div>
        </div>

        <div className="reports-header-actions">
          <button
            type="button"
            className="reports-refresh-button"
            onClick={() => loadSummary({ silent: true })}
            disabled={loading || refreshing}
          >
            <RefreshCw size={17} className={refreshing ? 'reports-spinning' : ''} />
            Refresh
          </button>

          <button
            type="button"
            className="reports-export-button"
            onClick={exportCSV}
            disabled={reportRows.length === 0}
          >
            <Download size={17} />
            Export CSV
          </button>
        </div>
      </header>

      <div className="reports-demo-notice" role="status">
        <Info size={20} />
        <div>
          <strong>Live database reporting</strong>
          <p>
            All figures below are queried from the live database. CSV exports
            contain the real rows for the selected report. PDF export is not
            available.
          </p>
        </div>
      </div>

      <section className="reports-filters">
        <label htmlFor="reports-department">
          Department
          <select
            id="reports-department"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.code || `Department ${item.id}`}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="reports-period">
          Exam period
          <select
            id="reports-period"
            value={examPeriodId}
            onChange={(event) => setExamPeriodId(event.target.value)}
          >
            <option value="">All exam periods</option>
            {examPeriods.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.term ? ` (${item.term})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="reports-type">
          Export report
          <select
            id="reports-type"
            value={report}
            onChange={(event) => setReport(event.target.value)}
          >
            <option value="departments">Department exam load</option>
            <option value="rooms">Room utilization</option>
            <option value="conflicts">Conflict types</option>
            <option value="invigilation">Invigilation workload</option>
          </select>
        </label>
      </section>

      {error && (
        <div className="reports-state reports-state-error" role="alert">
          <ShieldAlert size={30} />
          <h3>Could not load reports</h3>
          <p>{error}</p>
          <button
            type="button"
            className="reports-refresh-button"
            onClick={() => loadSummary()}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      )}

      {!error && loading && (
        <div className="reports-state">
          <LoaderCircle className="reports-spinner" size={30} />
          <h3>Loading reports</h3>
          <p>Querying the database…</p>
        </div>
      )}

      {!error && !loading && (
        <>
          <section className="reports-stats">
            <StatCard
              label="Scheduled exams"
              value={overview?.scheduledExams ?? 0}
              icon={CalendarDays}
              variant="purple"
              hint="Scheduled, confirmed or completed"
            />
            <StatCard
              label="Active students"
              value={(overview?.students ?? 0).toLocaleString()}
              icon={Users}
              variant="blue"
              hint="Across the selected scope"
            />
            <StatCard
              label="Average room utilization"
              value={`${averageUtilization}%`}
              icon={DoorOpen}
              variant="green"
              hint={`Peak load across ${roomUtilization.length} room(s)`}
            />
            <StatCard
              label="Open conflicts"
              value={overview?.openConflicts ?? 0}
              icon={AlertTriangle}
              variant="orange"
              hint={`${totalConflicts} conflict record(s) in total`}
            />
          </section>

          <section className="reports-chart-grid">
            <article className="reports-chart-card reports-chart-wide">
              <div className="reports-card-heading">
                <div>
                  <h2>Exam load by department</h2>
                  <p>Distinct exams and enrolled students per department</p>
                </div>
              </div>

              <div className="reports-chart">
                {examLoad.length === 0 ? (
                  <p className="reports-chart-empty">No department data for this selection.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={examLoad}
                      margin={{ top: 12, right: 12, left: -12, bottom: 45 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="department"
                        angle={-25}
                        textAnchor="end"
                        interval={0}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="exams" name="Exams" fill="#6366f1" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="students" name="Students" fill="#06b6d4" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="reports-chart-card">
              <div className="reports-card-heading">
                <div>
                  <h2>Room utilization</h2>
                  <p>Largest seated exam vs room capacity</p>
                </div>
              </div>

              <div className="reports-chart">
                {roomUtilization.length === 0 ? (
                  <p className="reports-chart-empty">No rooms have been configured.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={roomUtilization}
                      margin={{ top: 12, right: 8, left: -18, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="room" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="peakStudents" name="Peak seated" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="capacity" name="Capacity" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="reports-chart-card">
              <div className="reports-card-heading">
                <div>
                  <h2>Conflicts by type</h2>
                  <p>Recorded schedule conflicts grouped by type</p>
                </div>
              </div>

              <div className="reports-chart">
                {conflicts.byType.length === 0 ? (
                  <p className="reports-chart-empty">No conflicts have been recorded.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={conflicts.byType}
                      margin={{ top: 12, right: 8, left: -18, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="type"
                        angle={-25}
                        textAnchor="end"
                        interval={0}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Conflicts" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="reports-chart-card">
              <div className="reports-card-heading">
                <div>
                  <h2>Invigilation workload</h2>
                  <p>Distribution of invigilators by duty count</p>
                </div>
              </div>

              <div className="reports-chart reports-pie-chart">
                {invigilation.totalInvigilators === 0 ? (
                  <p className="reports-chart-empty">No invigilators have been registered.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={invigilation.distribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        outerRadius={85}
                        label
                      >
                        {invigilation.distribution.map((item, index) => (
                          <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </section>

          <section className="reports-table-card">
            <div className="reports-card-heading">
              <div>
                <h2>Report detail</h2>
                <p>
                  {reportRows.length} row{reportRows.length === 1 ? '' : 's'} · exported CSV uses this
                  selection
                </p>
              </div>

              <button
                type="button"
                className="reports-export-button reports-export-secondary"
                onClick={exportCSV}
                disabled={reportRows.length === 0}
              >
                <Download size={16} />
                Download CSV
              </button>
            </div>

            {reportRows.length === 0 ? (
              <p className="reports-chart-empty reports-chart-empty-table">
                No rows for this report selection.
              </p>
            ) : (
              <div className="reports-table-scroll">
                <table className="reports-table">
                  <thead>
                    <tr>
                      {Object.keys(reportRows[0]).map((key) => (
                        <th key={key} scope="col">
                          {key.replace(/([A-Z])/g, ' $1')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex}>{value === null || value === '' ? '—' : value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <p className="reports-footer-note">
        Figures refresh from the database on every load. Date-range filters and
        PDF generation are not available.
      </p>
    </main>
  );
}
