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

    // Check for time conflicts with other sessions for the same batch (year + semester)
    // A batch can only have one session at a time - sessions cannot overlap
    console.log(`Checking batch time conflicts for Y${year}S${semester} on ${date}, ${startTime}-${endTime}`);
    
    const batchTimeConflict = await ClassSession.findOne({
      year: year,
      semester: semester,
      date: date,
      _id: { $ne: req.body.sessionId }, // Exclude current session if updating
      $or: [
        // New session starts during existing session (existing.start <= new.start < existing.end)
        { $and: [
          { startTime: { $lte: startTime } },
          { endTime: { $gt: startTime } }
        ]},
        // New session ends during existing session (existing.start < new.end <= existing.end)
        { $and: [
          { startTime: { $lt: endTime } },
          { endTime: { $gte: endTime } }
        ]},
        // New session completely contains existing session (new.start <= existing.start AND new.end >= existing.end)
        { $and: [
          { startTime: { $gte: startTime } },
          { endTime: { $lte: endTime } }
        ]}
      ]
    }).populate('courseId');

    if (batchTimeConflict) {
      console.log(`Batch time conflict found: ${batchTimeConflict.courseId.code} (${batchTimeConflict.startTime}-${batchTimeConflict.endTime})`);
      return res.status(400).json({
        success: false,
        message: `Time conflict for Year ${year}, Semester ${semester} on ${date}. Another session (${batchTimeConflict.courseId.code}) is scheduled from ${batchTimeConflict.startTime} to ${batchTimeConflict.endTime}. Please schedule after ${batchTimeConflict.endTime}.`
      });
    }
    
    console.log(`No batch time conflicts found`);

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

    // If trying to set status to 'live', check if another session is already live for this year+semester
    if (status === 'live') {
      const existingLiveSession = await ClassSession.findOne({
        year: session.year,
        semester: session.semester,
        status: 'live',
        _id: { $ne: session._id }
      });

      if (existingLiveSession) {
        return res.status(400).json({
          success: false,
          message: `Another session is already live for Year ${session.year}, Semester ${session.semester}. Only one session can be live at a time for this batch.`
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
