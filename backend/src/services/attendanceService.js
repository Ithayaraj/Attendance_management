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

  // Ensure student has year and semester
  if (!student.year || !student.semester) {
    throw new Error(`Student ${registrationNo} is missing year/semester data. Please update student record.`);
  }

  const scannedAt = new Date(timestamp);
  // Use server local date (not UTC) to match how sessions are stored (YYYY-MM-DD)
  const localIso = new Date(scannedAt.getTime() - scannedAt.getTimezoneOffset() * 60000).toISOString();
  const scannedDate = localIso.split('T')[0];
  const scannedTime = formatTime(scannedAt);

  // Convert to numbers to ensure type consistency
  const studentYear = Number(student.year);
  const studentSemester = Number(student.semester);

  console.log(`=== Attendance Validation Debug ===`);
  console.log(`Student: ${student.name} (${registrationNo})`);
  console.log(`Student Batch: Y${studentYear}S${studentSemester}`);
  console.log(`Scan Date: ${scannedDate}`);
  console.log(`Scan Time: ${scannedTime}`);

  // Step 1: Find active sessions for the scanned date, matching student's year and semester
  // CRITICAL: This ensures only courses for the student's batch (year + semester) are considered
  // Students from other batches will be automatically rejected here
  const activeSessions = await ClassSession.find({
    date: scannedDate,
    year: studentYear,
    semester: studentSemester,
    status: { $in: ['live', 'scheduled'] }
  }).populate('courseId');

  console.log(`Found ${activeSessions.length} active sessions for Y${studentYear}S${studentSemester}`);
  activeSessions.forEach(s => {
    console.log(`  - ${s.courseId.code} (Y${s.year}S${s.semester}) - ${s.status}`);
  });

  if (activeSessions.length === 0) {
    // Check if there are sessions for other batches today
    const otherBatchSessions = await ClassSession.find({
      date: scannedDate,
      status: { $in: ['live', 'scheduled'] },
      $or: [
        { year: { $ne: studentYear } },
        { semester: { $ne: studentSemester } }
      ]
    }).populate('courseId');

    console.log(`Found ${otherBatchSessions.length} sessions for other batches`);
    otherBatchSessions.forEach(s => {
      console.log(`  - ${s.courseId.code} (Y${s.year}S${s.semester}) - ${s.status}`);
    });

    if (otherBatchSessions.length > 0) {
      const otherBatches = [...new Set(otherBatchSessions.map(s => `Y${s.year}S${s.semester}`))].join(', ');
      throw new Error(`No session for your batch (Y${studentYear}S${studentSemester}). Sessions today: ${otherBatches}`);
    }
    
    throw new Error(`No session for Y${studentYear}S${studentSemester} today`);
  }

  // Step 2: Ensure only one live session exists for this year+semester combination
  // At a time, only one course should be running for a specific batch
  const liveSessions = activeSessions.filter(s => s.status === 'live');
  console.log(`Live sessions: ${liveSessions.length}`);
  if (liveSessions.length > 1) {
    const courseCodes = liveSessions.map(s => s.courseId.code).join(', ');
    throw new Error(`Multiple sessions live for Y${studentYear}S${studentSemester}: ${courseCodes}. Contact admin`);
  }

  // Step 3: Get all course IDs from active sessions
  const courseIds = activeSessions.map(s => s.courseId._id);

  // Find all enrollments for this student in these courses
  // This checks if the student is registered for any of the active courses
  const enrollments = await Enrollment.find({
    courseId: { $in: courseIds },
    studentId: student._id,
    status: 'active'
  });

  // Step 4: Find the session for which the student is enrolled
  // This ensures the student is registered for the course before marking attendance
  const enrolledCourseIds = new Set(enrollments.map(e => String(e.courseId)));
  console.log(`Student enrolled in ${enrollments.length} courses from active sessions`);
  
  const session = activeSessions.find(s => enrolledCourseIds.has(String(s.courseId._id)));

  if (!session) {
    const courseCodes = activeSessions.map(s => s.courseId.code).join(', ');
    throw new Error(`Not enrolled! Active courses for Y${studentYear}S${studentSemester}: ${courseCodes}`);
  }

  console.log(`Selected session: ${session.courseId.code} (Y${session.year}S${session.semester})`);

  // Step 4.1: Double-check session matches student's batch (redundant safety check)
  const sessionYear = Number(session.year);
  const sessionSemester = Number(session.semester);
  
  if (sessionYear !== studentYear || sessionSemester !== studentSemester) {
    console.log(`BATCH MISMATCH DETECTED!`);
    console.log(`  Session: Y${sessionYear}S${sessionSemester}`);
    console.log(`  Student: Y${studentYear}S${studentSemester}`);
    throw new Error(`Batch mismatch! Session is for Y${sessionYear}S${sessionSemester}, you are Y${studentYear}S${studentSemester}`);
  }

  console.log(`✅ Batch validation passed`);
  console.log(`=== End Debug ===\n`);

  // Step 5: Check if scan is within valid time window
  // Grace period: students arriving within GRACE_PERIOD_MINUTES are marked "present"
  // After grace period but before end: marked "late"
  // After session end: rejected
  const adjustedEnd = addMinutes(session.endTime, END_TOLERANCE_MINUTES);
  const timeCheck = isTimeInRange(scannedTime, session.startTime, adjustedEnd, GRACE_PERIOD_MINUTES);

  let attendanceStatus = 'absent';
  if (timeCheck.isBeforeGrace) {
    attendanceStatus = 'present';
  } else if (timeCheck.isBeforeEnd) {
    attendanceStatus = 'late';
  } else {
    throw new Error(`Session ended at ${session.endTime}`);
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
  const enrollments = await Enrollment.find({ courseId: session.courseId._id }).populate('studentId');
  const presentIds = new Set(records.map(r => String(r.studentId._id)));
  const virtualAbsents = enrollments
    .filter(e => !presentIds.has(String(e.studentId._id)))
    .map(e => ({
      _id: `virtual-${e.studentId._id}`,
      sessionId,
      studentId: e.studentId,
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
