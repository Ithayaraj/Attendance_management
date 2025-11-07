import { processScan } from '../services/attendanceService.js';
import { broadcast } from '../realtime/ws.js';

export const ingestScan = async (req, res, next) => {
  try {
    const deviceApiKey = req.headers['x-device-key'];

    if (!deviceApiKey) {
      return res.status(401).json({
        success: false,
        message: 'Device key required'
      });
    }

    const { registrationNo, timestamp, meta } = req.body;

    if (!registrationNo) {
      return res.status(400).json({
        success: false,
        message: 'Registration number required'
      });
    }

    const effectiveTimestamp = timestamp || new Date().toISOString();

    const result = await processScan(deviceApiKey, registrationNo, effectiveTimestamp, meta);

    broadcast({
      type: result.alreadyCheckedIn ? 'scan.duplicate' : 'scan.ingested',
      payload: {
        studentId: result.student.id,
        studentName: result.student.name,
        registrationNo: result.student.registrationNo,
        sessionId: result.session.id,
        courseCode: result.session.courseCode,
        status: result.attendanceRecord.status,
        checkInAt: result.attendanceRecord.checkInAt
      }
    });

    res.json({
      success: true,
      data: {
        student: result.student,
        session: result.session,
        status: result.attendanceRecord.status,
        checkInAt: result.attendanceRecord.checkInAt,
        duplicate: result.alreadyCheckedIn
      }
    });
  } catch (error) {
    // Broadcast error via WebSocket so frontend can show notification
    broadcast({
      type: 'scan.error',
      payload: {
        registrationNo: req.body?.registrationNo || 'Unknown',
        error: error.message || 'Scan failed',
        timestamp: new Date().toISOString()
      }
    });
    next(error);
  }
};
