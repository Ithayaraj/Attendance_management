import { ClassSession } from '../models/ClassSession.js';

const EARLY_ACCESS_MINUTES = 15;
const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds

/**
 * Automatically transition sessions from 'scheduled' to 'live' when their start time arrives
 * Also close sessions that have ended
 */
export class SessionScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('⏰ Session scheduler is already running');
      return;
    }

    console.log('⏰ Starting session scheduler...');
    this.isRunning = true;

    // Run immediately on start
    this.checkAndUpdateSessions();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.checkAndUpdateSessions();
    }, CHECK_INTERVAL_MS);

    console.log(`✅ Session scheduler started (checking every ${CHECK_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('⏰ Session scheduler stopped');
    }
  }

  /**
   * Check all sessions and update their status based on current time
   */
  async checkAndUpdateSessions() {
    try {
      const now = new Date();

      // Find all scheduled and live sessions
      const sessions = await ClassSession.find({
        status: { $in: ['scheduled', 'live'] }
      }).populate('courseId');

      if (sessions.length === 0) {
        return;
      }

      const updates = {
        toLive: [],
        toClosed: []
      };

      for (const session of sessions) {
        const sessionDate = new Date(session.date);
        const [startHour, startMinute] = session.startTime.split(':').map(Number);
        const [endHour, endMinute] = session.endTime.split(':').map(Number);

        // Calculate session start and end times
        const sessionStartDateTime = new Date(sessionDate);
        sessionStartDateTime.setHours(startHour, startMinute, 0, 0);

        let sessionEndDateTime = new Date(sessionDate);
        sessionEndDateTime.setHours(endHour, endMinute, 0, 0);

        // Handle midnight rollover
        if (sessionEndDateTime < sessionStartDateTime) {
          sessionEndDateTime.setDate(sessionEndDateTime.getDate() + 1);
        }

        // Calculate earliest live time (15 minutes before start)
        const earliestLiveTime = new Date(sessionStartDateTime.getTime() - (EARLY_ACCESS_MINUTES * 60 * 1000));

        // Check if session should transition to live
        if (session.status === 'scheduled' && now >= earliestLiveTime && now < sessionEndDateTime) {
          // Check if another session is already live for this batch
          const existingLiveSession = await ClassSession.findOne({
            department: session.department,
            year: session.year,
            semester: session.semester,
            status: 'live',
            _id: { $ne: session._id }
          });

          if (!existingLiveSession) {
            updates.toLive.push(session);
          } else {
            console.log(`⚠️  Cannot set ${session.courseId?.code} to live: ${existingLiveSession.courseId?.code} is already live for Y${session.year}S${session.semester}`);
          }
        }

        // Check if session should be closed
        if ((session.status === 'live' || session.status === 'scheduled') && now >= sessionEndDateTime) {
          updates.toClosed.push(session);
        }
      }

      // Apply updates
      if (updates.toLive.length > 0) {
        for (const session of updates.toLive) {
          session.status = 'live';
          await session.save();
          console.log(`🟢 Auto-transitioned to LIVE: ${session.courseId?.code} (${session.date} ${session.startTime})`);
        }
      }

      if (updates.toClosed.length > 0) {
        for (const session of updates.toClosed) {
          session.status = 'closed';
          await session.save();
          console.log(`⚫ Auto-closed: ${session.courseId?.code} (${session.date} ${session.endTime})`);
        }
      }

    } catch (error) {
      console.error('❌ Error in session scheduler:', error);
    }
  }
}

// Create singleton instance
export const sessionScheduler = new SessionScheduler();
