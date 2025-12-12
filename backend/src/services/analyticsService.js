import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { ClassSession } from '../models/ClassSession.js';
import { Enrollment } from '../models/Enrollment.js';
import { Scan } from '../models/Scan.js';
import { Student } from '../models/Student.js';

export const getMonthlyAnalytics = async (month) => {
  const [year, monthNum] = month.split('-');
  const startDate = `${year}-${monthNum}-01`;
  const endDate = `${year}-${monthNum}-31`;

  const sessions = await ClassSession.find({
    date: { $gte: startDate, $lte: endDate }
  }).select('_id courseId').populate('courseId', 'code name');

  const sessionIds = sessions.map(s => s._id);

  const records = await AttendanceRecord.find({
    sessionId: { $in: sessionIds }
  });

  const summary = {
    present: 0,
    late: 0,
    absent: 0
  };

  const byCourse = {};

  for (const record of records) {
    summary[record.status]++;

    const session = sessions.find(s => s._id.toString() === record.sessionId.toString());
    if (session && session.courseId) {
      const courseKey = session.courseId.code;
      if (!byCourse[courseKey]) {
        byCourse[courseKey] = {
          code: session.courseId.code,
          name: session.courseId.name,
          present: 0,
          late: 0,
          absent: 0
        };
      }
      byCourse[courseKey][record.status]++;
    }
  }

  return {
    summary: [
      { name: 'Present', value: summary.present },
      { name: 'Late', value: summary.late },
      { name: 'Absent', value: summary.absent }
    ],
    byCourse: Object.values(byCourse)
  };
};

export const getLiveSessionAnalytics = async () => {
  const session = await ClassSession.findOne({ status: 'live' }).populate('courseId');
  if (!session) {
    return { session: null, summary: [], byCourse: [], images: [] };
  }

  const records = await AttendanceRecord.find({ sessionId: session._id });

  const summary = { present: 0, late: 0, absent: 0 };
  for (const r of records) summary[r.status]++;

  // recent scan images or metadata (if any URLs in meta)
  const scans = await Scan.find({ sessionId: session._id }).sort({ scannedAt: -1 }).limit(10);
  const images = scans
    .map(s => s.meta?.imageUrl)
    .filter(Boolean);

  return {
    session: {
      id: session._id,
      courseCode: session.courseId?.code,
      courseName: session.courseId?.name,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
    },
    summary: [
      { name: 'Present', value: summary.present },
      { name: 'Late', value: summary.late },
      { name: 'Absent', value: summary.absent },
    ],
    images
  };
};

export const getSessionSummaryByYear = async () => {
  // Find live session; if none, take last by date/time
  let session = await ClassSession.findOne({ status: 'live' }).populate('courseId');
  let mode = 'live';
  if (!session) {
    mode = 'last';
    session = await ClassSession.findOne({}).sort({ date: -1, startTime: -1 }).populate('courseId');
    if (!session) {
      return { mode: 'none', session: null, totals: null, perYear: [], images: [] };
    }
  }

  const records = await AttendanceRecord.find({ sessionId: session._id }).populate('studentId');

  // Build totals
  const totals = { present: 0, late: 0, absent: 0 };
  for (const r of records) totals[r.status]++;

  // Year-wise initialize 1..6 to be safe
  const perYearMap = new Map();
  const ensureYear = (y) => {
    if (!perYearMap.has(y)) perYearMap.set(y, { year: y, present: 0, late: 0, absent: 0 });
    return perYearMap.get(y);
  };

  for (const r of records) {
    const y = r.studentId?.year || 0;
    const bucket = ensureYear(y);
    bucket[r.status]++;
  }

  // Add virtual absents for students in the same batch who have no record
  // Get all students matching the session's department, year, and semester
  const allStudents = await Student.find({
    department: session.courseId?.department,
    year: session.year,
    semester: session.semester
  });

  const presentIds = new Set(records.map(r => String(r.studentId?._id)));
  for (const student of allStudents) {
    const sid = String(student._id);
    if (!presentIds.has(sid)) {
      const y = student.year || 0;
      const bucket = ensureYear(y);
      bucket.absent++;
      totals.absent++;
    }
  }

  const perYear = Array.from(perYearMap.values()).sort((a, b) => a.year - b.year);

  // recent images
  const scans = await Scan.find({ sessionId: session._id }).sort({ scannedAt: -1 }).limit(10);
  const images = scans.map(s => s.meta?.imageUrl).filter(Boolean);

  return {
    mode,
    session: {
      id: session._id,
      courseCode: session.courseId?.code,
      courseName: session.courseId?.name,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
    },
    totals,
    perYear,
    images,
  };
};

