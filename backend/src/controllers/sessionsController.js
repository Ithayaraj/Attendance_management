import { ClassSession } from '../models/ClassSession.js';
import { Course } from '../models/Course.js';
import { broadcast } from '../realtime/ws.js';

export const getCourseSessions = async (req, res, next) => {
  try {
    const sessions = await ClassSession.find({ courseId: req.params.courseId })
      .populate('courseId', 'code name')
      .sort({ date: -1, startTime: -1 });

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
};

export const getSession = async (req, res, next) => {
  try {
    const session = await ClassSession.findById(req.params.sessionId)
      .populate('courseId');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });
    try {
      broadcast({
        type: 'session.status',
        payload: { sessionId: session._id, status: session.status }
      });
    } catch (e) {
      // ignore broadcast errors
    }
  } catch (error) {
    next(error);
  }
};

// Helper function to derive year from course code
const deriveYearFromCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  const match = code.match(/^[A-Za-z]+(\d)(\d)/);
  if (!match) return null;
  return parseInt(match[1], 10);
};

// Helper function to derive semester from course code
const deriveSemesterFromCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  const match = code.match(/^[A-Za-z]+(\d)(\d)/);
  if (!match) return null;
  return parseInt(match[2], 10);
};

export const createSession = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { date, startTime, endTime, room } = req.body;

    // Get course to extract year and semester
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get year and semester from course, or try to derive from course code
    let year = course.year;
    let semester = course.semester;

    // If course doesn't have year/semester (old data), try to derive from code
    if (year === null || year === undefined || semester === null || semester === undefined) {
      const derivedYear = deriveYearFromCode(course.code);
      const derivedSemester = deriveSemesterFromCode(course.code);
      
      if (derivedYear !== null && derivedSemester !== null && 
          derivedYear >= 1 && derivedYear <= 4 && 
          derivedSemester >= 1 && derivedSemester <= 2) {
        // Update the course with derived values for future use
        course.year = derivedYear;
        course.semester = derivedSemester;
        try {
          await course.save();
        } catch (saveError) {
          // If save fails, still use derived values for session creation
          console.warn('Failed to save course with derived year/semester:', saveError);
        }
        
        year = course.year;
        semester = course.semester;
      } else {
        return res.status(400).json({
          success: false,
          message: `Course "${course.code}" missing year/semester info. Update course first.`
        });
      }
    }

    // Validate year and semester values
    if (year === null || year === undefined || year < 1 || year > 4) {
      return res.status(400).json({
        success: false,
        message: `Invalid year: ${year}. Must be 1-4.`
      });
    }

    if (semester === null || semester === undefined || semester < 1 || semester > 2) {
      return res.status(400).json({
        success: false,
        message: `Invalid semester: ${semester}. Must be 1 or 2.`
      });
    }

    // Check for time conflicts with other sessions for the same batch on the same date
    // A batch is defined by department + year + semester
    console.log(`Checking for time conflicts for ${course.department} Y${year}S${semester} on ${date}`);
    
    const timeConflict = await ClassSession.findOne({
      department: course.department,
      year: year,
      semester: semester,
      date: date, // Only check sessions on the same date
      status: { $in: ['live', 'scheduled'] },
      _id: { $ne: req.body.sessionId }, // Exclude current session if updating
      $or: [
        // New session starts during existing session
        { $and: [
          { startTime: { $lte: startTime } },
          { endTime: { $gt: startTime } }
        ]},
        // New session ends during existing session
        { $and: [
          { startTime: { $lt: endTime } },
          { endTime: { $gte: endTime } }
        ]},
        // New session completely contains existing session
        { $and: [
          { startTime: { $gte: startTime } },
          { endTime: { $lte: endTime } }
        ]}
      ]
    }).populate('courseId');

    if (timeConflict) {
      console.log(`Time conflict found for same batch: ${timeConflict.courseId.code} (${timeConflict.status}) on ${timeConflict.date} from ${timeConflict.startTime} to ${timeConflict.endTime}`);
      return res.status(400).json({
        success: false,
        message: `Time conflict: ${timeConflict.courseId.code} already scheduled ${timeConflict.startTime}-${timeConflict.endTime} on ${date}.`
      });
    }
    
    console.log(`No time conflicts found for this batch on ${date}`);

    // Check for room conflicts (same room, same date, same department, overlapping time)
    // Different departments can use rooms with the same name (they're in different buildings)
    const roomConflict = await ClassSession.findOne({
      room: room,
      date: date,
      department: course.department, // Only check within same department
      status: { $in: ['live', 'scheduled'] },
      _id: { $ne: req.body.sessionId },
      $or: [
        // New session starts during existing session
        { $and: [
          { startTime: { $lte: startTime } },
          { endTime: { $gt: startTime } }
        ]},
        // New session ends during existing session
        { $and: [
          { startTime: { $lt: endTime } },
          { endTime: { $gte: endTime } }
        ]},
        // New session completely contains existing session
        { $and: [
          { startTime: { $gte: startTime } },
          { endTime: { $lte: endTime } }
        ]}
      ]
    }).populate('courseId');

    if (roomConflict) {
      return res.status(400).json({
        success: false,
        message: `Room "${room}" booked ${roomConflict.startTime}-${roomConflict.endTime} for ${roomConflict.courseId.code}.`
      });
    }

    // Determine initial status based on current time vs session start time
    const now = new Date();
    const sessionDate = new Date(date);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const sessionStartDateTime = new Date(sessionDate);
    sessionStartDateTime.setHours(startHour, startMinute, 0, 0);
    
    let sessionEndDateTime = new Date(sessionDate);
    sessionEndDateTime.setHours(endHour, endMinute, 0, 0);
    
    // Handle midnight rollover (e.g., session from 23:00 to 01:00)
    if (sessionEndDateTime < sessionStartDateTime) {
      sessionEndDateTime.setDate(sessionEndDateTime.getDate() + 1);
    }
    
    // Determine status:
    // - If current time >= start time and < end time: 'live'
    // - If current time < start time: 'scheduled'
    // - If current time >= end time: 'closed' (shouldn't happen in creation, but handle it)
    // Allow 15 minutes early access for instructors to set up
    const EARLY_ACCESS_MINUTES = 15;
    const earliestLiveTime = new Date(sessionStartDateTime.getTime() - (EARLY_ACCESS_MINUTES * 60 * 1000));
    
    let initialStatus = 'scheduled';
    
    if (now >= earliestLiveTime && now < sessionEndDateTime) {
      initialStatus = 'live';
      console.log(`Session start time has passed (with 15min early access). Setting status to 'live'.`);
    } else if (now >= sessionEndDateTime) {
      initialStatus = 'closed';
      console.log(`Session end time has passed. Setting status to 'closed'.`);
    } else {
      console.log(`Session is in the future. Setting status to 'scheduled'.`);
    }

    const session = await ClassSession.create({
      courseId,
      date,
      startTime,
      endTime,
      room,
      department: course.department,
      year: year,
      semester: semester,
      status: initialStatus
    });

    await session.populate('courseId');

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

