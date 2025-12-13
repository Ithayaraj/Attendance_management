import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';
import * as studentsController from '../controllers/studentsController.js';
import * as coursesController from '../controllers/coursesController.js';
import * as enrollmentsController from '../controllers/enrollmentsController.js';
import * as sessionsController from '../controllers/sessionsController.js';
import * as scansController from '../controllers/scansController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as devicesController from '../controllers/devicesController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import * as studentAnalyticsController from '../controllers/studentAnalyticsController.js';
import * as batchesController from '../controllers/batchesController.js';
import { broadcast } from '../realtime/ws.js';

const router = express.Router();

const scanLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many scan requests'
});

router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refresh);
router.post('/auth/logout', authController.logout);

router.get('/students', requireAuth, studentsController.getStudents);
router.get('/students/:id', requireAuth, studentsController.getStudent);
router.post('/students', requireAuth, requireRole(['admin']), studentsController.createStudent);
router.put('/students/bulk-update', requireAuth, requireRole(['admin']), studentsController.bulkUpdateStudents);
router.put('/students/:id', requireAuth, requireRole(['admin']), studentsController.updateStudent);
router.delete('/students/:id', requireAuth, requireRole(['admin']), studentsController.deleteStudent);

router.get('/courses', requireAuth, coursesController.getCourses);
router.get('/courses/:id', requireAuth, coursesController.getCourse);
router.post('/courses', requireAuth, requireRole(['admin', 'instructor']), coursesController.createCourse);
router.put('/courses/:id', requireAuth, requireRole(['admin', 'instructor']), coursesController.updateCourse);
router.delete('/courses/:id', requireAuth, requireRole(['admin']), coursesController.deleteCourse);

router.get('/courses/:courseId/enrollments', requireAuth, enrollmentsController.getCourseEnrollments);
router.post('/courses/:courseId/enrollments', requireAuth, requireRole(['admin', 'instructor']), enrollmentsController.createEnrollment);
router.delete('/courses/:courseId/enrollments/:studentId', requireAuth, requireRole(['admin', 'instructor']), enrollmentsController.deleteEnrollment);

router.get('/sessions', requireAuth, sessionsController.querySessions);
router.get('/courses/:courseId/sessions', requireAuth, sessionsController.getCourseSessions);
router.post('/courses/:courseId/sessions', requireAuth, requireRole(['admin', 'instructor']), sessionsController.createSession);
router.get('/sessions/:sessionId', requireAuth, sessionsController.getSession);
router.get('/sessions/:sessionId/relations', requireAuth, sessionsController.getSessionRelations);
router.patch('/sessions/:sessionId/status', requireAuth, requireRole(['admin', 'instructor']), sessionsController.updateSessionStatus);
router.put('/sessions/:sessionId', requireAuth, requireRole(['admin', 'instructor']), sessionsController.updateSession);
router.delete('/sessions/:sessionId', requireAuth, requireRole(['admin', 'instructor']), sessionsController.deleteSession);

router.post('/scans/ingest', scanLimiter, scansController.ingestScan);

// Test endpoint to verify WebSocket broadcast (for debugging)
router.post('/scans/test-broadcast', (req, res) => {
  const testData = {
    type: 'scan.ingested',
    payload: {
      studentId: 'test-id',
      studentName: 'Test Student',
      registrationNo: 'TEST001',
      sessionId: 'test-session',
      courseCode: 'TEST101',
      status: 'present',
      checkInAt: new Date().toISOString()
    }
  };
  console.log('=== Test broadcast triggered ===');
  broadcast(testData);
  res.json({ success: true, message: 'Test broadcast sent' });
});

