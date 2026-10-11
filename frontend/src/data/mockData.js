// ============================================================
// PROTOTYPE / MOCK DATA
// ------------------------------------------------------------
// These values are HARDCODED SAMPLES used only to visualise the dashboard
// shell during Phase 4. They are NOT read from MySQL and must never be
// presented as real, persisted data. Every place that renders them shows a
// "prototype data" indicator.
//
// Real data flows in from the API in later phases (each feature module).
// ============================================================

import { addDays, format } from 'date-fns';

const today = new Date();
const day = (offset) => format(addDays(today, offset), 'yyyy-MM-dd');

export const mockStats = [
  {
    id: 'exams',
    label: 'Scheduled Exams',
    value: '128',
    delta: '+12 this week',
    trend: 'up',
    icon: 'calendar',
    tone: 'primary',
  },
  {
    id: 'rooms',
    label: 'Active Rooms',
    value: '14',
    delta: '3 buildings',
    trend: 'flat',
    icon: 'door',
    tone: 'info',
  },
  {
    id: 'conflicts',
    label: 'Open Conflicts',
    value: '4',
    delta: '2 critical',
    trend: 'down',
    icon: 'alert',
    tone: 'danger',
  },
  {
    id: 'coverage',
    label: 'Schedule Coverage',
    value: '92%',
    delta: '118 / 128 exams',
    trend: 'up',
    icon: 'check',
    tone: 'success',
  },
];

export const mockUpcomingExams = [
  {
    id: 1,
    date: day(1),
    startTime: '08:30',
    endTime: '10:30',
    courseCode: 'SENG3341',
    courseTitle: 'Principles of Compiler Design',
    room: 'A201',
    building: 'Main Hall',
    students: 78,
    status: 'confirmed',
  },
  {
    id: 2,
    date: day(1),
    startTime: '14:00',
    endTime: '16:00',
    courseCode: 'CSEC3012',
    courseTitle: 'Database Systems',
    room: 'T101',
    building: 'IT Center',
    students: 96,
    status: 'confirmed',
  },
  {
    id: 3,
    date: day(2),
    startTime: '11:00',
    endTime: '13:00',
    courseCode: 'SENG5441',
    courseTitle: 'Software Testing and Quality Assurance',
    room: 'E101',
    building: 'Engineering Wing',
    students: 64,
    status: 'scheduled',
  },
  {
    id: 4,
    date: day(3),
    startTime: '08:30',
    endTime: '10:30',
    courseCode: 'CENG3101',
    courseTitle: 'Structural Analysis I',
    room: 'S101',
    building: 'Science Block',
    students: 48,
    status: 'scheduled',
  },
  {
    id: 5,
    date: day(4),
    startTime: '16:30',
    endTime: '18:30',
    courseCode: 'EEEN2210',
    courseTitle: 'Signals and Systems',
    room: 'A101',
    building: 'Main Hall',
    students: 52,
    status: 'draft',
  },
];

export const mockConflicts = [
  {
    id: 1,
    severity: 'critical',
    type: 'Room double-booked',
    title: 'Room A201 used twice in the same slot',
    description: 'SENG3341 and CSEC5012 are both assigned to Room A201 on the same morning slot.',
    place: 'Main Hall · A201 · Morning 1',
  },
  {
    id: 2,
    severity: 'high',
    type: 'Student overlap',
    title: 'Students in two exams at once',
    description: 'A cohort enrolled in both CSEC3012 and ITEC2101 has overlapping examination times.',
    place: 'IT Center · T101',
  },
  {
    id: 3,
    severity: 'medium',
    type: 'Room capacity',
    title: 'Room too small for candidates',
    description: 'Room E201 seats 45 but 61 candidates are assigned to the exam.',
    place: 'Engineering Wing · E201',
  },
  {
    id: 4,
    severity: 'low',
    type: 'Fair workload',
    title: 'Invigilation load imbalance',
    description: 'Two instructors carry more than three invigilation duties this period.',
    place: 'Exam period: Midterm 2026',
  },
];
