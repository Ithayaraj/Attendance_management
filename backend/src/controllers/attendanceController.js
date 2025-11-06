import { getSessionAttendance, updateAttendanceStatus } from '../services/attendanceService.js';
import { getStudentAttendance } from '../services/analyticsService.js';
import { broadcast } from '../realtime/ws.js';

export const getAttendanceBySession = async (req, res, next) => {
  try {
    const result = await getSessionAttendance(req.params.sessionId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const updateAttendance = async (req, res, next) => {
  try {
    const { sessionId, studentId } = req.params;
    const { status, notes } = req.body;

    const record = await updateAttendanceStatus(sessionId, studentId, status, notes);

    broadcast({
      type: 'attendance.updated',
      payload: {
        sessionId,
        studentId,
        status,
        notes
      }
    });

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceByStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { from, to } = req.query;

    const records = await getStudentAttendance(studentId, from, to);

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    next(error);
  }
};
