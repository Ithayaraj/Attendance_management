import { Student } from '../models/Student.js';
import { ClassSession } from '../models/ClassSession.js';
import { Scan } from '../models/Scan.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { Enrollment } from '../models/Enrollment.js';
import { Device } from '../models/Device.js';
import { formatTime, isTimeInRange, addMinutes } from '../utils/time.js';

const GRACE_PERIOD_MINUTES = 10;
const END_TOLERANCE_MINUTES = 5; // allow a small buffer after end time

/**
 * Extract department code from registration number
 * Format: YEAR/DEPT/NUMBER (e.g., 2019/ICTS/20 -> ICTS, 2019/BIO/01 -> BIO)
 */
const extractDeptFromRegNo = (registrationNo) => {
  if (!registrationNo) return null;
  const parts = registrationNo.split('/');
  if (parts.length >= 2) {
    return parts[1].toUpperCase().trim();
  }
  return null;
};

/**
 * Normalize department to a standard code for comparison
 * This maps various department name formats to a common code
 */
const normalizeDepartment = (dept) => {
  if (!dept) return '';
  const d = dept.toLowerCase().trim();

  // Map various formats to standard codes
  if (d.includes('ict') || d.includes('information') || d.includes('communication') || d.includes('technological')) {
    return 'ICTS';
  }
  if (d.includes('bio') || d === 'bio') {
    return 'BIO';
  }
  if (d.includes('physical') || d.includes('physics')) {
    return 'PHYS';
  }
  if (d.includes('business') || d.includes('economics')) {
    return 'BUS';
  }
  if (d.includes('human resource') || d.includes('hrm')) {
    return 'HRM';
  }
  if (d.includes('marketing')) {
    return 'MKT';
  }
  if (d.includes('management') || d.includes('entrepreneurship')) {
    return 'MGT';
  }
  if (d.includes('project')) {
    return 'PM';
  }
  if (d.includes('finance') || d.includes('accountancy')) {
    return 'FIN';
  }
  if (d.includes('banking') || d.includes('insurance')) {
    return 'BANK';
  }

  // Return uppercase of first 4 characters as fallback
  return d.replace(/[^a-z]/g, '').substring(0, 4).toUpperCase() || d.toUpperCase();
};

/**
 * Process a barcode scan for attendance marking
 * 
 * Validation Flow:
 * 1. Verify device is authorized
 * 2. Check if registration number exists in database
 * 3. Find active sessions matching student's year and semester (batch)
 * 4. Ensure only one session is live at a time for the batch
 * 5. Verify student is enrolled in the active course
 * 6. Check if scan is within session time window
 * 7. Mark attendance (present/late) or detect duplicate
 * 
 * This ensures:
 * - Only students from the correct batch can attend
 * - Only one course runs at a time per batch
 * - Students must be enrolled in the course
 */
