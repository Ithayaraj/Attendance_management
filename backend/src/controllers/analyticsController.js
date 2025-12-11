import { getMonthlyAnalytics, getLiveSessionAnalytics, getSessionSummaryByYear, getBatchLineAnalytics, getCurrentSessions, getBatchWiseAttendance, getBatchCourseAttendance, getBatchCourses, getBatchStudents, getStudentCourseAttendance, getCourseStudentAttendanceDetails } from '../services/analyticsService.js';

export const getMonthlyStats = async (req, res, next) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'Month parameter required (format: YYYY-MM)'
      });
    }

    const analytics = await getMonthlyAnalytics(month);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

export const getLiveSessionStats = async (req, res, next) => {
  try {
    const data = await getLiveSessionAnalytics();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getSessionSummaryYearWise = async (req, res, next) => {
  try {
    const data = await getSessionSummaryByYear();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBatchLineStats = async (req, res, next) => {
  try {
    const { startYear } = req.query;
    if (!startYear) {
      return res.status(400).json({ success: false, message: 'startYear is required' });
    }
    const data = await getBatchLineAnalytics(startYear);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCurrentSessionsStats = async (req, res, next) => {
  try {
    const data = await getCurrentSessions();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBatchWiseStats = async (req, res, next) => {
  try {
    const data = await getBatchWiseAttendance();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBatchCoursesStats = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const data = await getBatchCourses(batchId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBatchCourseAttendanceStats = async (req, res, next) => {
  try {
    const { batchId, courseId } = req.params;
    const { startDate, endDate } = req.query;
    const data = await getBatchCourseAttendance(batchId, courseId, startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBatchStudentsStats = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;
    const data = await getBatchStudents(batchId, parseInt(page), parseInt(limit), search);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getStudentCourseAttendanceStats = async (req, res, next) => {
  try {
    const { batchId, studentId } = req.params;
    const { startDate, endDate, courseId } = req.query;
    const data = await getStudentCourseAttendance(studentId, batchId, startDate, endDate, courseId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCourseStudentAttendanceDetailsStats = async (req, res, next) => {
  try {
    const { batchId, courseId } = req.params;
    const { startDate, endDate } = req.query;
    const data = await getCourseStudentAttendanceDetails(batchId, courseId, startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