export const getBatchLineAnalytics = async (startYear) => {
  const startYearNum = Number(startYear);
  if (!startYearNum) return { points: [] };

  // last 12 months window
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }

  // fetch records within these months
  const startStr = months[0] + '-01';
  const endStr = months[months.length - 1] + '-31';

  const sessions = await ClassSession.find({
    date: { $gte: startStr, $lte: endStr }
  }).select('_id date');
  const sessionById = new Map(sessions.map(s => [String(s._id), s]));
  const sessionIds = sessions.map(s => s._id);

  const records = await AttendanceRecord.find({ sessionId: { $in: sessionIds } })
    .populate('studentId', 'year');

  const pointsMap = new Map(months.map(m => [m, { month: m, present: 0, late: 0, absent: 0 }]));

  const currentCalendarYear = new Date().getFullYear();

  for (const r of records) {
    const sess = sessionById.get(String(r.sessionId));
    if (!sess) continue;
    const monthKey = sess.date.slice(0, 7);
    if (!pointsMap.has(monthKey)) continue;
    const student = r.studentId;
    if (!student) continue;
    const inferredStartYear = currentCalendarYear - (Number(student.year || 1) - 1);
    if (inferredStartYear !== startYearNum) continue;
    const bucket = pointsMap.get(monthKey);
    bucket[r.status]++;
  }

  return { points: Array.from(pointsMap.values()) };
};

