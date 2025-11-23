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
    
    // Log incoming scan for debugging
    console.log('\n========================================');
    console.log('📥 INCOMING SCAN REQUEST');
    console.log('========================================');
    console.log('Registration No:', registrationNo);
    console.log('Timestamp:', effectiveTimestamp);
    console.log('Device Key:', deviceApiKey);
    console.log('Source:', timestamp ? '🔄 OFFLINE SYNC' : '📡 LIVE SCAN');
    console.log('========================================\n');

    const result = await processScan(deviceApiKey, registrationNo, effectiveTimestamp, meta);

    console.log('=== Scan processed successfully, broadcasting ===');
    console.log('Already checked in:', result.alreadyCheckedIn);
    console.log('Student:', result.student.name, result.student.registrationNo);
    console.log('Course:', result.session.courseCode);
    console.log('Status:', result.attendanceRecord.status);

    const broadcastData = {
      type: result.alreadyCheckedIn ? 'scan.duplicate' : 'scan.ingested',
      payload: {
        studentId: result.student.id,
        studentName: result.student.name,
        registrationNo: result.student.registrationNo,
        sessionId: result.session.id,
        courseCode: result.session.courseCode,
        status: result.attendanceRecord.status,
        checkInAt: result.attendanceRecord.checkInAt,
        message: result.message
      }
    };

    console.log('Broadcasting data:', JSON.stringify(broadcastData, null, 2));
    broadcast(broadcastData);

    res.json({
      success: true,
      message: result.message,
      data: {
        student: result.student,
        session: result.session,
        status: result.attendanceRecord.status,
        checkInAt: result.attendanceRecord.checkInAt,
        duplicate: result.alreadyCheckedIn,
        message: result.message
      }
    });
  } catch (error) {
    // Broadcast error via WebSocket so frontend can show notification
    console.log('=== Scan error occurred, broadcasting error ===');
    console.log('Error:', error.message);
    console.log('Registration No:', req.body?.registrationNo || 'Unknown');
    
    const errorBroadcastData = {
      type: 'scan.error',
      payload: {
        registrationNo: req.body?.registrationNo || 'Unknown',
        error: error.message || 'Scan failed',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('Broadcasting error data:', JSON.stringify(errorBroadcastData, null, 2));
    broadcast(errorBroadcastData);
    next(error);
  }
};
