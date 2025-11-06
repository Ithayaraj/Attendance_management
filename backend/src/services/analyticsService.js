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

  // Add virtual absents for enrolled students who have no record
  const enrollments = await Enrollment.find({ courseId: session.courseId._id }).populate('studentId');
  const presentIds = new Set(records.map(r => String(r.studentId?._id)));
  for (const e of enrollments) {
    const sid = String(e.studentId?._id);
    if (!presentIds.has(sid)) {
      const y = e.studentId?.year || 0;
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
