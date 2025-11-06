import { Enrollment } from '../models/Enrollment.js';

export const getCourseEnrollments = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ courseId: req.params.courseId })
      .populate('studentId', 'studentId name email department year')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: enrollments
    });
  } catch (error) {
    next(error);
  }
};

export const createEnrollment = async (req, res, next) => {
  try {
    const { studentId } = req.body;
    const { courseId } = req.params;

    const enrollment = await Enrollment.create({
      courseId,
      studentId,
      status: 'active'
    });

    await enrollment.populate('studentId', 'studentId name email department year');

    res.status(201).json({
      success: true,
      data: enrollment
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEnrollment = async (req, res, next) => {
  try {
    const { courseId, studentId } = req.params;

    const enrollment = await Enrollment.findOneAndDelete({
      courseId,
      studentId
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    res.json({
      success: true,
      message: 'Enrollment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
