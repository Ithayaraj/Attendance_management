import { Student } from '../models/Student.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { ClassSession } from '../models/ClassSession.js';

export const getStudentAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month } = req.query;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const [year, monthNum] = month ? month.split('-') : [new Date().getFullYear(), new Date().getMonth() + 1];
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-31`;

    const sessions = await ClassSession.find({
      date: { $gte: startDate, $lte: endDate }
    }).select('_id date');

    const sessionIds = sessions.map(s => s._id);

    const records = await AttendanceRecord.find({
      studentId: id,
      sessionId: { $in: sessionIds }
    }).populate('sessionId');

    const summary = {
      present: 0,
      late: 0,
      absent: 0
    };

    const dayWiseData = [];

    for (const record of records) {
      summary[record.status]++;

      if (record.sessionId) {
        dayWiseData.push({
          date: record.sessionId.date,
          status: record.status,
          checkInAt: record.checkInAt,
          sessionId: record.sessionId._id
        });
      }
    }

    const totalSessions = sessions.length;
    const attendedSessions = summary.present + summary.late;
    const attendancePercentage = totalSessions > 0
      ? ((attendedSessions / totalSessions) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        student,
        summary: [
          { name: 'Present', value: summary.present },
          { name: 'Late', value: summary.late },
          { name: 'Absent', value: summary.absent }
        ],
        dayWiseData: dayWiseData.sort((a, b) => a.date.localeCompare(b.date)),
        stats: {
          totalSessions,
          attendedSessions,
          attendancePercentage: parseFloat(attendancePercentage),
          meets80Percent: parseFloat(attendancePercentage) >= 80
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentSemesterAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = sixMonthsAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const sessions = await ClassSession.find({
      date: { $gte: startDate, $lte: endDate }
    }).select('_id date').sort({ date: 1 });

    const sessionIds = sessions.map(s => s._id);

    const records = await AttendanceRecord.find({
      studentId: id,
      sessionId: { $in: sessionIds }
    }).populate('sessionId');

    const monthlyBreakdown = {};
    const lineGraphData = [];

    for (const record of records) {
      if (record.sessionId) {
        const date = record.sessionId.date;
        const monthKey = date.substring(0, 7);

        if (!monthlyBreakdown[monthKey]) {
          monthlyBreakdown[monthKey] = {
            month: monthKey,
            present: 0,
            late: 0,
            absent: 0,
            total: 0
          };
        }

        monthlyBreakdown[monthKey][record.status]++;
        monthlyBreakdown[monthKey].total++;

        lineGraphData.push({
          date,
          present: record.status === 'present' ? 1 : 0,
          late: record.status === 'late' ? 1 : 0,
          absent: record.status === 'absent' ? 1 : 0
        });
      }
    }

    const monthlyData = Object.values(monthlyBreakdown).map(month => ({
      ...month,
      attendanceRate: month.total > 0
        ? (((month.present + month.late) / month.total) * 100).toFixed(2)
        : 0
    }));

    const totalSessions = sessions.length;
    const totalPresent = records.filter(r => r.status === 'present').length;
    const totalLate = records.filter(r => r.status === 'late').length;
    const attendedSessions = totalPresent + totalLate;
    const semesterAttendancePercentage = totalSessions > 0
      ? ((attendedSessions / totalSessions) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        student,
        monthlyBreakdown: monthlyData,
        lineGraphData,
        semesterStats: {
          totalSessions,
          attendedSessions,
          attendancePercentage: parseFloat(semesterAttendancePercentage),
          meets80Percent: parseFloat(semesterAttendancePercentage) >= 80,
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getTopAttendees = async (req, res, next) => {
  try {
    const { limit = 3, type = 'top' } = req.query;

    const students = await Student.find().select('registrationNo name department');

    const attendanceData = [];

    for (const student of students) {
      const records = await AttendanceRecord.find({ studentId: student._id });

      const totalSessions = records.length;
      const attendedSessions = records.filter(r => r.status === 'present' || r.status === 'late').length;
      const attendancePercentage = totalSessions > 0
        ? (attendedSessions / totalSessions) * 100
        : 0;

      attendanceData.push({
        student: {
          id: student._id,
          registrationNo: student.registrationNo,
          name: student.name,
          department: student.department
        },
        totalSessions,
        attendedSessions,
        attendancePercentage: parseFloat(attendancePercentage.toFixed(2))
      });
    }

    const sorted = type === 'top'
      ? attendanceData.sort((a, b) => b.attendancePercentage - a.attendancePercentage)
      : attendanceData.sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    res.json({
      success: true,
      data: sorted.slice(0, parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};
