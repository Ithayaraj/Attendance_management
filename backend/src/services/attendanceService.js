import { Student } from '../models/Student.js';
import { ClassSession } from '../models/ClassSession.js';
import { Scan } from '../models/Scan.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { Enrollment } from '../models/Enrollment.js';
import { Device } from '../models/Device.js';
import { formatTime, isTimeInRange, addMinutes } from '../utils/time.js';

const GRACE_PERIOD_MINUTES = 10;
const END_TOLERANCE_MINUTES = 5; // allow a small buffer after end time

export const processScan = async (deviceApiKey, registrationNo, timestamp, meta = {}) => {
  const device = await Device.findOne({ apiKey: deviceApiKey });

  if (!device) {
    throw new Error('Invalid device key');
  }

  device.lastSeenAt = new Date();
  device.status = 'online';
  await device.save();

  const student = await Student.findOne({ registrationNo });

  if (!student) {
    throw new Error('Student not found');
  }

  const scannedAt = new Date(timestamp);
  // Use server local date (not UTC) to match how sessions are stored (YYYY-MM-DD)
  const localIso = new Date(scannedAt.getTime() - scannedAt.getTimezoneOffset() * 60000).toISOString();
  const scannedDate = localIso.split('T')[0];
  const scannedTime = formatTime(scannedAt);

  const session = await ClassSession.findOne({
    date: scannedDate,
    status: { $in: ['live', 'scheduled'] }
  }).populate('courseId');

  if (!session) {
    throw new Error('No active session found');
  }

  // extend end time tolerance by a few minutes to avoid boundary cutoffs
  const adjustedEnd = addMinutes(session.endTime, END_TOLERANCE_MINUTES);
  const timeCheck = isTimeInRange(scannedTime, session.startTime, adjustedEnd, GRACE_PERIOD_MINUTES);

  let attendanceStatus = 'absent';
  if (timeCheck.isBeforeGrace) {
    attendanceStatus = 'present';
  } else if (timeCheck.isBeforeEnd) {
    attendanceStatus = 'late';
  } else {
    throw new Error('Session has ended');
  }

  const scan = await Scan.create({
    deviceId: device._id,
    barcode: registrationNo,
    scannedAt,
    meta,
    sessionId: session._id,
    courseId: session.courseId
  });

  const existingRecord = await AttendanceRecord.findOne({
    sessionId: session._id,
    studentId: student._id
  });

  let attendanceRecord;

  if (existingRecord) {
    if (existingRecord.status === 'absent' ||
        (existingRecord.status === 'late' && attendanceStatus === 'present')) {
      existingRecord.status = attendanceStatus;
      existingRecord.checkInAt = scannedAt;
      existingRecord.sourceScanId = scan._id;
      attendanceRecord = await existingRecord.save();
    } else {
      attendanceRecord = existingRecord;
    }
  } else {
    attendanceRecord = await AttendanceRecord.create({
      sessionId: session._id,
      studentId: student._id,
      status: attendanceStatus,
      checkInAt: scannedAt,
      sourceScanId: scan._id
    });
  }

  await attendanceRecord.populate('studentId sessionId');

  return {
    scan,
    attendanceRecord,
    student: {
      id: student._id,
      name: student.name,
      registrationNo: student.registrationNo
    },
    session: {
      id: session._id,
      courseCode: session.courseId.code,
      courseName: session.courseId.name,
      date: session.date,
      startTime: session.startTime
    },
    alreadyCheckedIn: !!existingRecord && existingRecord.checkInAt && existingRecord.status !== 'absent'
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
