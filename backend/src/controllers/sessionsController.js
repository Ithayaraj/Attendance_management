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
          message: `Course "${course.code}" is missing year and semester information. Cannot derive from course code. Please update the course manually to include year (1-4) and semester (1-2) values.`
        });
      }
    }

    // Validate year and semester values
    if (year === null || year === undefined || year < 1 || year > 4) {
      return res.status(400).json({
        success: false,
        message: `Invalid year value: ${year}. Year must be between 1 and 4. Please update the course to set a valid year.`
      });
    }

    if (semester === null || semester === undefined || semester < 1 || semester > 2) {
      return res.status(400).json({
        success: false,
        message: `Invalid semester value: ${semester}. Semester must be 1 or 2. Please update the course to set a valid semester.`
      });
    }

    // Check if there's any active (live or scheduled) session for this batch
    // A batch is defined by department + year + semester
    // Each batch can only have one active session at a time
    console.log(`Checking for active sessions for ${course.department} Y${year}S${semester}`);
    
    const activeSession = await ClassSession.findOne({
      department: course.department,
      year: year,
      semester: semester,
      status: { $in: ['live', 'scheduled'] },
      _id: { $ne: req.body.sessionId } // Exclude current session if updating
    }).populate('courseId');

    if (activeSession) {
      console.log(`Active session found for same batch: ${activeSession.courseId.code} (${activeSession.status}) on ${activeSession.date}`);
      return res.status(400).json({
        success: false,
        message: `Cannot create session. ${course.department} (Year ${year}, Semester ${semester}) already has an active session (${activeSession.courseId.code}) with status "${activeSession.status}" on ${activeSession.date}. Please close the existing session before creating a new one.`
      });
    }
    
    console.log(`No active sessions found for this batch`);

    // Check for room conflicts (same room, same date, overlapping time)
    const roomConflict = await ClassSession.findOne({
      room: room,
      date: date,
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
        message: `Room "${room}" is already booked on ${date} from ${roomConflict.startTime} to ${roomConflict.endTime} for ${roomConflict.courseId.code}. Please choose a different room or time.`
      });
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
      status: 'scheduled'
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

    // If trying to set status to 'live', check if another session is already live for this batch (department + year + semester)
    if (status === 'live') {
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
          message: `Another session is already live for ${session.department} (Year ${session.year}, Semester ${session.semester}). Only one session can be live at a time for this batch.`
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

export const deleteSession = async (req, res, next) => {
  try {
    const session = await ClassSession.findByIdAndDelete(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    next(error);
  }
};