export const getCurrentSessions = async () => {
  // Get yesterday's, today's, and tomorrow's sessions (to handle timezone differences and midnight rollover)
  const now = new Date();
  const today = new Date().toISOString().slice(0, 10);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  console.log(`📅 getCurrentSessions - Yesterday: ${yesterdayStr}, Today: ${today}, Tomorrow: ${tomorrowStr}, Current time: ${now.toISOString()}`);

  const sessions = await ClassSession.find({
    date: { $in: [yesterdayStr, today, tomorrowStr] },
    status: { $in: ['live', 'scheduled'] }
  })
    .populate('courseId')
    .sort({ year: 1, semester: 1, startTime: 1 }); // Sort hierarchically: year -> semester -> time

  console.log(`📊 Found ${sessions.length} sessions with live/scheduled status`);
  sessions.forEach(s => {
    console.log(`  - ${s.courseId?.code}: ${s.date} ${s.startTime}-${s.endTime} [${s.status}]`);
  });

  // Helper function to check if session has ended
  const hasSessionEnded = (session) => {
    const [startHour, startMinute] = session.startTime.split(':').map(Number);
    const [endHour, endMinute] = session.endTime.split(':').map(Number);

    const sessionDate = new Date(session.date);
    const sessionStartDateTime = new Date(sessionDate);
    sessionStartDateTime.setHours(startHour, startMinute, 0, 0);

    let sessionEndDateTime = new Date(sessionDate);
    sessionEndDateTime.setHours(endHour, endMinute, 0, 0);

    // Handle midnight rollover (e.g., session from 23:00 to 01:00)
    if (sessionEndDateTime < sessionStartDateTime) {
      sessionEndDateTime.setDate(sessionEndDateTime.getDate() + 1);
    }

    return now > sessionEndDateTime;
  };

  // Helper function to check if session should be live
  const shouldBeLive = (session) => {
    const [startHour, startMinute] = session.startTime.split(':').map(Number);
    const [endHour, endMinute] = session.endTime.split(':').map(Number);

    const sessionDate = new Date(session.date);
    const sessionStartDateTime = new Date(sessionDate);
    sessionStartDateTime.setHours(startHour, startMinute, 0, 0);

    let sessionEndDateTime = new Date(sessionDate);
    sessionEndDateTime.setHours(endHour, endMinute, 0, 0);

    // Handle midnight rollover
    if (sessionEndDateTime < sessionStartDateTime) {
      sessionEndDateTime.setDate(sessionEndDateTime.getDate() + 1);
    }

    return now >= sessionStartDateTime && now < sessionEndDateTime;
  };

  // Auto-update session statuses
  for (const session of sessions) {
    // Close sessions that have ended
    if ((session.status === 'live' || session.status === 'scheduled') && hasSessionEnded(session)) {
      session.status = 'closed';
      await session.save();
      console.log(`Auto-closed session ${session._id} (${session.courseId?.code})`);
    }
    // Set scheduled sessions to live if their start time has passed
    else if (session.status === 'scheduled' && shouldBeLive(session)) {
      session.status = 'live';
      await session.save();
      console.log(`Auto-set session ${session._id} (${session.courseId?.code}) to live`);
    }
  }

  // Filter sessions based on actual current time (not just date)
  const activeSessions = sessions.filter(s => {
    if (s.status === 'closed') {
      console.log(`  ❌ Filtered out ${s.courseId?.code} - status is closed`);
      return false;
    }

    // Check if session is currently active based on actual time
    const isCurrentlyActive = shouldBeLive(s) || (s.status === 'live' && !hasSessionEnded(s));

    if (isCurrentlyActive) {
      console.log(`  ✅ Including ${s.courseId?.code} (${s.date}) - currently active`);
      return true;
    }

    // For scheduled sessions, include if they're today or tomorrow (to handle timezone differences)
    // This ensures sessions scheduled for "tomorrow" in UTC but "today" in local time are shown
    if (s.status === 'scheduled' && (s.date === today || s.date === yesterdayStr || s.date === tomorrowStr)) {
      console.log(`  ✅ Including ${s.courseId?.code} - scheduled for ${s.date}`);
      return true;
    }

    console.log(`  ❌ Filtered out ${s.courseId?.code} (${s.date}) - not currently active`);
    return false;
  });

  console.log(`✅ Final active sessions count: ${activeSessions.length}`);

  const sessionsWithStats = await Promise.all(
    activeSessions.map(async (session) => {
      // Get attendance records for this session
      const records = await AttendanceRecord.find({ sessionId: session._id });

      // Get total students based on session's year, semester, and department
      // This matches students in the same batch as the session
      // Use session.department first (new field), fallback to courseId.department
      const department = session.department || session.courseId?.department;
      const totalStudents = await Student.countDocuments({
        department: department,
        year: session.year,
        semester: session.semester
      });

      // Calculate stats
      const stats = { present: 0, late: 0, absent: 0 };
      for (const r of records) {
        stats[r.status]++;
      }

      // Calculate not attending (students who haven't scanned yet)
      const scannedCount = stats.present + stats.late;
      const notAttending = totalStudents - scannedCount;

      return {
        id: session._id,
        courseCode: session.courseId?.code,
        courseName: session.courseId?.name,
        department: department, // Use the resolved department
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        room: session.room,
        year: session.year,
        semester: session.semester,
        status: session.status,
        totalStudents,
        present: stats.present,
        late: stats.late,
        absent: stats.absent,
        notAttending,
        scannedCount
      };
    })
  );

  return sessionsWithStats;
};

export const getStudentAttendance = async (studentId, fromDate, toDate) => {
  const query = { studentId };

  if (fromDate || toDate) {
    const sessions = await ClassSession.find({
      ...(fromDate && { date: { $gte: fromDate } }),
      ...(toDate && { date: { $lte: toDate } })
    }).select('_id');

    query.sessionId = { $in: sessions.map(s => s._id) };
  }

  const records = await AttendanceRecord.find(query)
    .populate({
      path: 'sessionId',
      populate: { path: 'courseId' }
    })
    .sort({ createdAt: -1 });

  // enrich records with session start time for UI coloring
  const enriched = records.map(r => ({
    ...r.toObject(),
    sessionStartTime: r.sessionId?.startTime
  }));

  return enriched;
};

