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
router.put('/batches/:id', requireAuth, requireRole(['admin']), batchesController.updateBatch);
router.delete('/batches/:id', requireAuth, requireRole(['admin']), batchesController.deleteBatch);

router.get('/devices', requireAuth, requireRole(['admin']), devicesController.getDevices);
router.post('/devices', requireAuth, requireRole(['admin']), devicesController.createDevice);
router.patch('/devices/:id', requireAuth, requireRole(['admin']), devicesController.updateDevice);
router.post('/devices/:id/rotate-key', requireAuth, requireRole(['admin']), devicesController.rotateDeviceKey);

export default router;
