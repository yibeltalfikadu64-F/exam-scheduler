
'use strict';

/**
 * API v1 router. Feature routers are mounted here as phases are completed.
 */

const express = require('express');
const config = require('../config/environment');

const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');
const userRoutes = require('./user.routes');
const departmentRoutes = require('./department.routes');
const programRoutes = require('./program.routes');
const courseRoutes = require('./course.routes');
const academicYearRoutes = require('./academicYear.routes');
const sectionRoutes = require('./section.routes');
const studentRoutes = require('./student.routes');
const instructorRoutes = require('./instructor.routes');
const buildingRoutes = require('./building.routes');
const roomRoutes = require('./room.routes');
const timeSlotRoutes = require('./timeSlot.routes');
const scheduleConstraintRoutes = require('./scheduleConstraint.routes');
const examRoutes = require('./exam.routes');
const examPeriodRoutes = require('./examPeriod.routes');
const schedulingRoutes = require('./scheduling.routes');
const invigilatorRoutes = require('./invigilator.routes');
const invigilationRoutes = require('./invigilation.routes');
const notificationRoutes = require('./notification.routes');

const router = express.Router();

// GET /api/v1
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: `${config.appName} v${config.version}`,
    data: {
      version: 'v1',
      endpoints: {
        health: `${config.apiPrefix}/health`,
        login: `${config.apiPrefix}/auth/login`,
        me: `${config.apiPrefix}/auth/me`,
        logout: `${config.apiPrefix}/auth/logout`,
        users: `${config.apiPrefix}/users`,
        departments: `${config.apiPrefix}/departments`,
        programs: `${config.apiPrefix}/programs`,
        courses: `${config.apiPrefix}/courses`,
        academicYears: `${config.apiPrefix}/academic-years`,
        examPeriods: `${config.apiPrefix}/exam-periods`,
        sections: `${config.apiPrefix}/sections`,
        students: `${config.apiPrefix}/students`,
        instructors: `${config.apiPrefix}/instructors`,
        buildings: `${config.apiPrefix}/buildings`,
        rooms: `${config.apiPrefix}/rooms`,
        timeSlots: `${config.apiPrefix}/time-slots`,
        scheduleConstraints: `${config.apiPrefix}/schedule-constraints`,
        exams: `${config.apiPrefix}/exams`,
        schedules: `${config.apiPrefix}/scheduling/schedules`,
        schedulePreview: `${config.apiPrefix}/scheduling/preview`,
        invigilators: `${config.apiPrefix}/invigilators`,
        invigilation: `${config.apiPrefix}/invigilation`,
        notifications: `${config.apiPrefix}/notifications`,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/programs', programRoutes);
router.use('/courses', courseRoutes);
router.use('/academic-years', academicYearRoutes);
router.use('/exam-periods', examPeriodRoutes);
router.use('/sections', sectionRoutes);
router.use('/students', studentRoutes);
router.use('/instructors', instructorRoutes);
router.use('/buildings', buildingRoutes);
router.use('/rooms', roomRoutes);
router.use('/time-slots', timeSlotRoutes);
router.use('/schedule-constraints', scheduleConstraintRoutes);
router.use('/exams', examRoutes);
router.use('/scheduling', schedulingRoutes);
router.use('/invigilators', invigilatorRoutes);
router.use('/invigilation', invigilationRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
