import { ClassSession } from '../models/ClassSession.js';
import { broadcast } from '../realtime/ws.js';

export const getCourseSessions = async (req, res, next) => {
  try {
    const sessions = await ClassSession.find({ courseId: req.params.courseId })
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

export const createSession = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { date, startTime, endTime, room } = req.body;

    const session = await ClassSession.create({
      courseId,
      date,
      startTime,
      endTime,
      room,
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

    const session = await ClassSession.findByIdAndUpdate(
      req.params.sessionId,
      { status },
      { new: true, runValidators: true }
    ).populate('courseId');

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