export const updateSessionStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const session = await ClassSession.findById(req.params.sessionId).populate('courseId');
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // If trying to set status to 'live', perform additional validations
    if (status === 'live') {
      // Check if another session is already live for this batch (department + year + semester)
      const existingLiveSession = await ClassSession.findOne({
        department: session.department,
        year: session.year,
        semester: session.semester,
        status: 'live',
        _id: { $ne: session._id }
      }).populate('courseId');

      if (existingLiveSession) {
        return res.status(400).json({
          success: false,
          message: `Another session already live for Y${session.year}S${session.semester}. Close it first.`
        });
      }

      // IMPORTANT: Check if session start time has arrived
      // Only allow sessions to go live if their start time has passed
      const now = new Date();
      const sessionDate = new Date(session.date);
      const [startHour, startMinute] = session.startTime.split(':').map(Number);
      
      const sessionStartDateTime = new Date(sessionDate);
      sessionStartDateTime.setHours(startHour, startMinute, 0, 0);
      
      // Allow 15 minutes early access for setup
      const EARLY_ACCESS_MINUTES = 15;
      const earliestLiveTime = new Date(sessionStartDateTime.getTime() - (EARLY_ACCESS_MINUTES * 60 * 1000));
      
      if (now < earliestLiveTime) {
        const timeUntilStart = Math.ceil((sessionStartDateTime.getTime() - now.getTime()) / (60 * 1000));
        return res.status(400).json({
          success: false,
          message: `Session cannot go live yet. Starts at ${session.startTime} (${timeUntilStart} minutes remaining). Early access allowed 15 minutes before start time.`
        });
      }
    }

    session.status = status;
    await session.save();

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

