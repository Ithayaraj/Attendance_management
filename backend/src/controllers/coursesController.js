import { Course } from '../models/Course.js';

const deriveSemesterFromCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  const match = code.match(/^[A-Za-z]+(\d)(\d)/);
  if (!match) return null;
  return parseInt(match[2], 10);
};

const deriveYearFromCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  const match = code.match(/^[A-Za-z]+(\d)(\d)/);
  if (!match) return null;
  return parseInt(match[1], 10);
};

export const getCourses = async (req, res, next) => {
  try {
    const courses = await Course.find()
      .populate('instructorId', 'name email')
      .sort({ code: 1 });

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    next(error);
  }
};

export const getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructorId', 'name email');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    next(error);
  }
};

export const createCourse = async (req, res, next) => {
  try {
    if (!req.body.semester && req.body.code) {
      const derived = deriveSemesterFromCode(req.body.code);
      if (derived === null) {
        return res.status(400).json({ success: false, message: 'Invalid course code format. Cannot derive semester.' });
      }
      req.body.semester = derived;
    }
    if (!req.body.year && req.body.code) {
      const derived = deriveYearFromCode(req.body.code);
      if (derived === null) {
        return res.status(400).json({ success: false, message: 'Invalid course code format. Cannot derive year.' });
      }
      req.body.year = derived;
    }
    const course = await Course.create(req.body);
    await course.populate('instructorId', 'name email');

    res.status(201).json({
      success: true,
      data: course
    });
  } catch (error) {
    next(error);
  }
};

export const updateCourse = async (req, res, next) => {
  try {
    if (!req.body.semester && req.body.code) {
      const derived = deriveSemesterFromCode(req.body.code);
      if (derived !== null) {
        req.body.semester = derived;
      }
    }
    if (!req.body.year && req.body.code) {
      const derived = deriveYearFromCode(req.body.code);
      if (derived !== null) {
        req.body.year = derived;
      }
    }
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('instructorId', 'name email');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCourse = async (req, res, next) => {
  try {
    const { force } = req.query;
    const courseId = req.params.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if there are related records
    const [sessionCount, enrollmentCount, scanCount] = await Promise.all([
      (await import('../models/ClassSession.js')).ClassSession.countDocuments({ courseId }),
      (await import('../models/Enrollment.js')).Enrollment.countDocuments({ courseId }),
      (await import('../models/Scan.js')).Scan.countDocuments({ courseId })
    ]);

    const hasRelatedData = sessionCount > 0 || enrollmentCount > 0 || scanCount > 0;

    // If there's related data and force is not specified, return conflict
    if (hasRelatedData && force !== 'true') {
      return res.status(409).json({
        success: false,
        message: 'Course has related data',
        relatedData: {
          sessions: sessionCount,
          enrollments: enrollmentCount,
          scanRecords: scanCount
        },
        requiresForceDelete: true
      });
    }

    // If force delete is requested, delete all related data
    if (force === 'true') {
      const { ClassSession } = await import('../models/ClassSession.js');
      const { Enrollment } = await import('../models/Enrollment.js');
      const { Scan } = await import('../models/Scan.js');
      const { AttendanceRecord } = await import('../models/AttendanceRecord.js');
      const { Device } = await import('../models/Device.js');

      // Get all session IDs for this course to clean up attendance records and devices
      const sessions = await ClassSession.find({ courseId }, '_id');
      const sessionIds = sessions.map(s => s._id);

      await Promise.all([
        // Delete sessions
        ClassSession.deleteMany({ courseId }),
        // Delete enrollments
        Enrollment.deleteMany({ courseId }),
        // Delete scan records
        Scan.deleteMany({ courseId }),
        // Delete attendance records for sessions of this course
        sessionIds.length > 0 ? AttendanceRecord.deleteMany({ sessionId: { $in: sessionIds } }) : Promise.resolve(),
        // Clear activeSessionId from devices that were using sessions of this course
        sessionIds.length > 0 ? Device.updateMany(
          { activeSessionId: { $in: sessionIds } },
          { $unset: { activeSessionId: 1 } }
        ) : Promise.resolve()
      ]);
    }

    // Delete the course
    await Course.findByIdAndDelete(courseId);

    res.json({
      success: true,
      message: force === 'true' ? 'Course and all related data deleted' : 'Course deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