export const getBatchWiseAttendance = async () => {
  const { Batch } = await import('../models/Batch.js');

  // Get all batches
  const batches = await Batch.find({}).sort({ startYear: -1, department: 1 });

  const batchStats = await Promise.all(
    batches.map(async (batch) => {
      // Get all students in this batch
      const students = await Student.find({
        department: batch.department,
        year: batch.currentYear
      });

      const studentIds = students.map(s => s._id);

      // Get all sessions for this batch
      // First try with department filter, then populate courseId to check course department for sessions without department field
      const sessions = await ClassSession.find({
        year: batch.currentYear,
        semester: batch.currentSemester
      }).populate('courseId', 'department').select('_id department courseId');

      // Filter sessions by department (either session.department or courseId.department)
      const filteredSessions = sessions.filter(session => {
        const sessionDepartment = session.department || session.courseId?.department;
        return sessionDepartment === batch.department;
      });

      const sessionIds = filteredSessions.map(s => s._id);

      // Get attendance records
      const records = await AttendanceRecord.find({
        studentId: { $in: studentIds },
        sessionId: { $in: sessionIds }
      });

      // Calculate stats
      const stats = { present: 0, late: 0, absent: 0 };
      for (const r of records) {
        stats[r.status]++;
      }

      // Calculate expected total (students × sessions)
      const expectedTotal = students.length * filteredSessions.length;
      const recordedTotal = stats.present + stats.late + stats.absent;
      stats.absent += Math.max(0, expectedTotal - recordedTotal);

      const total = stats.present + stats.late + stats.absent;
      const attendanceRate = total > 0 ? ((stats.present + stats.late) / total * 100) : 0;

      return {
        batchId: batch._id,
        batchName: batch.name || `${batch.department} - ${batch.startYear}`,
        startYear: batch.startYear,
        department: batch.department,
        currentYear: batch.currentYear,
        currentSemester: batch.currentSemester,
        totalStudents: students.length,
        totalSessions: filteredSessions.length,
        present: stats.present,
        late: stats.late,
        absent: stats.absent,
        attendanceRate: attendanceRate.toFixed(1)
      };
    })
  );

  return batchStats;
};

export const getBatchCourseAttendance = async (batchId, courseId, startDate = null, endDate = null) => {
  const { Batch } = await import('../models/Batch.js');
  const { Course } = await import('../models/Course.js');

  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  // Get all students in this batch
  const students = await Student.find({
    department: batch.department,
    year: batch.currentYear
  });

  const studentIds = students.map(s => s._id);

  // Build session query with optional date range
  const sessionQuery = {
    courseId: courseId,
    year: batch.currentYear,
    semester: batch.currentSemester
  };

  // Add date range filter if provided
  if (startDate && endDate) {
    sessionQuery.date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    sessionQuery.date = { $gte: startDate };
  } else if (endDate) {
    sessionQuery.date = { $lte: endDate };
  }

  // Get sessions for this batch and course, then filter by department
  const allSessions = await ClassSession.find(sessionQuery).populate('courseId', 'department').select('_id department courseId');
  
  // Filter sessions by department (either session.department or courseId.department)
  const sessions = allSessions.filter(session => {
    const sessionDepartment = session.department || session.courseId?.department;
    return sessionDepartment === batch.department;
  });

  const sessionIds = sessions.map(s => s._id);

  // Get attendance records
  const records = await AttendanceRecord.find({
    studentId: { $in: studentIds },
    sessionId: { $in: sessionIds }
  });

  // Calculate stats
  const stats = { present: 0, late: 0, absent: 0 };
  for (const r of records) {
    stats[r.status]++;
  }

  // Calculate expected total (students × sessions)
  // Only calculate absents if there are sessions in the date range
  if (sessions.length > 0) {
    const expectedTotal = students.length * sessions.length;
    const recordedTotal = stats.present + stats.late + stats.absent;
    stats.absent += Math.max(0, expectedTotal - recordedTotal);
  }

  const total = stats.present + stats.late + stats.absent;
  const attendanceRate = total > 0 ? ((stats.present + stats.late) / total * 100) : 0;

  return {
    batchId: batch._id,
    batchName: batch.name || `${batch.department} - ${batch.startYear}`,
    courseId: course._id,
    courseCode: course.code,
    courseName: course.name,
    totalStudents: students.length,
    totalSessions: sessions.length,
    present: stats.present,
    late: stats.late,
    absent: stats.absent,
    attendanceRate: attendanceRate.toFixed(1),
    dateRange: (startDate && endDate) ? { startDate, endDate } : null
  };
};