export const updateSession = async (req, res, next) => {
  try {
    const { date, startTime, endTime, room } = req.body;
    const session = await ClassSession.findByIdAndUpdate(
      req.params.sessionId,
      { date, startTime, endTime, room },
      { new: true, runValidators: true }
    ).populate('courseId');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

export const getSessionRelations = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if there are related records
    const [attendanceCount, scanCount, deviceCount] = await Promise.all([
      (await import('../models/AttendanceRecord.js')).AttendanceRecord.countDocuments({ sessionId }),
      (await import('../models/Scan.js')).Scan.countDocuments({ sessionId }),
      (await import('../models/Device.js')).Device.countDocuments({ activeSessionId: sessionId })
    ]);

    const hasRelatedData = attendanceCount > 0 || scanCount > 0 || deviceCount > 0;

    res.json({
      success: true,
      data: {
        hasRelatedData,
        relatedData: {
          attendanceRecords: attendanceCount,
          scanRecords: scanCount,
          activeDevices: deviceCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSession = async (req, res, next) => {
  try {
    const { force } = req.query;
    const sessionId = req.params.sessionId;

    const session = await ClassSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Check if there are related records
    const [attendanceCount, scanCount, deviceCount] = await Promise.all([
      (await import('../models/AttendanceRecord.js')).AttendanceRecord.countDocuments({ sessionId }),
      (await import('../models/Scan.js')).Scan.countDocuments({ sessionId }),
      (await import('../models/Device.js')).Device.countDocuments({ activeSessionId: sessionId })
    ]);

    const hasRelatedData = attendanceCount > 0 || scanCount > 0 || deviceCount > 0;

    // If there's related data and force is not specified, return conflict
    if (hasRelatedData && force !== 'true') {
      return res.status(409).json({
        success: false,
        message: 'Session has related data',
        relatedData: {
          attendanceRecords: attendanceCount,
          scanRecords: scanCount,
          activeDevices: deviceCount
        },
        requiresForceDelete: true
      });
    }

    // If force delete is requested, delete all related data
    if (force === 'true') {
      const { AttendanceRecord } = await import('../models/AttendanceRecord.js');
      const { Scan } = await import('../models/Scan.js');
      const { Device } = await import('../models/Device.js');

      await Promise.all([
        // Delete attendance records
        AttendanceRecord.deleteMany({ sessionId }),
        // Delete scan records
        Scan.deleteMany({ sessionId }),
        // Clear activeSessionId from devices
        Device.updateMany(
          { activeSessionId: sessionId },
          { $unset: { activeSessionId: 1 } }
        )
      ]);
    }

    // Delete the session
    await ClassSession.findByIdAndDelete(sessionId);

    res.json({ 
      success: true, 
      message: force === 'true' ? 'Session and all related data deleted' : 'Session deleted'
    });
  } catch (error) {
    next(error);
  }
};

// Query sessions by filters (date, room, status, etc.)
export const querySessions = async (req, res, next) => {
  try {
    const { date, room, status } = req.query;
    
    const query = {};
    
    if (date) {
      query.date = date;
    }
    
    if (room) {
      query.room = room;
    }
    
    if (status) {
      // Handle both single status and array of statuses
      if (Array.isArray(status)) {
        query.status = { $in: status };
      } else {
        query.status = status;
      }
    }
    
    const sessions = await ClassSession.find(query)
      .populate('courseId', 'code name department')
      .sort({ date: -1, startTime: -1 });

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
};