export const processScan = async (deviceApiKey, registrationNo, timestamp, meta = {}) => {
  // Validate device
  const device = await Device.findOne({ apiKey: deviceApiKey });

  if (!device) {
    throw new Error('Invalid device key');
  }

  device.lastSeenAt = new Date();
  device.status = 'online';
  await device.save();

  // Check if student exists in database
  const student = await Student.findOne({ registrationNo });

  if (!student) {
    throw new Error(`ID ${registrationNo} not found`);
  }

  // Ensure student has year, semester, and department
  if (!student.year || !student.semester) {
    throw new Error(`Student ${registrationNo} is missing year/semester data. Please update student record.`);
  }

  if (!student.department) {
    throw new Error(`Student ${registrationNo} is missing department data. Please update student record.`);
  }

  const scannedAt = new Date(timestamp);

  // IMPORTANT: For offline scans, timestamp might be in milliseconds since ESP32 boot (millis())
  // Check if timestamp looks like millis() (small number) vs actual timestamp (large number)
  const isMillisTimestamp = timestamp && typeof timestamp === 'number' && timestamp < 10000000000;

  let actualScanDate;
  if (isMillisTimestamp) {
    // This is millis() from ESP32 - use current date/time instead
    console.log('⚠️  Timestamp appears to be millis(), using current time');
    actualScanDate = new Date();
  } else {
    // This is a real timestamp or ISO string
    actualScanDate = scannedAt;
  }

  // FORCE TIMESTAMP TO SRI LANKA TIME (IST = UTC+5:30)
  // This ensures consistent behavior regardless of server location (Localhost vs Vercel)
  // We shift the time by +5.5 hours so that the UTC components of the new date object
  // match the local time in Sri Lanka.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(actualScanDate.getTime() + IST_OFFSET_MS);
  const istIso = istDate.toISOString(); // Numbers now represent IST time

  const scannedDate = istIso.split('T')[0];
  const scannedTime = istIso.split('T')[1].substring(0, 5); // HH:MM

  console.log('📅 Scan timestamp analysis (Adjusted to IST):');
  console.log('   Raw timestamp:', timestamp);
  console.log('   Actual scan date:', scannedDate);
  console.log('   Actual scan time:', scannedTime);

  // Convert to numbers to ensure type consistency
  const studentYear = Number(student.year);
  const studentSemester = Number(student.semester);

  // Extract department code from registration number (most reliable source)
  // Format: YEAR/DEPT/NUMBER (e.g., 2019/ICTS/20 -> ICTS, 2019/BIO/01 -> BIO)
  const deptFromRegNo = extractDeptFromRegNo(registrationNo);

  // Use registration number department code, or normalize the stored department as fallback
  const studentDeptCode = deptFromRegNo || normalizeDepartment(student.department);

  console.log(`=== Attendance Validation Debug ===`);
  console.log(`Student: ${student.name} (${registrationNo})`);
  console.log(`Student Department (from regNo): ${deptFromRegNo}`);
  console.log(`Student Department (stored): ${student.department}`);
  console.log(`Student Department Code (normalized): ${studentDeptCode}`);
  console.log(`Student Batch: Y${studentYear}S${studentSemester}`);
  console.log(`Scan Date: ${scannedDate}`);
  console.log(`Scan Time: ${scannedTime}`);

  // Step 1: Find active sessions for the scanned date
  // Check yesterday, today, and tomorrow (in IST context)
  const datesToCheck = [scannedDate];

  const istYesterday = new Date(istDate.getTime() - 24 * 60 * 60 * 1000);
  const istTomorrow = new Date(istDate.getTime() + 24 * 60 * 60 * 1000);

  datesToCheck.push(
    istYesterday.toISOString().split('T')[0],
    istTomorrow.toISOString().split('T')[0]
  );

  console.log('🔍 Checking dates for sessions:', datesToCheck);

  let session = null;

  // Check if device is already locked to a session
  if (device.activeSessionId) {
    const lockedSession = await ClassSession.findById(device.activeSessionId).populate('courseId');

    // Check validity: exists, not closed, and date matches (today or recent offline sync)
    if (lockedSession && lockedSession.status !== 'closed' && datesToCheck.includes(lockedSession.date)) {
      // Session is valid, now check if student belongs to this batch (department + year + semester)
      // Normalize session department for comparison
      const sessionDeptCode = normalizeDepartment(lockedSession.department);
      const deptMatch = sessionDeptCode === studentDeptCode;
      const yearMatch = Number(lockedSession.year) === studentYear;
      const semMatch = Number(lockedSession.semester) === studentSemester;

      console.log(`🔒 Device lock check:`);
      console.log(`   Session dept: ${lockedSession.department} -> ${sessionDeptCode}`);
      console.log(`   Student dept: ${registrationNo} -> ${studentDeptCode}`);
      console.log(`   Dept match: ${deptMatch}, Year match: ${yearMatch}, Sem match: ${semMatch}`);

      if (!deptMatch || !yearMatch || !semMatch) {
        const sessionBatch = `${sessionDeptCode} Y${lockedSession.year}S${lockedSession.semester}`;
        const studentBatchStr = `${studentDeptCode} Y${studentYear}S${studentSemester}`;
        throw new Error(`Session is for ${sessionBatch} (${lockedSession.courseId.code}). You are ${studentBatchStr}.`);
      }

      session = lockedSession;
      console.log(`🔒 Device is correctly locked to session: ${session.courseId.code}`);
    } else {
      console.log('🔓 Device lock is stale or invalid, clearing...');
      device.activeSessionId = null;
      await device.save();
    }
  }

  // If no session found via lock, perform dynamic discovery
  if (!session) {
    // Query ALL sessions for the date range, then filter by normalized department code
    // This is necessary because department names may have different formats
    const allSessions = await ClassSession.find({
      date: { $in: datesToCheck },
      year: studentYear,
      semester: studentSemester,
      status: { $in: ['live', 'scheduled', 'completed'] }
    }).populate('courseId').sort({ date: -1 });

    // Filter sessions by matching normalized department code
    const activeSessions = allSessions.filter(s => {
      const sessionDeptCode = normalizeDepartment(s.department);
      return sessionDeptCode === studentDeptCode;
    });

    console.log(`Found ${allSessions.length} total sessions for Y${studentYear}S${studentSemester}`);
    console.log(`Filtered to ${activeSessions.length} sessions matching dept code ${studentDeptCode}`);
    allSessions.forEach(s => {
      const sDeptCode = normalizeDepartment(s.department);
      const match = sDeptCode === studentDeptCode ? '✅' : '❌';
      console.log(`  ${match} ${s.courseId.code} (${s.department} -> ${sDeptCode}) Y${s.year}S${s.semester} - ${s.status}`);
    });

    if (activeSessions.length === 0) {
      // Check if there are sessions for other batches today
      const otherBatchSessions = await ClassSession.find({
        date: scannedDate,
        status: { $in: ['live', 'scheduled'] }
      }).populate('courseId');

      // Filter to sessions NOT matching student's batch
      const nonMatchingSessions = otherBatchSessions.filter(s => {
        const sDeptCode = normalizeDepartment(s.department);
        return sDeptCode !== studentDeptCode ||
          Number(s.year) !== studentYear ||
          Number(s.semester) !== studentSemester;
      });

      console.log(`Found ${nonMatchingSessions.length} sessions for other batches`);
      nonMatchingSessions.forEach(s => {
        const sDeptCode = normalizeDepartment(s.department);
        console.log(`  - ${s.courseId.code} (${sDeptCode} Y${s.year}S${s.semester}) - ${s.status}`);
      });

      if (nonMatchingSessions.length > 0) {
        const otherBatches = [...new Set(nonMatchingSessions.map(s => {
          const sDeptCode = normalizeDepartment(s.department);
          return `${sDeptCode} Y${s.year}S${s.semester}`;
        }))].join(', ');
        throw new Error(`No session for your batch (${studentDeptCode} Y${studentYear}S${studentSemester}). Active sessions: ${otherBatches}`);
      }

      throw new Error(`No session for ${studentDeptCode} Y${studentYear}S${studentSemester} today`);
    }

    // Step 2: Ensure only one live session exists for this department+year+semester combination
    const liveSessions = activeSessions.filter(s => s.status === 'live');
    console.log(`Live sessions: ${liveSessions.length}`);
    if (liveSessions.length > 1) {
      const courseCodes = liveSessions.map(s => s.courseId.code).join(', ');
      throw new Error(`Multiple sessions live for ${studentDeptCode} Y${studentYear}S${studentSemester}: ${courseCodes}. Contact admin`);
    }

    // Step 3: Select the active session
    // Prioritize order: LIVE > SCHEDULED > COMPLETED
    if (liveSessions.length > 0) {
      session = liveSessions[0];
    } else {
      const scheduledSessions = activeSessions.filter(s => s.status === 'scheduled');
      const completedSessions = activeSessions.filter(s => s.status === 'completed');

      if (scheduledSessions.length > 0) {
        session = scheduledSessions[0];
      } else if (completedSessions.length > 0) {
        session = completedSessions[0];
      } else {
        session = activeSessions[0];
      }
    }

    if (!session) {
      throw new Error(`No active session found for ${studentDeptCode} Y${studentYear}S${studentSemester}`);
    }

    // Lock the device to this newly found session
    device.activeSessionId = session._id;
    await device.save();
    console.log(`🔐 Device locked to new session: ${session.courseId.code}`);
  }

  console.log(`Selected session: ${session.courseId.code} (no enrollment check)`);

  // Note: Enrollment check is disabled. All students from the correct batch can attend.

  // Step 4: Double-check session matches student's batch (redundant safety check including department)
  const sessionYear = Number(session.year);
  const sessionSemester = Number(session.semester);
  const sessionDeptCode = normalizeDepartment(session.department);

  if (sessionDeptCode !== studentDeptCode || sessionYear !== studentYear || sessionSemester !== studentSemester) {
    console.log(`BATCH MISMATCH DETECTED!`);
    console.log(`  Session: ${sessionDeptCode} Y${sessionYear}S${sessionSemester}`);
    console.log(`  Student: ${studentDeptCode} Y${studentYear}S${studentSemester}`);
    throw new Error(`Batch mismatch! Session is for ${sessionDeptCode} Y${sessionYear}S${sessionSemester}, you are ${studentDeptCode} Y${studentYear}S${studentSemester}`);
  }

  console.log(`✅ Batch validation passed (${studentDeptCode} Y${studentYear}S${studentSemester})`);
  console.log(`=== End Debug ===\n`);

  // Step 5: Check if scan is within valid time window
  // Grace period: students arriving within GRACE_PERIOD_MINUTES are marked "present"
  // After grace period but before end: marked "late"
  // After session end: rejected
  // Step 5: Check if scan is within valid time window
  // Use absolute time difference to handle date wraparounds and "Early Access" validation
  // We treat session times as UTC to match the 'istDate' which stores Local Time in UTC components
  const sessionStartIso = `${session.date}T${session.startTime}:00Z`;
  let sessionStart = new Date(sessionStartIso);

  // Calculate difference in minutes
  // istDate is the scan time (shifted to look like Local Time in UTC)
  const diffMinutes = (istDate.getTime() - sessionStart.getTime()) / 60000;

  const EARLY_ACCESS_MINUTES = 15;

  console.log(`⏱️ Time Check:`);
  console.log(`   Session Start: ${sessionStartIso}`);
  console.log(`   Scan Time: ${istDate.toISOString()}`);
  console.log(`   Diff Minutes: ${diffMinutes.toFixed(2)}`);

  if (diffMinutes < -EARLY_ACCESS_MINUTES) {
    throw new Error(`Session has not started yet. Starts at ${session.startTime}.`);
  }

  // Grace period and End window logic
  // Grace period: students arriving within GRACE_PERIOD_MINUTES are marked "present"
  // After grace period but before end: marked "late"
  // After session end: rejected

  // Calculate absolute End Date
  let sessionEndIso = `${session.date}T${session.endTime}:00Z`;
  let sessionEnd = new Date(sessionEndIso);

  if (sessionEnd < sessionStart) {
    // Handle wrap-around (Next Day)
    sessionEnd = new Date(sessionEnd.getTime() + 24 * 60 * 60 * 1000);
  }

  const minutesPastEnd = (istDate.getTime() - sessionEnd.getTime()) / 60000;

  if (minutesPastEnd > END_TOLERANCE_MINUTES) {
    throw new Error(`Session ended at ${session.endTime}`);
  }

  let attendanceStatus = 'absent';

  if (diffMinutes <= GRACE_PERIOD_MINUTES) {
    attendanceStatus = 'present';
  } else {
    attendanceStatus = 'late';
  }

  // Step 6: Record the scan
  const scan = await Scan.create({
    deviceId: device._id,
    barcode: registrationNo,
    scannedAt,
    meta,
    sessionId: session._id,
    courseId: session.courseId
  });

  // Step 7: Check for existing attendance record (duplicate detection)
  const existingRecord = await AttendanceRecord.findOne({
    sessionId: session._id,
    studentId: student._id
  });

  let attendanceRecord;

  if (existingRecord) {
    // Update only if improving status (absent -> late/present, or late -> present)
    if (existingRecord.status === 'absent' ||
      (existingRecord.status === 'late' && attendanceStatus === 'present')) {
      existingRecord.status = attendanceStatus;
      existingRecord.checkInAt = scannedAt;
      existingRecord.sourceScanId = scan._id;
      attendanceRecord = await existingRecord.save();
    } else {
      // Duplicate scan - no update needed
      attendanceRecord = existingRecord;
    }
  } else {
    // CRITICAL SAFETY CHECK: Final verification before creating attendance record
    // This is the last line of defense against cross-department attendance
    const finalStudentDept = extractDeptFromRegNo(student.registrationNo) || normalizeDepartment(student.department);
    const finalSessionDept = normalizeDepartment(session.department);

    if (finalStudentDept && finalSessionDept && finalStudentDept !== finalSessionDept) {
      console.log(`🚫 CRITICAL: Blocking cross-department attendance!`);
      console.log(`   Student: ${student.registrationNo} -> ${finalStudentDept}`);
      console.log(`   Session: ${session.courseId?.code} -> ${finalSessionDept}`);
      throw new Error(`Department mismatch: ${finalStudentDept} student cannot attend ${finalSessionDept} session`);
    }

    // First scan - create new attendance record
    attendanceRecord = await AttendanceRecord.create({
      sessionId: session._id,
      studentId: student._id,
      status: attendanceStatus,
      checkInAt: scannedAt,
      sourceScanId: scan._id
    });
  }

  await attendanceRecord.populate('studentId sessionId');

  const isDuplicate = !!existingRecord && existingRecord.checkInAt && existingRecord.status !== 'absent';

  // Create detailed success message based on attendance status
  let successMessage = '';
  if (isDuplicate) {
    successMessage = `Already marked ${existingRecord.status}`;
  } else {
    // Detailed message showing course and batch info
    const batchInfo = `Y${session.year}S${session.semester}`;
    if (attendanceStatus === 'present') {
      successMessage = `Allowed! ${session.courseId.code} (${batchInfo}) - On Time`;
    } else if (attendanceStatus === 'late') {
      successMessage = `Allowed! ${session.courseId.code} (${batchInfo}) - Late`;
    } else {
      successMessage = `Allowed! ${session.courseId.code} (${batchInfo})`;
    }
  }

  return {
    scan,
    attendanceRecord,
    student: {
      id: student._id,
      name: student.name,
      registrationNo: student.registrationNo,
      year: student.year,
      semester: student.semester
    },
    session: {
      id: session._id,
      courseCode: session.courseId.code,
      courseName: session.courseId.name,
      date: session.date,
      startTime: session.startTime,
      year: session.year,
      semester: session.semester
    },
    alreadyCheckedIn: isDuplicate,
    message: successMessage
  };
};

export const getSessionAttendance = async (sessionId) => {
  const session = await ClassSession.findById(sessionId).populate('courseId');

  if (!session) {
    throw new Error('Session not found');
  }

  const records = await AttendanceRecord.find({ sessionId })
    .populate('studentId')
    .sort({ checkInAt: 1 });

  // Mark not-yet-checked-in students as absent (virtual list)
  // Get all students matching the session's department, year, and semester
  const allStudents = await Student.find({
    department: session.courseId?.department,
    year: session.year,
    semester: session.semester
  });

  const presentIds = new Set(records.map(r => String(r.studentId._id)));
  const virtualAbsents = allStudents
    .filter(student => !presentIds.has(String(student._id)))
    .map(student => ({
      _id: `virtual-${student._id}`,
      sessionId,
      studentId: student,
      status: 'absent',
      checkInAt: null
    }));

  return {
    session,
    records: [...records, ...virtualAbsents]
  };
};

export const updateAttendanceStatus = async (sessionId, studentId, status, notes) => {
  const record = await AttendanceRecord.findOne({ sessionId, studentId });

  if (!record) {
    throw new Error('Attendance record not found');
  }

  record.status = status;
  if (notes) record.notes = notes;

  await record.save();
  await record.populate('studentId');

  return record;
};