export const getBatchCourses = async (batchId) => {
  const { Batch } = await import('../models/Batch.js');
  const { Course } = await import('../models/Course.js');

  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  // Get all sessions for this batch, filtering by department, year, and semester
  const sessions = await ClassSession.find({
    year: batch.currentYear,
    semester: batch.currentSemester
  }).populate('courseId').select('courseId department');

  // Extract unique courses, filtering by department
  const courseMap = new Map();
  for (const session of sessions) {
    if (session.courseId) {
      // Check department from session or course
      const sessionDepartment = session.department || session.courseId.department;
      
      // Only include courses that belong to the batch's department
      if (sessionDepartment === batch.department) {
        courseMap.set(session.courseId._id.toString(), {
          _id: session.courseId._id,
          code: session.courseId.code,
          name: session.courseId.name,
          department: session.courseId.department
        });
      }
    }
  }

  return Array.from(courseMap.values());
};

export const getBatchStudents = async (batchId, page = 1, limit = 10, search = '') => {
  const { Batch } = await import('../models/Batch.js');

  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  // Build query for students
  const query = {
    department: batch.department,
    year: batch.currentYear
  };

  // Add search filter if provided
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { registrationNo: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { mobile: { $regex: search, $options: 'i' } }
    ];
  }

  // Get total count
  const total = await Student.countDocuments(query);

  // Get paginated students
  const students = await Student.find(query)
    .select('_id name registrationNo email mobile year semester')
    .sort({ registrationNo: 1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    students,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

export const getStudentCourseAttendance = async (studentId, batchId, startDate = null, endDate = null, courseId = null) => {
  const { Batch } = await import('../models/Batch.js');

  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const student = await Student.findById(studentId);
  if (!student) {
    throw new Error('Student not found');
  }

  // Build session query with optional date range
  const sessionQuery = {
    year: batch.currentYear,
    semester: batch.currentSemester
  };

  // Add course filter if provided
  if (courseId) {
    sessionQuery.courseId = courseId;
  }

  // Add date range filter if provided
  if (startDate && endDate) {
    sessionQuery.date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    sessionQuery.date = { $gte: startDate };
  } else if (endDate) {
    sessionQuery.date = { $lte: endDate };
  }

  // Get all sessions for this batch, then filter by department
  const allSessions = await ClassSession.find(sessionQuery).populate('courseId').select('_id courseId department');
  
  // Filter sessions by department (either session.department or courseId.department)
  const sessions = allSessions.filter(session => {
    const sessionDepartment = session.department || session.courseId?.department;
    return sessionDepartment === batch.department;
  });

  const sessionIds = sessions.map(s => s._id);

  // Get attendance records for this student
  const records = await AttendanceRecord.find({
    studentId: studentId,
    sessionId: { $in: sessionIds }
  });

  // Group by course
  const courseMap = new Map();

  for (const session of sessions) {
    if (!session.courseId) continue;

    const courseId = session.courseId._id.toString();
    if (!courseMap.has(courseId)) {
      courseMap.set(courseId, {
        courseId: session.courseId._id,
        courseCode: session.courseId.code,
        courseName: session.courseId.name,
        present: 0,
        late: 0,
        absent: 0,
        totalSessions: 0
      });
    }

    const courseData = courseMap.get(courseId);
    courseData.totalSessions++;

    // Find attendance record for this session
    const record = records.find(r => r.sessionId.toString() === session._id.toString());
    if (record) {
      courseData[record.status]++;
    } else {
      courseData.absent++;
    }
  }

  const courseStats = Array.from(courseMap.values()).map(course => {
    const total = course.present + course.late + course.absent;
    const attendanceRate = total > 0 ? ((course.present + course.late) / total * 100) : 0;
    return {
      ...course,
      attendanceRate: attendanceRate.toFixed(1)
    };
  });

  return {
    student: {
      _id: student._id,
      name: student.name,
      registrationNo: student.registrationNo,
      email: student.email,
      year: student.year,
      semester: student.semester
    },
    courses: courseStats,
    dateRange: (startDate && endDate) ? { startDate, endDate } : null
  };
};

export const getCourseStudentAttendanceDetails = async (batchId, courseId, startDate = null, endDate = null) => {
  const { Batch } = await import('../models/Batch.js');
  const { Course } = await import('../models/Course.js');

  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  // Get all students in this batch
  const students = await Student.find({
    department: batch.department,
    year: batch.currentYear
  }).sort({ registrationNo: 1 });

  // Build session query with optional date range
  const sessionQuery = {
    courseId: courseId,
    year: batch.currentYear,
    semester: batch.currentSemester
  };

  // Add date range filter if provided
  if (startDate && endDate) {
    sessionQuery.date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    sessionQuery.date = { $gte: startDate };
  } else if (endDate) {
    sessionQuery.date = { $lte: endDate };
  }

  // Get sessions for this batch and course, then filter by department
  const allSessions = await ClassSession.find(sessionQuery).populate('courseId', 'department').select('_id date department courseId').sort({ date: 1 });
  
  // Filter sessions by department (either session.department or courseId.department)
  const sessions = allSessions.filter(session => {
    const sessionDepartment = session.department || session.courseId?.department;
    return sessionDepartment === batch.department;
  });

  const sessionIds = sessions.map(s => s._id);

  // Get all attendance records
  const records = await AttendanceRecord.find({
    sessionId: { $in: sessionIds }
  });

  // Create a map for quick lookup: studentId -> sessionId -> status
  const attendanceMap = new Map();
  for (const record of records) {
    const studentKey = record.studentId.toString();
    if (!attendanceMap.has(studentKey)) {
      attendanceMap.set(studentKey, new Map());
    }
    attendanceMap.get(studentKey).set(record.sessionId.toString(), record.status);
  }

  // Group sessions by month
  const monthlySessionsMap = new Map();
  for (const session of sessions) {
    const monthKey = session.date.slice(0, 7); // YYYY-MM
    if (!monthlySessionsMap.has(monthKey)) {
      monthlySessionsMap.set(monthKey, []);
    }
    monthlySessionsMap.get(monthKey).push(session);
  }

  // Calculate student-wise attendance
  const studentAttendance = students.map(student => {
    const studentKey = student._id.toString();
    const studentRecords = attendanceMap.get(studentKey) || new Map();

    // Overall stats
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;

    // Monthly stats
    const monthlyStats = [];

    for (const [monthKey, monthSessions] of monthlySessionsMap.entries()) {
      let monthPresent = 0;
      let monthLate = 0;
      let monthAbsent = 0;

      for (const session of monthSessions) {
        const status = studentRecords.get(session._id.toString()) || 'absent';
        if (status === 'present') {
          monthPresent++;
          totalPresent++;
        } else if (status === 'late') {
          monthLate++;
          totalLate++;
        } else {
          monthAbsent++;
          totalAbsent++;
        }
      }

      const monthTotal = monthPresent + monthLate + monthAbsent;
      const monthAttendanceRate = monthTotal > 0 ? ((monthPresent + monthLate) / monthTotal * 100) : 0;

      monthlyStats.push({
        month: monthKey,
        present: monthPresent,
        late: monthLate,
        absent: monthAbsent,
        total: monthTotal,
        attendanceRate: monthAttendanceRate.toFixed(1)
      });
    }

    const overallTotal = totalPresent + totalLate + totalAbsent;
    const overallAttendanceRate = overallTotal > 0 ? ((totalPresent + totalLate) / overallTotal * 100) : 0;

    return {
      studentId: student._id,
      name: student.name,
      registrationNo: student.registrationNo,
      monthlyStats,
      overall: {
        present: totalPresent,
        late: totalLate,
        absent: totalAbsent,
        total: overallTotal,
        attendanceRate: overallAttendanceRate.toFixed(1)
      }
    };
  });

  // Calculate overall averages
  const totalStudents = students.length;
  let avgPresent = 0;
  let avgLate = 0;
  let avgAbsent = 0;
  let avgAttendanceRate = 0;

  if (totalStudents > 0) {
    for (const student of studentAttendance) {
      avgPresent += student.overall.present;
      avgLate += student.overall.late;
      avgAbsent += student.overall.absent;
      avgAttendanceRate += parseFloat(student.overall.attendanceRate);
    }
    avgPresent = (avgPresent / totalStudents).toFixed(1);
    avgLate = (avgLate / totalStudents).toFixed(1);
    avgAbsent = (avgAbsent / totalStudents).toFixed(1);
    avgAttendanceRate = (avgAttendanceRate / totalStudents).toFixed(1);
  }

  // Get unique months for column headers
  const months = Array.from(monthlySessionsMap.keys()).sort();

  return {
    courseId: course._id,
    courseCode: course.code,
    courseName: course.name,
    totalSessions: sessions.length,
    months,
    students: studentAttendance,
    averages: {
      present: avgPresent,
      late: avgLate,
      absent: avgAbsent,
      attendanceRate: avgAttendanceRate
    },
    dateRange: (startDate && endDate) ? { startDate, endDate } : null
  };
};
