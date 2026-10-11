import { AlertTriangle, CalendarDays, CheckCircle2, DoorOpen } from 'lucide-react';

const ICONS = {
  calendar: CalendarDays,
  door: DoorOpen,
  alert: AlertTriangle,
  check: CheckCircle2,
};

/**
 * Dashboard statistic card. Presentational only.
 */
export default function StatCard({ icon = 'calendar', tone = 'primary', value, label, delta = null, trend = 'flat' }) {
  const Icon = ICONS[icon] || CalendarDays;
  const deltaClass = trend === 'up' || trend === 'down' ? trend : '';

  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className={`stat-icon stat-icon-${tone}`} aria-hidden="true">
          <Icon size={20} />
        </span>
        {delta ? <span className={`stat-delta ${deltaClass}`}>{delta}</span> : null}
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </article>
  );
}
