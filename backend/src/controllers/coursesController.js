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
    const course = await Course.findByIdAndDelete(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
