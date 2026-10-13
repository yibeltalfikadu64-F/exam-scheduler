
import { parseISO, format, isValid } from 'date-fns';
import { Clock, DoorOpen, Users } from 'lucide-react';

import Badge from '../common/Badge';
import EmptyState from '../common/EmptyState';

const STATUS_TONE = {
  confirmed: 'success',
  scheduled: 'primary',
  draft: 'neutral',
  completed: 'success',
  cancelled: 'danger',
};

export default function UpcomingExams({ exams = [], loading = false }) {
  if (loading) {
    return <EmptyState title="Loading exams..." description="Retrieving scheduled examinations from the database." />;
  }

  if (!exams.length) {
    return (
      <EmptyState
        title="No upcoming exams"
        description="No future scheduled examinations were found in the database."
      />
    );
  }

  return (
    <div className="exam-list">
      {exams.map((exam) => {
        const date = parseISO(String(exam.date).slice(0, 10));
        const validDate = isValid(date);

        return (
          <div className="exam-item" key={exam.id}>
            <div className="exam-date" aria-hidden="true">
              <span className="day">
                {validDate ? format(date, 'd') : '—'}
              </span>
              <span className="month">
                {validDate ? format(date, 'MMM') : 'Date'}
              </span>
            </div>

            <div className="exam-main">
              <div className="course">
                {exam.courseCode
                  ? `${exam.courseCode} · ${exam.courseTitle}`
                  : exam.courseTitle}
              </div>

              <div className="meta">
                <span>
                  <Clock size={13} /> {String(exam.startTime).slice(0, 5)}
                  {'–'}
                  {String(exam.endTime).slice(0, 5)}
                </span>
                <span>
                  <DoorOpen size={13} /> {exam.building} · {exam.room}
                </span>
                <span>
                  <Users size={13} /> {exam.students} candidates
                </span>
              </div>
            </div>

            <Badge tone={STATUS_TONE[exam.status] || 'neutral'}>
              {exam.status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
