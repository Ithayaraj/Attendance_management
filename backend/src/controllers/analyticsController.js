import { getMonthlyAnalytics, getLiveSessionAnalytics, getSessionSummaryByYear, getBatchLineAnalytics, getCurrentSessions } from '../services/analyticsService.js';

export const getMonthlyStats = async (req, res, next) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'Month parameter required (format: YYYY-MM)'
      });
    }

    const analytics = await getMonthlyAnalytics(month);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

export const getLiveSessionStats = async (req, res, next) => {
  try {
    const data = await getLiveSessionAnalytics();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getSessionSummaryYearWise = async (req, res, next) => {
  try {
    const data = await getSessionSummaryByYear();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBatchLineStats = async (req, res, next) => {
  try {
    const { startYear } = req.query;
    if (!startYear) {
      return res.status(400).json({ success: false, message: 'startYear is required' });
    }
    const data = await getBatchLineAnalytics(startYear);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCurrentSessionsStats = async (req, res, next) => {
  try {
    const data = await getCurrentSessions();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
