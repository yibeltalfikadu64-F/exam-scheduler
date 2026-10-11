import { parseISO, format } from 'date-fns';
import { Clock, DoorOpen, Users } from 'lucide-react';

import Badge from '../common/Badge';
import EmptyState from '../common/EmptyState';
import { mockUpcomingExams } from '../../data/mockData';

const STATUS_TONE = {
  confirmed: 'success',
  scheduled: 'primary',
  draft: 'neutral',
  cancelled: 'danger',
};

/**
 * Upcoming exams panel. Renders PROTOTYPE data (see data/mockData.js) until
 * the schedule API is wired up in a later phase.
 */
export default function UpcomingExams({ exams = mockUpcomingExams }) {
  if (!exams.length) {
    return <EmptyState title="No upcoming exams" description="Generated schedules will appear here." />;
  }

  return (
    <div className="exam-list">
      {exams.map((exam) => {
        const date = parseISO(exam.date);
        return (
          <div className="exam-item" key={exam.id}>
            <div className="exam-date" aria-hidden="true">
              <span className="day">{format(date, 'd')}</span>
              <span className="month">{format(date, 'MMM')}</span>
            </div>

            <div className="exam-main">
              <div className="course">
                {exam.courseCode} · {exam.courseTitle}
              </div>
              <div className="meta">
                <span>
                  <Clock size={13} /> {exam.startTime}–{exam.endTime}
                </span>
                <span>
                  <DoorOpen size={13} /> {exam.building} · {exam.room}
                </span>
                <span>
                  <Users size={13} /> {exam.students} candidates
                </span>
              </div>
            </div>

            <Badge tone={STATUS_TONE[exam.status] || 'neutral'}>{exam.status}</Badge>
          </div>
        );
      })}
    </div>
  );
}