// Test endpoint to verify session timing validation (for debugging)
router.post('/scans/test-timing', async (req, res) => {
  try {
    const { registrationNo, sessionId } = req.body;
    
    if (!registrationNo || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'registrationNo and sessionId required'
      });
    }

    // Find the session
    const session = await (await import('../models/ClassSession.js')).ClassSession.findById(sessionId).populate('courseId');
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check timing validation
    const now = new Date();
    const sessionStartIso = `${session.date}T${session.startTime}:00Z`;
    const sessionStart = new Date(sessionStartIso);
    const EARLY_ACCESS_MINUTES = 15;
    const earliestLiveTime = new Date(sessionStart.getTime() - (EARLY_ACCESS_MINUTES * 60 * 1000));
    
    const canAttend = now >= earliestLiveTime;
    const minutesUntilStart = Math.ceil((sessionStart.getTime() - now.getTime()) / (60 * 1000));
    const minutesUntilEarlyAccess = Math.ceil((earliestLiveTime.getTime() - now.getTime()) / (60 * 1000));

    res.json({
      success: true,
      data: {
        session: {
          id: session._id,
          courseCode: session.courseId.code,
          date: session.date,
          startTime: session.startTime,
          status: session.status
        },
        timing: {
          now: now.toISOString(),
          sessionStart: sessionStart.toISOString(),
          earliestLiveTime: earliestLiveTime.toISOString(),
          canAttend,
          minutesUntilStart,
          minutesUntilEarlyAccess: minutesUntilEarlyAccess > 0 ? minutesUntilEarlyAccess : 0
        },
        validation: {
          statusCheck: session.status === 'live',
          timingCheck: canAttend,
          overallValid: session.status === 'live' && canAttend
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/sessions/:sessionId/attendance', requireAuth, attendanceController.getAttendanceBySession);
router.put('/sessions/:sessionId/attendance/:studentId', requireAuth, requireRole(['admin', 'instructor']), attendanceController.updateAttendance);
router.get('/students/:studentId/attendance', requireAuth, attendanceController.getAttendanceByStudent);

router.get('/analytics/monthly', requireAuth, analyticsController.getMonthlyStats);
router.get('/analytics/live', requireAuth, analyticsController.getLiveSessionStats);
router.get('/analytics/session/year-wise', requireAuth, analyticsController.getSessionSummaryYearWise);
router.get('/analytics/current-sessions', requireAuth, analyticsController.getCurrentSessionsStats);
router.get('/analytics/batch/line', requireAuth, analyticsController.getBatchLineStats);
router.get('/analytics/batch-wise', requireAuth, analyticsController.getBatchWiseStats);
router.get('/analytics/batch/:batchId/courses', requireAuth, analyticsController.getBatchCoursesStats);
router.get('/analytics/batch/:batchId/course/:courseId', requireAuth, analyticsController.getBatchCourseAttendanceStats);
router.get('/analytics/batch/:batchId/course/:courseId/details', requireAuth, analyticsController.getCourseStudentAttendanceDetailsStats);
router.get('/analytics/batch/:batchId/students', requireAuth, analyticsController.getBatchStudentsStats);
router.get('/analytics/batch/:batchId/student/:studentId', requireAuth, analyticsController.getStudentCourseAttendanceStats);
router.get('/analytics/students/:id', requireAuth, studentAnalyticsController.getStudentAnalytics);
router.get('/analytics/students/:id/semester', requireAuth, studentAnalyticsController.getStudentSemesterAnalytics);
router.get('/analytics/top-attendees', requireAuth, studentAnalyticsController.getTopAttendees);

// Batches
router.get('/batches', requireAuth, batchesController.listBatches);
router.post('/batches', requireAuth, requireRole(['admin']), batchesController.createBatch);
router.get('/batches/:id/relations', requireAuth, batchesController.getBatchRelations);
router.put('/batches/:id', requireAuth, requireRole(['admin']), batchesController.updateBatch);
router.delete('/batches/:id', requireAuth, requireRole(['admin']), batchesController.deleteBatch);

router.get('/devices', requireAuth, requireRole(['admin']), devicesController.getDevices);
router.post('/devices', requireAuth, requireRole(['admin']), devicesController.createDevice);
router.put('/devices/:id', requireAuth, requireRole(['admin']), devicesController.updateDevice);
router.post('/devices/:id/rotate-key', requireAuth, requireRole(['admin']), devicesController.rotateDeviceKey);
router.delete('/devices/:id', requireAuth, requireRole(['admin']), devicesController.deleteDevice);

// Debug endpoint for testing device status (remove in production)
router.get('/devices/debug/:action', devicesController.debugDeviceStatus);

export default router;
