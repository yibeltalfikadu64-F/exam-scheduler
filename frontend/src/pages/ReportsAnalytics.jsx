import { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  CalendarDays,
  DoorOpen,
  AlertTriangle,
  Users,
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
import '../styles/reports-analytics.css';

const SAMPLE_DATA = {
  departments: [
    { name: 'Computer Science', exams: 24, students: 720 },
    { name: 'Engineering', exams: 19, students: 580 },
    { name: 'Business', exams: 16, students: 490 },
    { name: 'Natural Science', exams: 21, students: 630 },
    { name: 'Social Science', exams: 13, students: 390 },
  ],
  rooms: [
    { name: 'Room A', capacity: 120, assigned: 95 },
    { name: 'Room B', capacity: 100, assigned: 80 },
    { name: 'Room C', capacity: 80, assigned: 72 },
    { name: 'Room D', capacity: 150, assigned: 105 },
    { name: 'Room E', capacity: 60, assigned: 30 },
  ],
  conflicts: [
    { period: 'Week 1', count: 8 },
    { period: 'Week 2', count: 5 },
    { period: 'Week 3', count: 7 },
    { period: 'Week 4', count: 3 },
  ],
  invigilation: [
    { name: '0–2 duties', value: 12 },
    { name: '3–4 duties', value: 18 },
    { name: '5+ duties', value: 6 },
  ],
};

const PIE_COLORS = ['#6366f1', '#06b6d4', '#f59e0b'];

function downloadCSV(filename, rows) {
  if (!rows.length) return;

  const escapeCell = (value) => {
    const safeValue = String(value ?? '');
    return `"${safeValue.replace(/"/g, '""')}"`;
  };

  const csv = [
    Object.keys(rows[0]).map(escapeCell).join(','),
    ...rows.map((row) =>
      Object.values(row).map(escapeCell).join(',')
    ),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF', csv], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsAnalytics() {
  const [department, setDepartment] = useState('all');
  const [report, setReport] = useState('departments');

  const departments = SAMPLE_DATA.departments;

  const filteredDepartments = useMemo(
    () =>
      department === 'all'
        ? departments
        : departments.filter((item) => item.name === department),
    [department, departments]
  );

  const totalExams = filteredDepartments.reduce(
    (sum, item) => sum + item.exams,
    0
  );

  const totalStudents = filteredDepartments.reduce(
    (sum, item) => sum + item.students,
    0
  );

  const averageRoomUtilization = Math.round(
    (SAMPLE_DATA.rooms.reduce(
      (sum, room) => sum + room.assigned / room.capacity,
      0
    ) /
      SAMPLE_DATA.rooms.length) *
    100
  );

  const totalConflicts = SAMPLE_DATA.conflicts.reduce(
    (sum, item) => sum + item.count,
    0
  );

  const reportRows = useMemo(() => {
    if (report === 'rooms') {
      return SAMPLE_DATA.rooms.map((room) => ({
        room: room.name,
        capacity: room.capacity,
        assigned: room.assigned,
        utilizationPercent: Math.round(
          (room.assigned / room.capacity) * 100
        ),
      }));
    }

    if (report === 'conflicts') {
      return SAMPLE_DATA.conflicts.map((item) => ({
        period: item.period,
        conflicts: item.count,
      }));
    }

    if (report === 'invigilation') {
      return SAMPLE_DATA.invigilation.map((item) => ({
        dutyGroup: item.name,
        invigilators: item.value,
      }));
    }

    return filteredDepartments.map((item) => ({
      department: item.name,
      exams: item.exams,
      students: item.students,
    }));
  }, [report, filteredDepartments]);

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
            <p>Explore sample examination statistics and reporting options.</p>
          </div>
        </div>

        <button
          type="button"
          className="reports-export-button"
          onClick={exportCSV}
          disabled={reportRows.length === 0}
        >
          <Download size={17} />
          Export CSV
        </button>
      </header>

      <div className="reports-demo-notice" role="status">
        <FileSpreadsheet size={20} />
        <div>
          <strong>Preview mode — sample data only</strong>
          <p>
            These charts and figures are illustrative examples, not real
            university records. This page makes no API requests and does not
            read from or write to the database. CSV exports contain sample
            data only. PDF export and live reporting are planned for a later
            phase.
          </p>
        </div>
      </div>

      <section className="reports-filters">
        <label htmlFor="reports-department">
          Department
          <select
            id="reports-department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="all">All departments</option>
            {departments.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
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
            <option value="conflicts">Conflict trends</option>
            <option value="invigilation">Invigilation workload</option>
          </select>
        </label>
      </section>

      <section className="reports-stats">
        <article className="reports-stat-card">
          <span className="reports-stat-icon purple">
            <CalendarDays size={22} />
          </span>
          <div>
            <p>Sample exams</p>
            <strong>{totalExams}</strong>
            <small>Selected department scope</small>
          </div>
        </article>

        <article className="reports-stat-card">
          <span className="reports-stat-icon blue">
            <Users size={22} />
          </span>
          <div>
            <p>Sample candidates</p>
            <strong>{totalStudents.toLocaleString()}</strong>
            <small>Illustrative student totals</small>
          </div>
        </article>

        <article className="reports-stat-card">
          <span className="reports-stat-icon green">
            <DoorOpen size={22} />
          </span>
          <div>
            <p>Room utilization</p>
            <strong>{averageRoomUtilization}%</strong>
            <small>Across sample rooms</small>
          </div>
        </article>

        <article className="reports-stat-card">
          <span className="reports-stat-icon orange">
            <AlertTriangle size={22} />
          </span>
          <div>
            <p>Sample conflicts</p>
            <strong>{totalConflicts}</strong>
            <small>Across four sample weeks</small>
          </div>
        </article>
      </section>

      <section className="reports-chart-grid">
        <article className="reports-chart-card reports-chart-wide">
          <div className="reports-card-heading">
            <div>
              <h2>Exam load by department</h2>
              <p>Illustrative examination counts</p>
            </div>
          </div>

          <div className="reports-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredDepartments}
                margin={{ top: 12, right: 12, left: -12, bottom: 45 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="exams"
                  name="Exams"
                  fill="#6366f1"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="reports-chart-card">
          <div className="reports-card-heading">
            <div>
              <h2>Room utilization</h2>
              <p>Assigned candidates vs capacity</p>
            </div>
          </div>

          <div className="reports-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={SAMPLE_DATA.rooms}
                margin={{ top: 12, right: 8, left: -18, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="assigned"
                  name="Assigned"
                  fill="#06b6d4"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="capacity"
                  name="Capacity"
                  fill="#cbd5e1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="reports-chart-card">
          <div className="reports-card-heading">
            <div>
              <h2>Conflict trends</h2>
              <p>Sample conflicts per week</p>
            </div>
          </div>

          <div className="reports-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={SAMPLE_DATA.conflicts}
                margin={{ top: 12, right: 8, left: -18, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Conflicts"
                  fill="#f59e0b"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="reports-chart-card">
          <div className="reports-card-heading">
            <div>
              <h2>Invigilation workload</h2>
              <p>Illustrative distribution of invigilators</p>
            </div>
          </div>

          <div className="reports-chart reports-pie-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={SAMPLE_DATA.invigilation}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={85}
                  label
                >
                  {SAMPLE_DATA.invigilation.map((item, index) => (
                    <Cell
                      key={item.name}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="reports-table-card">
        <div className="reports-card-heading">
          <div>
            <h2>Report preview</h2>
            <p>
              {reportRows.length} sample rows · Exported CSV uses this report
              selection
            </p>
          </div>

          <button
            type="button"
            className="reports-export-button reports-export-secondary"
            onClick={exportCSV}
          >
            <Download size={16} />
            Download CSV
          </button>
        </div>

        <div className="reports-table-scroll">
          <table className="reports-table">
            <thead>
              <tr>
                {reportRows.length > 0 &&
                  Object.keys(reportRows[0]).map((key) => (
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
                    <td key={cellIndex}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="reports-footer-note">
        Planned for a future phase: live database reports, date-range filters,
        PDF generation, department/course/level breakdowns, and verified
        invigilation fairness metrics.
      </p>
    </main>
  );
}